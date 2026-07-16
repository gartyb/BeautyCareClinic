using System.Net;
using System.Text.Json;
using BeautyCareClinic.Application.DTOs;

namespace BeautyCareClinic.Api.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next   = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var (statusCode, errorCode, clientMessage) = exception switch
        {
            KeyNotFoundException =>
                (HttpStatusCode.NotFound, ErrorCodes.NotFound, "The requested resource was not found."),

            UnauthorizedAccessException =>
                (HttpStatusCode.Unauthorized, ErrorCodes.Unauthorized, "Unauthorized."),

            InvalidOperationException e when e.Message.Contains("CONFLICT") =>
                (HttpStatusCode.Conflict, ErrorCodes.Conflict, "The operation conflicts with existing data."),

            _ =>
                (HttpStatusCode.InternalServerError, ErrorCodes.InternalError, "An unexpected error occurred.")
        };

        // Log with appropriate severity — internal details stay server-side only
        if (statusCode == HttpStatusCode.InternalServerError)
            _logger.LogError(exception, "Unhandled exception on {Method} {Path}: {Message}",
                context.Request.Method, context.Request.Path, exception.Message);
        else
            _logger.LogWarning("Handled exception ({Type}) on {Method} {Path}: {Message}",
                exception.GetType().Name, context.Request.Method, context.Request.Path, exception.Message);

        var response = new ErrorResponse(
            Code:      errorCode,
            Message:   clientMessage,
            Timestamp: DateTime.UtcNow,
            TraceId:   context.TraceIdentifier);

        context.Response.StatusCode  = (int)statusCode;
        context.Response.ContentType = "application/json";

        var json = JsonSerializer.Serialize(response, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        await context.Response.WriteAsync(json);
    }
}
