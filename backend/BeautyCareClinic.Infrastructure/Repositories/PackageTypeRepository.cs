using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace BeautyCareClinic.Infrastructure.Repositories;

public class PackageTypeRepository : IPackageTypeRepository
{
    private readonly AppDbContext _context;

    public PackageTypeRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<PackageType>> GetAllAsync()
    {
        return await _context.PackageTypes
            .Include(p => p.TreatmentType)
            .OrderBy(p => p.Name)
            .ToListAsync();
    }

    public async Task<PackageType?> GetByIdAsync(Guid id)
    {
        return await _context.PackageTypes
            .Include(p => p.TreatmentType)
            .FirstOrDefaultAsync(p => p.Id == id);
    }

    public async Task<bool> ExistsByNameAsync(string name, Guid? excludeId = null)
    {
        var trimmed = name.Trim();

        var query = _context.PackageTypes.AsQueryable();
        if (excludeId.HasValue)
            query = query.Where(p => p.Id != excludeId.Value);

        // Use case-insensitive string comparison compatible with both InMemory and PostgreSQL providers.
        // In production the provider will push this to the DB; for tests InMemory evaluates client-side.
        return await query.AnyAsync(p =>
            p.Name.ToLower() == trimmed.ToLower());
    }

    public async Task<PackageType> AddAsync(PackageType packageType)
    {
        _context.PackageTypes.Add(packageType);
        await _context.SaveChangesAsync();
        return packageType;
    }

    public async Task<PackageType> UpdateAsync(PackageType packageType)
    {
        _context.PackageTypes.Update(packageType);
        await _context.SaveChangesAsync();
        return packageType;
    }

    public async Task DeleteAsync(PackageType packageType)
    {
        _context.PackageTypes.Remove(packageType);
        await _context.SaveChangesAsync();
    }

    public async Task<bool> HasOrderItemsAsync(Guid packageTypeId)
    {
        return await _context.OrderItems.AnyAsync(oi => oi.PackageTypeId == packageTypeId);
    }
}
