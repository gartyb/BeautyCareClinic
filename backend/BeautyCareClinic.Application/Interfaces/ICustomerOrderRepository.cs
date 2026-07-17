using BeautyCareClinic.Domain.Entities;

namespace BeautyCareClinic.Application.Interfaces;

public interface ICustomerOrderRepository
{
    Task<List<CustomerOrder>> GetByCustomerIdAsync(Guid customerId);
    /// <summary>Includes Items (with PackageType), Series, and Payments.</summary>
    Task<CustomerOrder?> GetByIdWithDetailsAsync(Guid id);
    Task<CustomerOrder> AddAsync(CustomerOrder order);
    Task<CustomerOrder> UpdateAsync(CustomerOrder order);
    Task DeleteAsync(CustomerOrder order);
    /// <summary>
    /// Checks for dependant data via 3 roundtrips:
    /// (1) payments on the order, (2) treatment series under order items,
    /// (3) treatments recorded against those series.
    /// </summary>
    Task<bool> HasDependentDataAsync(Guid orderId);
    Task<int> GetPaymentCountAsync(Guid orderId);
    Task<Dictionary<Guid, int>> GetPaymentCountsByOrderIdsAsync(IEnumerable<Guid> orderIds);
}
