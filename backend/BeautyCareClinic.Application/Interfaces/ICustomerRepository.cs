using BeautyCareClinic.Domain.Entities;

namespace BeautyCareClinic.Application.Interfaces;

public interface ICustomerRepository
{
    Task<IEnumerable<Customer>> GetAllAsync(string? search = null);
    Task<Customer?> GetByIdAsync(Guid id);
    Task<Customer> CreateAsync(Customer customer);
    Task<Customer> UpdateAsync(Customer customer);
    Task DeleteAsync(Guid id);
    Task<bool> HasRelatedDataAsync(Guid id);
}
