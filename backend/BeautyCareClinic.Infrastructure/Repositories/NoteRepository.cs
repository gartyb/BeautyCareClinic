using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace BeautyCareClinic.Infrastructure.Repositories;

public class NoteRepository : INoteRepository
{
    private readonly AppDbContext _context;

    public NoteRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Note?> GetByIdAsync(Guid id)
    {
        return await _context.Notes
            .Include(n => n.TreatmentType)
            .FirstOrDefaultAsync(n => n.Id == id);
    }

    public async Task<List<Note>> ListByCustomerAsync(Guid customerId)
    {
        return await _context.Notes
            .Include(n => n.TreatmentType)
            .Where(n => n.CustomerId == customerId)
            .OrderByDescending(n => n.NoteDate)
            .ToListAsync();
    }

    public async Task AddAsync(Note note)
    {
        _context.Notes.Add(note);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(Note note)
    {
        _context.Notes.Update(note);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Note note)
    {
        _context.Notes.Remove(note);
        await _context.SaveChangesAsync();
    }
}
