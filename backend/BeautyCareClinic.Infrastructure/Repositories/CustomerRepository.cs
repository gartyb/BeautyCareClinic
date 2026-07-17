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
}
