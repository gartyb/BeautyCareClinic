using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Enums;
using BeautyCareClinic.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace BeautyCareClinic.Infrastructure.Services;

/// <summary>
/// Phase 011 — availability checking against TherapistWorkingHours / TherapistUnavailableDate /
/// TherapistCapability / Appointment. Faithfully ports the frontend's isSlotAvailable() logic
/// (src/features/appointments/appointmentService.ts) to the backend. See
/// <see cref="IAvailabilityService"/> for the ADR-011-A locking precondition this relies on for
/// the overlap check to be race-free.
/// </summary>
public class AvailabilityService : IAvailabilityService
{
    private readonly AppDbContext _context;

    public AvailabilityService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<AvailabilityCheckResult> CheckAvailabilityAsync(
        Guid userId,
        Guid treatmentTypeId,
        DateTime startTime,
        DateTime endTime,
        Guid? excludeAppointmentId = null)
    {
        // Step 0 (Phase 012, Decision 6/RC-4's booking-side counterpart) — the target therapist
        // must be active. Checked here (not inline in the controller) per Phase 012 architecture
        // review RC-2: AvailabilityService stays the only service touched, extended with this one
        // check. IsValidationFailure=true so the controller throws a 422 DomainValidationException
        // (matching the pre-existing Role check's status class) rather than a 409
        // DomainConflictException like the scheduling-conflict checks below.
        var therapistUser = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        if (therapistUser != null && !therapistUser.IsActive)
            return new AvailabilityCheckResult(false, "המטפלת המבוקשת לא פעילה", IsValidationFailure: true);

        // Step 1 — working hours. .NET's DateTime.DayOfWeek is Sunday=0..Saturday=6, the same
        // ordering as both the Weekday enum and the frontend's Date.getDay() — no remapping needed.
        var weekday = (Weekday)(int)startTime.DayOfWeek;

        var workingHours = await _context.TherapistWorkingHours
            .AsNoTracking()
            .FirstOrDefaultAsync(wh => wh.UserId == userId && wh.Weekday == weekday);

        if (workingHours == null ||
            string.IsNullOrWhiteSpace(workingHours.StartTime) ||
            string.IsNullOrWhiteSpace(workingHours.EndTime))
        {
            return new AvailabilityCheckResult(false, "המטפלת אינה עובדת ביום ובשעה המבוקשים.");
        }

        var whStart = TimeOnly.ParseExact(workingHours.StartTime, "HH:mm");
        var whEnd = TimeOnly.ParseExact(workingHours.EndTime, "HH:mm");
        var reqStart = TimeOnly.FromDateTime(startTime);
        var reqEnd = TimeOnly.FromDateTime(endTime);

        if (reqStart < whStart || reqEnd > whEnd)
            return new AvailabilityCheckResult(false, "השעה המבוקשת מחוץ לשעות העבודה של המטפלת.");

        // Step 2 — unavailable dates. TherapistUnavailableDate.UnavailableDate is a separate,
        // out-of-scope "timestamp with time zone" column (unlike Appointment.StartTime/EndTime,
        // it wasn't part of this fix) and is always written with Kind=Utc (see DbSeeder). startTime
        // here is naive-local (Kind=Unspecified) per the Appointment StartTime/EndTime fix, so the
        // query parameter must be explicitly relabeled Utc to match what Npgsql expects for that
        // column — this does not change the requested day, only the Kind tag used for binding.
        var requestedDate = DateTime.SpecifyKind(startTime.Date, DateTimeKind.Utc);
        var isUnavailable = await _context.TherapistUnavailableDates
            .AsNoTracking()
            .AnyAsync(ud => ud.UserId == userId && ud.UnavailableDate.Date == requestedDate);

        if (isUnavailable)
            return new AvailabilityCheckResult(false, "המטפלת אינה זמינה בתאריך המבוקש.");

        // Step 3 — capability for the requested treatment type.
        var hasCapability = await _context.TherapistCapabilities
            .AsNoTracking()
            .AnyAsync(c => c.UserId == userId && c.TreatmentTypeId == treatmentTypeId);

        if (!hasCapability)
            return new AvailabilityCheckResult(false, "למטפלת אין הסמכה לסוג הטיפול המבוקש.");

        // Step 4 — overlap with an existing Scheduled/Completed appointment for this therapist.
        // Race-free only when the caller already holds the therapist's User-row lock (ADR-011-A).
        var excludeId = excludeAppointmentId ?? Guid.Empty;
        var overlapExists = await _context.Appointments
            .AsNoTracking()
            .AnyAsync(a =>
                a.UserId == userId &&
                a.Id != excludeId &&
                (a.Status == AppointmentStatus.Scheduled || a.Status == AppointmentStatus.Completed) &&
                a.StartTime < endTime && a.EndTime > startTime);

        if (overlapExists)
            return new AvailabilityCheckResult(false, "המטפלת כבר תפוסה בשעה זו.");

        return new AvailabilityCheckResult(true, null);
    }
}
