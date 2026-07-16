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
}
