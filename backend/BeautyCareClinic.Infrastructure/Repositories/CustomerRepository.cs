using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace BeautyCareClinic.Infrastructure.Repositories;

public class CustomerRepository : ICustomerRepository
{
    private readonly AppDbContext _context;

    public CustomerRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<Customer>> GetAllAsync(string? search = null)
    {
        var query = _context.Customers.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            // Escape wildcards so literal % _ \ in the search term are treated as literals.
            // Order matters: escape \ first, then % and _.
            var escaped = search.Trim()
                .Replace("\\", "\\\\")
                .Replace("%",  "\\%")
                .Replace("_",  "\\_");

            var pattern = $"%{escaped}%";

            // Case-insensitive partial match on FullName or Phone using ESCAPE clause
            query = query.Where(c =>
                EF.Functions.ILike(c.FullName, pattern, "\\") ||
                EF.Functions.ILike(c.Phone,    pattern, "\\"));
        }

        return await query
            .OrderBy(c => c.FullName)
            .ToListAsync();
    }

    public async Task<Customer?> GetByIdAsync(Guid id)
    {
        return await _context.Customers.FindAsync(id);
    }

    public async Task<Customer> CreateAsync(Customer customer)
    {
        _context.Customers.Add(customer);
        await _context.SaveChangesAsync();
        return customer;
    }

    public async Task<Customer> UpdateAsync(Customer customer)
    {
        _context.Customers.Update(customer);
        await _context.SaveChangesAsync();
        return customer;
    }

    public async Task DeleteAsync(Guid id)
    {
        var customer = await _context.Customers.FindAsync(id)
            ?? throw new KeyNotFoundException($"Customer {id} not found.");
        _context.Customers.Remove(customer);
        await _context.SaveChangesAsync();
    }

    public async Task<bool> HasRelatedDataAsync(Guid id)
    {
        return await _context.CustomerOrders.AnyAsync(o => o.CustomerId == id)
            || await _context.Appointments.AnyAsync(a => a.CustomerId == id)
            || await _context.Treatments.AnyAsync(t => t.CustomerId == id)
            || await _context.Notes.AnyAsync(n => n.CustomerId == id);
    }

    public async Task<Dictionary<Guid, (int ActiveSeriesCount, decimal? OutstandingBalance)>> GetAggregatesAsync(IEnumerable<Guid> customerIds)
    {
        var ids = customerIds.ToList();

        // Same "active series" definition as TreatmentSeriesRepository.GetActiveByCustomerIdAsync.
        var seriesCounts = await _context.TreatmentSeries
            .Where(ts => ids.Contains(ts.CustomerId))
            .Where(ts =>
                (!ts.OrderItem.PackageType.IsTimerBased && ts.CompletedTreatments < ts.TotalTreatments) ||
                (ts.OrderItem.PackageType.IsTimerBased && ts.UsedMinutes < ts.TotalMinutes))
            .GroupBy(ts => ts.CustomerId)
            .Select(g => new { CustomerId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.CustomerId, x => x.Count);

        var balances = await _context.CustomerOrders
            .Where(o => ids.Contains(o.CustomerId))
            .GroupBy(o => o.CustomerId)
            .Select(g => new { CustomerId = g.Key, Balance = g.Sum(o => o.RemainingBalance) })
            .ToDictionaryAsync(x => x.CustomerId, x => x.Balance);

        return ids.Distinct().ToDictionary(id => id, id => (
            seriesCounts.GetValueOrDefault(id, 0),
            balances.TryGetValue(id, out var bal) ? bal : (decimal?)null));
    }
}
