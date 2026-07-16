using System.Security.Claims;
using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Enums;
using Microsoft.AspNetCore.Http;

namespace BeautyCareClinic.Infrastructure.Services;

/// <summary>
/// Reads the authenticated user identity from the current HTTP context.
/// Resolves CR-008: therapistId always comes from the server-validated JWT, never from the client.
/// </summary>
public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public Guid GetCurrentUserId()
    {
        var sub = _httpContextAccessor.HttpContext?.User
            .FindFirstValue(ClaimTypes.NameIdentifier)
            ?? _httpContextAccessor.HttpContext?.User
            .FindFirstValue("sub");

        if (string.IsNullOrEmpty(sub) || !Guid.TryParse(sub, out var id))
            throw new UnauthorizedAccessException("No authenticated user found.");

        return id;
    }

    public UserRole GetCurrentUserRole()
    {
        var role = _httpContextAccessor.HttpContext?.User
            .FindFirstValue(ClaimTypes.Role);

        if (string.IsNullOrEmpty(role) || !Enum.TryParse<UserRole>(role, out var parsed))
            throw new UnauthorizedAccessException("No role claim found.");

        return parsed;
    }

    public bool IsManager() => GetCurrentUserRole() == UserRole.Manager;
}
