using BeautyCareClinic.Domain.Entities;

namespace BeautyCareClinic.Application.Interfaces;

public interface IGlobalSettingsRepository
{
    Task<IEnumerable<GlobalSetting>> GetAllAsync();
    Task<GlobalSetting?> GetByNameAsync(string name);
    Task<GlobalSetting> UpdateAsync(GlobalSetting setting);
}
