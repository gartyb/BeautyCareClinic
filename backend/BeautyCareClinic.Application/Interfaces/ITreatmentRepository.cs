using BeautyCareClinic.Domain.Entities;

namespace BeautyCareClinic.Application.Interfaces;

public interface ITreatmentRepository
{
    Task<Treatment?> GetByIdAsync(Guid id);
    Task<List<Treatment>> ListByCustomerAsync(Guid customerId);
    Task AddAsync(Treatment treatment);
    Task UpdateAsync(Treatment treatment);
    Task DeleteAsync(Treatment treatment);
}
