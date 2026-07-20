using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Domain.Enums;

namespace BeautyCareClinic.Application.Interfaces;

public interface IUserRepository
{
    Task<IEnumerable<User>> GetAllAsync(UserRole? role = null);
    Task<User?> GetByIdAsync(Guid id);
    Task<User?> GetByEmailAsync(string email);
    Task<User> CreateAsync(User user);
    Task<User> UpdateAsync(User user);
    Task DeleteAsync(Guid id);

    /// <summary>
    /// Phase 012 — true if the user has any Appointment/Treatment/Note referencing them (FK-restrict
    /// targets). Used by UsersController.Delete to surface a clean Hebrew 409 instead of letting a
    /// raw Postgres FK-violation exception reach the client as a 500.
    /// </summary>
    Task<bool> HasRelatedDataAsync(Guid id);
}
