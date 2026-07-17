using BeautyCareClinic.Domain.Entities;

namespace BeautyCareClinic.Application.Interfaces;

public interface ITreatmentSeriesRepository
{
    Task<List<TreatmentSeries>> GetActiveByCustomerIdAsync(Guid customerId);
    Task<TreatmentSeries?> GetByIdAsync(Guid id);
}
