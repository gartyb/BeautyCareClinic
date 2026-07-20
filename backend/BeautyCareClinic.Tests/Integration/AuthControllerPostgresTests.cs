using BeautyCareClinic.Api;
using BeautyCareClinic.Api.Controllers;
using BeautyCareClinic.Application.DTOs;
using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Domain.Enums;
using BeautyCareClinic.Infrastructure.Data;
using BeautyCareClinic.Infrastructure.Identity;
using BeautyCareClinic.Infrastructure.Repositories;
using BeautyCareClinic.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BeautyCareClinic.Tests.Integration;

/// <summary>
/// Phase 012 Decision 6 / RC-4 — real-controller coverage for <see cref="AuthController.Login"/>
/// rejecting a deactivated (IsActive=false) user's login, against a real Npgsql-backed
/// <see cref="AppDbContext"/> + a real ASP.NET Identity <see cref="UserManager{TUser}"/> stack (the
/// password check itself must genuinely succeed before the IsActive gate is reached, to prove this
/// is not just "any login fails" — a mocked UserManager could not exercise that).
///
/// Requires a reachable Postgres instance via the ConnectionStrings__DefaultConnection env var
/// (same variable used by the EF CLI tooling — see DesignTimeDbContextFactory.cs).
/// </summary>
public class AuthControllerPostgresTests : IAsyncLifetime
{
    private const string Password = "TestPass@2026";

    private ServiceProvider _provider = null!;
    private AppDbContext _context = null!;
    private UserManager<AppUser> _userManager = null!;
    private IConfiguration _configuration = null!;
    private readonly List<Guid> _createdUserIds = new();

    public async Task InitializeAsync()
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? throw new InvalidOperationException(
                "Set env var ConnectionStrings__DefaultConnection to a reachable Postgres instance " +
                "to run AuthControllerPostgresTests (same variable used by the EF CLI tooling — " +
                "see DesignTimeDbContextFactory.cs).");

        var services = new ServiceCollection();
        services.AddDbContext<AppDbContext>(o => o.UseNpgsql(connectionString));
        services.AddLogging();
        services.AddIdentity<AppUser, IdentityRole<Guid>>(options =>
            {
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireNonAlphanumeric = true;
                options.Password.RequiredLength = 8;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
                options.Lockout.AllowedForNewUsers = true;
            })
            .AddEntityFrameworkStores<AppDbContext>()
            .AddDefaultTokenProviders();

        _configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:Secret"] = "auth-test-secret-auth-test-secret-auth-test-secret-1234567890",
            ["Jwt:Issuer"] = "auth-test-issuer",
            ["Jwt:Audience"] = "auth-test-audience",
            ["Jwt:ExpiresInHours"] = "24",
        }).Build();

        _provider = services.BuildServiceProvider();
        var scope = _provider.CreateScope();
        _context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        _userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();

        await _context.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        foreach (var userId in _createdUserIds)
        {
            var appUser = await _userManager.FindByIdAsync(userId.ToString());
            if (appUser != null) await _userManager.DeleteAsync(appUser);

            var domainUser = await _context.Users.FindAsync(userId);
            if (domainUser != null) _context.Users.Remove(domainUser);
        }
        await _context.SaveChangesAsync();
        await _context.DisposeAsync();
        await _provider.DisposeAsync();
    }

    private async Task<(User Domain, string Email)> CreateTherapistAsync(string tag, bool isActive)
    {
        var id = Guid.NewGuid();
        var email = $"{tag}-{Guid.NewGuid():N}@test.com";
        var domainUser = new User { Id = id, FullName = "בדיקת התחברות " + tag, Email = email, Role = UserRole.Therapist, IsActive = isActive };
        _context.Users.Add(domainUser);

        var appUser = new AppUser
        {
            Id = id, UserName = email, Email = email,
            NormalizedUserName = email.ToUpperInvariant(), NormalizedEmail = email.ToUpperInvariant(),
            EmailConfirmed = true,
        };
        var result = await _userManager.CreateAsync(appUser, Password);
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join(", ", result.Errors.Select(e => e.Description)));

        await _context.SaveChangesAsync();
        _createdUserIds.Add(id);
        return (domainUser, email);
    }

    private AuthController BuildController()
    {
        var currentUserService = new CurrentUserService(new HttpContextAccessor());
        var userRepository = new UserRepository(_context);
        var jwtService = new JwtService(_configuration);

        var controller = new AuthController(_userManager, _context, jwtService, _configuration, currentUserService, userRepository);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        return controller;
    }

    [Fact]
    public async Task Login_ActiveTherapist_CorrectPassword_Returns200_WithToken()
    {
        var (_, email) = await CreateTherapistAsync("login-active", isActive: true);
        var controller = BuildController();

        var result = await controller.Login(new LoginRequest(email, Password));

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<LoginResponse>(ok.Value);
        Assert.False(string.IsNullOrWhiteSpace(response.AccessToken));
        Assert.True(response.User.IsActive);
    }

    /// <summary>
    /// Decision 6 / RC-4 — the password is genuinely correct (proves this isn't a generic
    /// "any login fails" test) but the domain User.IsActive=false blocks the login, with the SAME
    /// 401 response shape as an unknown-email/wrong-password login (no distinct signal that would
    /// leak "this account exists but is deactivated").
    /// </summary>
    [Fact]
    public async Task Login_InactiveTherapist_CorrectPassword_Returns401_SameShapeAsInvalidCredentials()
    {
        var (_, email) = await CreateTherapistAsync("login-inactive", isActive: false);
        var controller = BuildController();

        var result = await controller.Login(new LoginRequest(email, Password));

        var unauthorized = Assert.IsType<UnauthorizedObjectResult>(result);
        var error = Assert.IsType<ErrorResponse>(unauthorized.Value);
        Assert.Equal(ErrorCodes.Unauthorized, error.Code);
        Assert.Equal("Invalid credentials.", error.Message);

        // Compare directly against the unknown-email rejection shape to prove it's identical.
        var unknownEmailResult = await controller.Login(new LoginRequest($"nobody-{Guid.NewGuid():N}@test.com", Password));
        var unknownEmailUnauthorized = Assert.IsType<UnauthorizedObjectResult>(unknownEmailResult);
        var unknownEmailError = Assert.IsType<ErrorResponse>(unknownEmailUnauthorized.Value);
        Assert.Equal(error.Code, unknownEmailError.Code);
        Assert.Equal(error.Message, unknownEmailError.Message);
    }

    [Fact]
    public async Task Login_InactiveTherapist_WrongPassword_Returns401_SameShapeAsCorrectPasswordInactiveCase()
    {
        var (_, email) = await CreateTherapistAsync("login-inactive-wrongpw", isActive: false);
        var controller = BuildController();

        var result = await controller.Login(new LoginRequest(email, "WrongPassword@1"));

        var unauthorized = Assert.IsType<UnauthorizedObjectResult>(result);
        var error = Assert.IsType<ErrorResponse>(unauthorized.Value);
        Assert.Equal(ErrorCodes.Unauthorized, error.Code);
        Assert.Equal("Invalid credentials.", error.Message);
    }
}
