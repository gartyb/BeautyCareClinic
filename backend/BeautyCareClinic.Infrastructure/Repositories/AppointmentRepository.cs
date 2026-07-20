using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace BeautyCareClinic.Infrastructure.Repositories;

public class AppointmentRepository : IAppointmentRepository
{
    private readonly AppDbContext _context;

    public AppointmentRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Appointment?> GetByIdAsync(Guid id)
    {
        return await _context.Appointments
            .Include(a => a.TreatmentType)
            .FirstOrDefaultAsync(a => a.Id == id);
    }

    public async Task<List<Appointment>> ListAllAsync()
    {
        return await _context.Appointments
            .Include(a => a.TreatmentType)
            .OrderBy(a => a.StartTime)
            .ToListAsync();
    }

    public async Task<List<Appointment>> ListByCustomerAsync(Guid customerId)
    {
        return await _context.Appointments
            .Include(a => a.TreatmentType)
            .Where(a => a.CustomerId == customerId)
            .OrderBy(a => a.StartTime)
            .ToListAsync();
    }

    // Not called by AppointmentsController.Create in production — Create uses
    // _context.Appointments.Add directly (inside its own transaction, alongside the availability
    // checks) for transaction control. Exists for IAppointmentRepository completeness and is
    // exercised only by unit tests, not the live Create path.
    public async Task AddAsync(Appointment appointment)
    {
        _context.Appointments.Add(appointment);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(Appointment appointment)
    {
        _context.Appointments.Update(appointment);
        await _context.SaveChangesAsync();
    }

    // Not called by AppointmentsController.Cancel in production — cancel goes through
    // UpdateAsync (soft-cancel via Status = Cancelled), not a hard delete. Exists for
    // IAppointmentRepository completeness and is exercised only by unit tests, not the live
    // Delete/Cancel path.
    public async Task DeleteAsync(Appointment appointment)
    {
        _context.Appointments.Remove(appointment);
        await _context.SaveChangesAsync();
    }
}
