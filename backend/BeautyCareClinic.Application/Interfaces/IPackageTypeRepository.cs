using BeautyCareClinic.Domain.Entities;

namespace BeautyCareClinic.Application.Interfaces;

public interface IPackageTypeRepository
{
    Task<List<PackageType>> GetAllAsync();
    Task<PackageType?> GetByIdAsync(Guid id);
    Task<bool> ExistsByNameAsync(string name, Guid? excludeId = null);
    Task<PackageType> AddAsync(PackageType packageType);
    Task<PackageType> UpdateAsync(PackageType packageType);
    Task DeleteAsync(PackageType packageType);
    Task<bool> HasOrderItemsAsync(Guid packageTypeId);
}
