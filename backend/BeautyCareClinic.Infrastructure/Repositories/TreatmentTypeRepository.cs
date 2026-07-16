using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace BeautyCareClinic.Infrastructure.Repositories;

public class TreatmentTypeRepository : ITreatmentTypeRepository
{
    private readonly AppDbContext _context;

    public TreatmentTypeRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<TreatmentType>> GetAllAsync()
    {
        return await _context.TreatmentTypes
            .OrderBy(t => t.Name)
            .ToListAsync();
    }

    public async Task<TreatmentType?> GetByIdAsync(Guid id)
    {
        return await _context.TreatmentTypes.FindAsync(id);
    }

    public async Task<bool> ExistsByNameAsync(string name, Guid? excludeId = null)
    {
        var query = _context.TreatmentTypes
            .Where(t => EF.Functions.ILike(t.Name, name));

        if (excludeId.HasValue)
            query = query.Where(t => t.Id != excludeId.Value);

        return await query.AnyAsync();
    }

    public async Task<TreatmentType> CreateAsync(TreatmentType treatmentType)
    {
        _context.TreatmentTypes.Add(treatmentType);
        await _context.SaveChangesAsync();
        return treatmentType;
    }

    public async Task<TreatmentType> UpdateAsync(TreatmentType treatmentType)
    {
        _context.TreatmentTypes.Update(treatmentType);
        await _context.SaveChangesAsync();
        return treatmentType;
    }

    public async Task DeleteAsync(Guid id)
    {
        var treatmentType = await _context.TreatmentTypes.FindAsync(id)
            ?? throw new KeyNotFoundException($"TreatmentType {id} not found.");
        _context.TreatmentTypes.Remove(treatmentType);
        await _context.SaveChangesAsync();
    }

    public async Task<bool> HasRelatedDataAsync(Guid id)
    {
        return await _context.PackageTypes.AnyAsync(p => p.TreatmentTypeId == id)
            || await _context.Appointments.AnyAsync(a => a.TreatmentTypeId == id)
            || await _context.Treatments.AnyAsync(t => t.TreatmentTypeId == id)
            || await _context.Notes.AnyAsync(n => n.TreatmentTypeId == id)
            || await _context.TherapistCapabilities.AnyAsync(c => c.TreatmentTypeId == id);
    }
}
