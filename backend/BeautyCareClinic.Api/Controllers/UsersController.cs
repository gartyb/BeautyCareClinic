using System.Security.Claims;
using BeautyCareClinic.Application.DTOs;
using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Domain.Enums;
using BeautyCareClinic.Infrastructure.Data;
using BeautyCareClinic.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace BeautyCareClinic.Api.Controllers;

[ApiController]
[Route("api/v1/users")]
[Authorize(Policy = "Manager")]
public class UsersController : ControllerBase
{
    private readonly IUserRepository _userRepository;
    private readonly UserManager<AppUser> _userManager;
    private readonly AppDbContext _dbContext;

    public UsersController(
        IUserRepository userRepository,
        UserManager<AppUser> userManager,
        AppDbContext dbContext)
    {
        _userRepository = userRepository;
        _userManager    = userManager;
        _dbContext      = dbContext;
    }

    /// <summary>GET /api/v1/users?role= — Manager only.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? role)
    {
        UserRole? roleFilter = null;
        if (!string.IsNullOrWhiteSpace(role) && Enum.TryParse<UserRole>(role, ignoreCase: true, out var parsed))
            roleFilter = parsed;

        var users = await _userRepository.GetAllAsync(roleFilter);
        return Ok(users.Select(u => new UserDto(u.Id, u.FullName, u.Email, u.Role.ToString(), u.Phone)));
    }

    /// <summary>GET /api/v1/users/{id} — Manager only.</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var user = await _userRepository.GetByIdAsync(id);
        if (user == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "The requested resource was not found.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        return Ok(new UserDto(user.Id, user.FullName, user.Email, user.Role.ToString(), user.Phone));
    }

    /// <summary>
    /// POST /api/v1/users — Manager only.
    /// Creates a Therapist account. Creating a Manager is rejected.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.FullName))
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "FullName is required.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "Email is required.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (!IsValidEmail(request.Email))
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "Email is not valid.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "Password is required.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var existingUser = await _userRepository.GetByEmailAsync(normalizedEmail);
        if (existingUser != null)
            return Conflict(new ErrorResponse(ErrorCodes.Conflict, "A user with this email already exists.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var id = Guid.NewGuid();

        var domainUser = new User
        {
            Id       = id,
            FullName = request.FullName.Trim(),
            Email    = normalizedEmail,
            Role     = UserRole.Therapist,  // Only Therapists can be created via API
            Phone    = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim()
        };

        var appUser = new AppUser
        {
            Id                 = id,
            UserName           = normalizedEmail,
            Email              = normalizedEmail,
            NormalizedUserName = normalizedEmail.ToUpperInvariant(),
            NormalizedEmail    = normalizedEmail.ToUpperInvariant(),
            EmailConfirmed     = true
        };

        await using var transaction = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            var result = await _userManager.CreateAsync(appUser, request.Password);
            if (!result.Succeeded)
            {
                await transaction.RollbackAsync();
                var errors = string.Join("; ", result.Errors.Select(e => e.Description));
                return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, errors, DateTime.UtcNow, HttpContext.TraceIdentifier));
            }

            var created = await _userRepository.CreateAsync(domainUser);
            await transaction.CommitAsync();

            return CreatedAtAction(nameof(GetById), new { id = created.Id },
                new UserDto(created.Id, created.FullName, created.Email, created.Role.ToString(), created.Phone));
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    /// <summary>
    /// PUT /api/v1/users/{id} — Manager only.
    /// Updates FullName and Email only. Role and password are not changed here.
    /// </summary>
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUserRequest request)
    {
        var existing = await _userRepository.GetByIdAsync(id);
        if (existing == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "The requested resource was not found.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (string.IsNullOrWhiteSpace(request.FullName))
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "FullName is required.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "Email is required.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (!IsValidEmail(request.Email))
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "Email is not valid.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        // Check for email conflict with another user
        var conflicting = await _userRepository.GetByEmailAsync(normalizedEmail);
        if (conflicting != null && conflicting.Id != id)
            return Conflict(new ErrorResponse(ErrorCodes.Conflict, "Email is already in use by another user.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        existing.FullName = request.FullName.Trim();
        existing.Email    = normalizedEmail;
        existing.Phone    = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();

        await using var transaction = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            // Update domain user first so FK/domain constraints fire before Identity record is touched
            var updated = await _userRepository.UpdateAsync(existing);

            // Sync Identity user email
            var appUser = await _userManager.FindByIdAsync(id.ToString());
            if (appUser == null)
            {
                // A missing AppUser for an existing domain User is always a consistency bug
                await transaction.RollbackAsync();
                return StatusCode(StatusCodes.Status500InternalServerError,
                    new ErrorResponse(ErrorCodes.InternalError, "An unexpected error occurred.", DateTime.UtcNow, HttpContext.TraceIdentifier));
            }

            appUser.Email              = normalizedEmail;
            appUser.UserName           = normalizedEmail;
            appUser.NormalizedEmail    = normalizedEmail.ToUpperInvariant();
            appUser.NormalizedUserName = normalizedEmail.ToUpperInvariant();

            var result = await _userManager.UpdateAsync(appUser);
            if (!result.Succeeded)
            {
                await transaction.RollbackAsync();
                var errors = string.Join("; ", result.Errors.Select(e => e.Description));
                return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, errors, DateTime.UtcNow, HttpContext.TraceIdentifier));
            }

            await transaction.CommitAsync();
            return Ok(new UserDto(updated.Id, updated.FullName, updated.Email, updated.Role.ToString(), updated.Phone));
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    /// <summary>
    /// DELETE /api/v1/users/{id} — Manager only.
    /// A manager cannot delete their own account.
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        // Prevent self-deletion
        var subClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");
        if (Guid.TryParse(subClaim, out var currentUserId) && currentUserId == id)
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "You cannot delete your own account.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var existing = await _userRepository.GetByIdAsync(id);
        if (existing == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "The requested resource was not found.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        await using var transaction = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            // Delete domain user first so FK constraints fire before Identity record is removed
            await _userRepository.DeleteAsync(id);

            var appUser = await _userManager.FindByIdAsync(id.ToString());
            if (appUser != null)
                await _userManager.DeleteAsync(appUser);

            await transaction.CommitAsync();
            return NoContent();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    private static bool IsValidEmail(string email)
    {
        try
        {
            var addr = new System.Net.Mail.MailAddress(email);
            return addr.Address == email.Trim();
        }
        catch
        {
            return false;
        }
    }
}
