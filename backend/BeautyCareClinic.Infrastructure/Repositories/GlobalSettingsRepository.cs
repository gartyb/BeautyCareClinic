using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace BeautyCareClinic.Infrastructure.Repositories;

public class GlobalSettingsRepository : IGlobalSettingsRepository
{
    private readonly AppDbContext _context;

    public GlobalSettingsRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<GlobalSetting>> GetAllAsync()
    {
        return await _context.GlobalSettings
            .OrderBy(g => g.Name)
            .ToListAsync();
    }

    public async Task<GlobalSetting?> GetByNameAsync(string name)
    {
        return await _context.GlobalSettings
            .FirstOrDefaultAsync(g => g.Name == name);
    }

    public async Task<GlobalSetting> UpdateAsync(GlobalSetting setting)
    {
        var existing = await _context.GlobalSettings
            .FirstOrDefaultAsync(g => g.Name == setting.Name)
            ?? throw new KeyNotFoundException($"Setting '{setting.Name}' not found.");

        existing.Value = setting.Value;
        await _context.SaveChangesAsync();
        return existing;
    }
}
