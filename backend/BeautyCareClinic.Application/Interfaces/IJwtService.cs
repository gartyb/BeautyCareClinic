using BeautyCareClinic.Domain.Entities;

namespace BeautyCareClinic.Application.Interfaces;

public interface IJwtService
{
    string GenerateToken(User user);
}
