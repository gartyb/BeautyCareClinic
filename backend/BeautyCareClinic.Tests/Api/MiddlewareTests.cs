using BeautyCareClinic.Api;
using BeautyCareClinic.Api.Middleware;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.Net;
using System.Text.Json;
using Xunit;

namespace BeautyCareClinic.Tests.Api;

/// <summary>
/// Tests for ExceptionHandlingMiddleware and SecurityHeadersMiddleware.
/// </summary>
public class ExceptionHandlingMiddlewareTests
{
    private static IHost BuildHost(RequestDelegate pipeline)
    {
        return new HostBuilder()
            .ConfigureWebHost(webBuilder =>
            {
                webBuilder.UseTestServer();
                webBuilder.ConfigureServices(services =>
                {
                    services.AddRouting();
                    services.AddLogging();
                });
                webBuilder.Configure(app =>
                {
                    app.UseMiddleware<ExceptionHandlingMiddleware>();
                    app.Run(pipeline);
                });
            })
            .Build();
    }

    [Fact]
    public async Task KeyNotFoundException_Returns404_WithNotFoundCode()
    {
        using var host = BuildHost(_ => throw new KeyNotFoundException("Customer 123 not found."));
        await host.StartAsync();
        var client = host.GetTestClient();

        var response = await client.GetAsync("/");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        var doc  = JsonDocument.Parse(body);
        Assert.Equal(ErrorCodes.NotFound, doc.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task UnauthorizedAccessException_Returns401_WithUnauthorizedCode()
    {
        using var host = BuildHost(_ => throw new UnauthorizedAccessException("Not allowed."));
        await host.StartAsync();
        var client = host.GetTestClient();

        var response = await client.GetAsync("/");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        var doc  = JsonDocument.Parse(body);
        Assert.Equal(ErrorCodes.Unauthorized, doc.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task GenericException_Returns500_WithInternalErrorCode()
    {
        using var host = BuildHost(_ => throw new Exception("Something went wrong."));
        await host.StartAsync();
        var client = host.GetTestClient();

        var response = await client.GetAsync("/");

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        var doc  = JsonDocument.Parse(body);
        Assert.Equal(ErrorCodes.InternalError, doc.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task GenericException_DoesNotExposeStackTrace()
    {
        using var host = BuildHost(_ => throw new Exception("internal detail: secret stack"));
        await host.StartAsync();
        var client = host.GetTestClient();

        var response = await client.GetAsync("/");
        var body = await response.Content.ReadAsStringAsync();

        Assert.DoesNotContain("secret stack", body);
        Assert.DoesNotContain("StackTrace", body);
    }

    [Fact]
    public async Task ConflictException_Returns409_WithConflictCode()
    {
        // CR-021: use DomainConflictException (not InvalidOperationException with magic string)
        using var host = BuildHost(_ => throw new BeautyCareClinic.Domain.Exceptions.DomainConflictException("כפילות שם"));
        await host.StartAsync();
        var client = host.GetTestClient();

        var response = await client.GetAsync("/");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        var doc  = JsonDocument.Parse(body);
        Assert.Equal(ErrorCodes.Conflict, doc.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task ErrorResponse_HasTimestampAndTraceId()
    {
        using var host = BuildHost(_ => throw new Exception("error"));
        await host.StartAsync();
        var client = host.GetTestClient();

        var response = await client.GetAsync("/");
        var body = await response.Content.ReadAsStringAsync();
        var doc  = JsonDocument.Parse(body);

        Assert.True(doc.RootElement.TryGetProperty("timestamp", out _));
        Assert.True(doc.RootElement.TryGetProperty("traceId", out _));
    }

    [Fact]
    public async Task KeyNotFoundException_Returns_StaticClientMessage_NotInternalDetails()
    {
        const string internalDetail = "Customer with id=abc123 and account=xyz";
        using var host = BuildHost(_ => throw new KeyNotFoundException(internalDetail));
        await host.StartAsync();
        var client = host.GetTestClient();

        var response = await client.GetAsync("/");
        var body = await response.Content.ReadAsStringAsync();
        var doc  = JsonDocument.Parse(body);

        var message = doc.RootElement.GetProperty("message").GetString();
        Assert.Equal("The requested resource was not found.", message);
        Assert.DoesNotContain(internalDetail, body);
    }

    [Fact]
    public async Task DomainConflictException_Returns409WithDomainMessage()
    {
        // CR-021: DomainConflictException is now a typed exception caught explicitly.
        // The old InvalidOperationException with ".Contains(CONFLICT)" magic-string check has been removed.
        const string domainMessage = "לא ניתן למחוק — קיימים תשלומים";
        using var host = BuildHost(_ => throw new BeautyCareClinic.Domain.Exceptions.DomainConflictException(domainMessage));
        await host.StartAsync();
        var client = host.GetTestClient();

        var response = await client.GetAsync("/");
        Assert.Equal(System.Net.HttpStatusCode.Conflict, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        var doc  = JsonDocument.Parse(body);

        var message = doc.RootElement.GetProperty("message").GetString();
        Assert.Equal(domainMessage, message);
    }

    [Fact]
    public async Task InvalidOperationException_WithConflictText_Returns500_NotLeakingDetails()
    {
        // After CR-021 removal of magic-string check: InvalidOperationException goes to 500
        const string internalDetail = "CONFLICT: record with internal-id=9876 already exists in table xyz";
        using var host = BuildHost(_ => throw new InvalidOperationException(internalDetail));
        await host.StartAsync();
        var client = host.GetTestClient();

        var response = await client.GetAsync("/");
        // Now falls through to InternalServerError (no magic-string check)
        Assert.Equal(System.Net.HttpStatusCode.InternalServerError, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        // Client does not see internal details
        Assert.DoesNotContain("internal-id=9876", body);
        Assert.DoesNotContain("table xyz", body);
    }
}

public class SecurityHeadersMiddlewareTests
{
    [Fact]
    public async Task SecurityHeaders_AreAddedToResponse()
    {
        using var host = new HostBuilder()
            .ConfigureWebHost(webBuilder =>
            {
                webBuilder.UseTestServer();
                webBuilder.ConfigureServices(s => s.AddLogging());
                webBuilder.Configure(app =>
                {
                    app.UseMiddleware<SecurityHeadersMiddleware>();
                    app.Run(ctx => Task.CompletedTask);
                });
            })
            .Build();

        await host.StartAsync();
        var client   = host.GetTestClient();
        var response = await client.GetAsync("/");

        Assert.Equal("nosniff",                      response.Headers.GetValues("X-Content-Type-Options").First());
        Assert.Equal("DENY",                         response.Headers.GetValues("X-Frame-Options").First());
        Assert.Equal("strict-origin-when-cross-origin", response.Headers.GetValues("Referrer-Policy").First());
    }
}
