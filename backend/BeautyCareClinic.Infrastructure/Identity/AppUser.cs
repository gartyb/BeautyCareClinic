using Microsoft.AspNetCore.Identity;

namespace BeautyCareClinic.Infrastructure.Identity;

/// <summary>
/// ASP.NET Core Identity user.
/// Shares the same Id (Guid) as Domain.User (Strategy B: Domain.User is a plain POCO,
/// AppUser lives in Infrastructure and is never exposed to the Application or Domain layers).
/// </summary>
public class AppUser : IdentityUser<Guid>
{
    // Id, Email, PasswordHash, SecurityStamp, etc. are inherited from IdentityUser<Guid>
}
