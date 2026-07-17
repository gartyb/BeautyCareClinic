using BeautyCareClinic.Application.DTOs;
using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Infrastructure.Data;
using BeautyCareClinic.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace BeautyCareClinic.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class AuthController : ControllerBase
{
    private readonly UserManager<AppUser> _userManager;
    private readonly AppDbContext _context;
    private readonly IJwtService _jwtService;
    private readonly IConfiguration _configuration;
    private readonly ICurrentUserService _currentUserService;
    private readonly IUserRepository _userRepository;

    public AuthController(
        UserManager<AppUser> userManager,
        AppDbContext context,
        IJwtService jwtService,
        IConfiguration configuration,
        ICurrentUserService currentUserService,
        IUserRepository userRepository)
    {
        _userManager        = userManager;
        _context            = context;
        _jwtService         = jwtService;
        _configuration      = configuration;
        _currentUserService = currentUserService;
        _userRepository     = userRepository;
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

        // Check lockout before attempting password (avoid wasting a hash comparison when already locked)
        if (await _userManager.IsLockedOutAsync(appUser))
            return StatusCode(StatusCodes.Status429TooManyRequests,
                new ErrorResponse(ErrorCodes.AccountLocked, "Account temporarily locked due to multiple failed login attempts.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        // Use UserManager directly — SignInManager.CheckPasswordSignInAsync does not reliably persist
        // AccessFailedCount in JWT-only API contexts where the cookie auth scheme is absent.
        if (!await _userManager.CheckPasswordAsync(appUser, request.Password))
        {
            await _userManager.AccessFailedAsync(appUser);
            if (await _userManager.IsLockedOutAsync(appUser))
                return StatusCode(StatusCodes.Status429TooManyRequests,
                    new ErrorResponse(ErrorCodes.AccountLocked, "Account temporarily locked due to multiple failed login attempts.", DateTime.UtcNow, HttpContext.TraceIdentifier));
            return Unauthorized(new ErrorResponse(ErrorCodes.Unauthorized, "Invalid credentials.", DateTime.UtcNow, HttpContext.TraceIdentifier));
        }

        await _userManager.ResetAccessFailedCountAsync(appUser);

        // Load the Domain User by the same shared Id
        var domainUser = await _context.Users.FindAsync(appUser.Id);
        if (domainUser == null)
            return Unauthorized(new ErrorResponse(ErrorCodes.Unauthorized, "User account is incomplete.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var token     = _jwtService.GenerateToken(domainUser);
        var expiresIn = _configuration.GetValue<int>("Jwt:ExpiresInHours", 24) * 3600;

        var userDto = new UserDto(domainUser.Id, domainUser.FullName, domainUser.Email, domainUser.Role.ToString(), domainUser.Phone);
        return Ok(new LoginResponse(token, expiresIn, userDto));
    }

    /// <summary>GET /api/v1/auth/me — Returns the currently authenticated user.</summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        // CR-025: use ICurrentUserService instead of reading claims directly
        Guid userId;
        try
        {
            userId = _currentUserService.GetCurrentUserId();
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized(new ErrorResponse(ErrorCodes.Unauthorized, "Invalid token.", DateTime.UtcNow, HttpContext.TraceIdentifier));
        }

        var domainUser = await _userRepository.GetByIdAsync(userId);
        if (domainUser == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "User not found.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        return Ok(new UserDto(domainUser.Id, domainUser.FullName, domainUser.Email, domainUser.Role.ToString(), domainUser.Phone));
    }
}
