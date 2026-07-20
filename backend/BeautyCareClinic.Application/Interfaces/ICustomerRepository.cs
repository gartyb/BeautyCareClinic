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

    /// <summary>
    /// Computes, for each requested customer id, the active-series count (same definition as
    /// <see cref="ITreatmentSeriesRepository.GetActiveByCustomerIdAsync"/>) and the outstanding
    /// balance (sum of <c>RemainingBalance</c> across all of the customer's orders), in a single
    /// aggregate query per metric (no per-customer N+1). Customer ids with no series are still
    /// present in the result with ActiveSeriesCount 0. OutstandingBalance is <c>null</c> when the
    /// customer has no orders at all (never bought anything), <c>0m</c> when the customer has
    /// orders that are all fully paid off, and a positive amount when a real debt exists.
    /// </summary>
    Task<Dictionary<Guid, (int ActiveSeriesCount, decimal? OutstandingBalance)>> GetAggregatesAsync(IEnumerable<Guid> customerIds);
}
