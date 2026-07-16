using BeautyCareClinic.Application.DTOs;
using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Infrastructure.Data;
using BeautyCareClinic.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace BeautyCareClinic.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController : ControllerBase
{
    private readonly UserManager<AppUser> _userManager;
    private readonly SignInManager<AppUser> _signInManager;
    private readonly AppDbContext _context;
    private readonly IJwtService _jwtService;

    public AuthController(
        UserManager<AppUser> userManager,
        SignInManager<AppUser> signInManager,
        AppDbContext context,
        IJwtService jwtService)
    {
        _userManager   = userManager;
        _signInManager = signInManager;
        _context       = context;
        _jwtService    = jwtService;
    }

    /// <summary>POST /api/v1/auth/login — No auth required.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "Email is required.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "Password is required.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var appUser = await _userManager.FindByEmailAsync(normalizedEmail);
        if (appUser == null)
            return Unauthorized(new ErrorResponse(ErrorCodes.Unauthorized, "Invalid credentials.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        // Use SignInManager so failed attempts are recorded and lockout is enforced
        var result = await _signInManager.CheckPasswordSignInAsync(appUser, request.Password, lockoutOnFailure: true);

        if (result.IsLockedOut)
            return StatusCode(StatusCodes.Status429TooManyRequests,
                new ErrorResponse(ErrorCodes.AccountLocked, "Account temporarily locked due to multiple failed login attempts.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (!result.Succeeded)
            return Unauthorized(new ErrorResponse(ErrorCodes.Unauthorized, "Invalid credentials.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        // Load the Domain User by the same shared Id
        var domainUser = await _context.Users.FindAsync(appUser.Id);
        if (domainUser == null)
            return Unauthorized(new ErrorResponse(ErrorCodes.Unauthorized, "User account is incomplete.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var token    = _jwtService.GenerateToken(domainUser);
        var expiresIn = int.Parse(HttpContext.RequestServices
            .GetRequiredService<IConfiguration>()["Jwt:ExpiresInHours"] ?? "24") * 3600;

        var userDto = new UserDto(domainUser.Id, domainUser.FullName, domainUser.Email, domainUser.Role.ToString());
        return Ok(new LoginResponse(token, expiresIn, userDto));
    }

    /// <summary>GET /api/v1/auth/me — Returns the currently authenticated user.</summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var subClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");

        if (!Guid.TryParse(subClaim, out var userId))
            return Unauthorized(new ErrorResponse(ErrorCodes.Unauthorized, "Invalid token.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var domainUser = await _context.Users.FindAsync(userId);
        if (domainUser == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "User not found.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        return Ok(new UserDto(domainUser.Id, domainUser.FullName, domainUser.Email, domainUser.Role.ToString()));
    }
}
