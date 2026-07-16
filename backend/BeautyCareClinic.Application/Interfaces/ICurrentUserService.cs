using BeautyCareClinic.Domain.Enums;

namespace BeautyCareClinic.Application.Interfaces;

/// <summary>
/// Provides the identity and role of the currently authenticated user.
/// Resolves CR-008: therapistId must come from the server session, never from the client.
/// </summary>
public interface ICurrentUserService
{
    Guid GetCurrentUserId();
    UserRole GetCurrentUserRole();
    bool IsManager();
}
