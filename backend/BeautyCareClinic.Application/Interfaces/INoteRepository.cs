using BeautyCareClinic.Domain.Entities;

namespace BeautyCareClinic.Application.Interfaces;

public interface INoteRepository
{
    Task<Note?> GetByIdAsync(Guid id);
    Task<List<Note>> ListByCustomerAsync(Guid customerId);
    Task AddAsync(Note note);
    Task UpdateAsync(Note note);
    Task DeleteAsync(Note note);
}
