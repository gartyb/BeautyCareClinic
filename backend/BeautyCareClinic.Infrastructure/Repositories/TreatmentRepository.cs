using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace BeautyCareClinic.Infrastructure.Repositories;

public class TreatmentRepository : ITreatmentRepository
{
    private readonly AppDbContext _context;

    public TreatmentRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Treatment?> GetByIdAsync(Guid id)
    {
        return await _context.Treatments
            .Include(t => t.TreatmentType)
            .FirstOrDefaultAsync(t => t.Id == id);
    }

    public async Task<List<Treatment>> ListByCustomerAsync(Guid customerId)
    {
        return await _context.Treatments
            .Include(t => t.TreatmentType)
            .Where(t => t.CustomerId == customerId)
            .OrderByDescending(t => t.TreatmentDate)
            .ToListAsync();
    }

    public async Task AddAsync(Treatment treatment)
    {
        _context.Treatments.Add(treatment);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Treatment treatment)
    {
        _context.Treatments.Remove(treatment);
        await _context.SaveChangesAsync();
    }
}
