using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace BeautyCareClinic.Infrastructure.Repositories;

public class TreatmentSeriesRepository : ITreatmentSeriesRepository
{
    private readonly AppDbContext _context;

    public TreatmentSeriesRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<TreatmentSeries>> GetActiveByCustomerIdAsync(Guid customerId)
    {
        // Get all series for the customer's order items, then filter active ones
        return await _context.TreatmentSeries
            .Include(ts => ts.OrderItem)
                .ThenInclude(oi => oi.PackageType)
            .Where(ts => ts.OrderItem.Order.CustomerId == customerId)
            .Where(ts =>
                // Quantity-based: completed < total
                (!ts.OrderItem.PackageType.IsTimerBased && ts.CompletedTreatments < ts.TotalTreatments) ||
                // Timer-based: used < total
                (ts.OrderItem.PackageType.IsTimerBased && ts.UsedMinutes < ts.TotalMinutes))
            .ToListAsync();
    }

    public async Task<TreatmentSeries?> GetByIdAsync(Guid id)
    {
        return await _context.TreatmentSeries
            .Include(ts => ts.OrderItem)
                .ThenInclude(oi => oi.PackageType)
            .FirstOrDefaultAsync(ts => ts.Id == id);
    }
}
