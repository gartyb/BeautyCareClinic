using BeautyCareClinic.Domain.Entities;

namespace BeautyCareClinic.Application.Interfaces;

public interface ITreatmentTypeRepository
{
    Task<IEnumerable<TreatmentType>> GetAllAsync();
    Task<TreatmentType?> GetByIdAsync(Guid id);
    Task<bool> ExistsByNameAsync(string name, Guid? excludeId = null);
    Task<TreatmentType> CreateAsync(TreatmentType treatmentType);
    Task<TreatmentType> UpdateAsync(TreatmentType treatmentType);
    Task DeleteAsync(Guid id);
    Task<bool> HasRelatedDataAsync(Guid id);
}
