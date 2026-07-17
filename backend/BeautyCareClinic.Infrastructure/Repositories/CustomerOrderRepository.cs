using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace BeautyCareClinic.Infrastructure.Repositories;

public class CustomerOrderRepository : ICustomerOrderRepository
{
    private readonly AppDbContext _context;

    public CustomerOrderRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<CustomerOrder>> GetByCustomerIdAsync(Guid customerId)
    {
        return await _context.CustomerOrders
            .Include(o => o.Items)
                .ThenInclude(i => i.PackageType)
            .Include(o => o.Items)
                .ThenInclude(i => i.TreatmentSeries)
            .Where(o => o.CustomerId == customerId)
            .OrderByDescending(o => o.OrderDate)
            .ToListAsync();
    }

    public async Task<CustomerOrder?> GetByIdWithDetailsAsync(Guid id)
    {
        return await _context.CustomerOrders
            .Include(o => o.Items)
                .ThenInclude(i => i.PackageType)
            .Include(o => o.Items)
                .ThenInclude(i => i.TreatmentSeries)
            .Include(o => o.Payments)
            .FirstOrDefaultAsync(o => o.Id == id);
    }

    public async Task<CustomerOrder> AddAsync(CustomerOrder order)
    {
        _context.CustomerOrders.Add(order);
        await _context.SaveChangesAsync();
        return order;
    }

    public async Task<CustomerOrder> UpdateAsync(CustomerOrder order)
    {
        _context.CustomerOrders.Update(order);
        await _context.SaveChangesAsync();
        return order;
    }

    public async Task DeleteAsync(CustomerOrder order)
    {
        _context.CustomerOrders.Remove(order);
        await _context.SaveChangesAsync();
    }

    public async Task<bool> HasDependentDataAsync(Guid orderId)
    {
        // (1) any payments on this order
        if (await _context.Payments.AnyAsync(p => p.OrderId == orderId))
            return true;

        // (2) any treatment series linked to items of this order
        var seriesIds = await _context.OrderItems
            .Where(oi => oi.OrderId == orderId)
            .Join(_context.TreatmentSeries, oi => oi.Id, ts => ts.OrderItemId, (oi, ts) => ts.Id)
            .ToListAsync();

        if (!seriesIds.Any())
            return false;

        // (3) any treatments recorded against those series
        return await _context.Treatments.AnyAsync(t => t.TreatmentSeriesId != null && seriesIds.Contains(t.TreatmentSeriesId.Value));
    }

    public async Task<int> GetPaymentCountAsync(Guid orderId)
    {
        return await _context.Payments.CountAsync(p => p.OrderId == orderId);
    }

    public async Task<Dictionary<Guid, int>> GetPaymentCountsByOrderIdsAsync(IEnumerable<Guid> orderIds)
    {
        return await _context.Payments
            .Where(p => orderIds.Contains(p.OrderId))
            .GroupBy(p => p.OrderId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);
    }
}
