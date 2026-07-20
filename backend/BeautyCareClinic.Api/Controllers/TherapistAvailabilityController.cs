using BeautyCareClinic.Application.DTOs;
using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Domain.Enums;
using BeautyCareClinic.Domain.Exceptions;
using BeautyCareClinic.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BeautyCareClinic.Api.Controllers;

/// <summary>
/// Phase 011 Architecture Review Correction #1 — small dedicated read-only endpoint exposing
/// therapist working-hours / unavailable-dates / capabilities to any authenticated user (not
/// Manager-restricted like UsersController, since the calendar's therapist picker and booking
/// flow — Q7 — must be usable by Therapist-role users too, not just Managers).
///
/// Bugfix (post-Phase-011): also exposes GET /api/v1/therapists — a minimal name+id-only list of
/// Role=Therapist users, following the exact same "narrow, non-Manager-gated read endpoint"
/// pattern as the availability action below. This exists because UsersController (which the
/// therapist picker originally called via GET /users?role=Therapist) is Manager-only for ALL
/// actions since its UserDto carries email/phone for every user — relaxing that class-wide would
/// be a real PII exposure expansion. UsersController itself is intentionally left untouched.
///
/// Phase 012 (RC-1) — this controller also carries the write/management CRUD for the three
/// therapist-schedule resources (working hours / capabilities / unavailable dates), closing
/// Phase 011's Q4 deferral. RC-1 deliberately placed this here instead of on UsersController:
/// UsersController is Manager-only at the class level (its UserDto carries PII), while GET here
/// must stay usable by both roles. So GET stays class-open ([Authorize] only); every write action
/// is individually [Authorize(Policy = "Manager")] (RC-2: no new service class for this CRUD —
/// inline controller validation directly against AppDbContext, matching this controller's own
/// pre-existing style for its read actions, and the repository + inline-validation convention used
/// by NotesController/PaymentsController/TreatmentsController elsewhere in the project).
/// </summary>
[ApiController]
[Authorize]
[Route("api/v1/therapists")]
public class TherapistAvailabilityController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ITreatmentTypeRepository _treatmentTypeRepository;

    public TherapistAvailabilityController(AppDbContext context, ITreatmentTypeRepository treatmentTypeRepository)
    {
        _context = context;
        _treatmentTypeRepository = treatmentTypeRepository;
    }

    /// <summary>GET /api/v1/therapists — Both roles. Name+id only, no PII. Phase 012: always
    /// active-only (booking-safety default — a deactivated therapist must never appear in a
    /// booking picker).</summary>
    [HttpGet]
    public async Task<IActionResult> GetTherapists()
    {
        var therapists = await _context.Users
            .AsNoTracking()
            .Where(u => u.Role == UserRole.Therapist && u.IsActive)
            .OrderBy(u => u.FullName)
            .Select(u => new TherapistSummaryDto(u.Id, u.FullName))
            .ToListAsync();

        return Ok(therapists);
    }

    /// <summary>GET /api/v1/therapists/availability?includeInactive= — Both roles. Phase 012:
    /// active-only by default; includeInactive=true is a Manager-oriented escape hatch (e.g.
    /// reviewing a departed therapist's historical schedule) — not restricted to Manager since it's
    /// a read of non-PII schedule data, same access level as the endpoint's pre-existing default.</summary>
    [HttpGet("availability")]
    public async Task<IActionResult> Get([FromQuery] bool includeInactive = false)
    {
        // NOTE: entities are materialized first, then projected to DTOs in memory. Projecting
        // `(int)wh.Weekday` directly inside an EF Select() gets translated to a SQL CAST on the
        // "Weekday" text column (the enum's HasConversion<string>() mapping isn't applied through
        // an explicit numeric cast in a server-side projection), which fails at runtime with
        // Postgres error 22P02 ("invalid input syntax for type integer") since the stored value is
        // text like "Sunday", not a number. Materializing first avoids the bad SQL translation.
        var workingHoursEntities = await _context.TherapistWorkingHours.AsNoTracking().ToListAsync();
        var unavailableDateEntities = await _context.TherapistUnavailableDates.AsNoTracking().ToListAsync();
        var capabilityEntities = await _context.TherapistCapabilities.AsNoTracking().ToListAsync();

        if (!includeInactive)
        {
            var activeUserIds = (await _context.Users.AsNoTracking()
                    .Where(u => u.IsActive)
                    .Select(u => u.Id)
                    .ToListAsync())
                .ToHashSet();

            workingHoursEntities = workingHoursEntities.Where(wh => activeUserIds.Contains(wh.UserId)).ToList();
            unavailableDateEntities = unavailableDateEntities.Where(ud => activeUserIds.Contains(ud.UserId)).ToList();
            capabilityEntities = capabilityEntities.Where(c => activeUserIds.Contains(c.UserId)).ToList();
        }

        var workingHours = workingHoursEntities
            .Select(wh => new TherapistWorkingHoursDto(wh.Id, wh.UserId, (int)wh.Weekday, wh.StartTime, wh.EndTime))
            .ToList();

        var unavailableDates = unavailableDateEntities
            .Select(ud => new TherapistUnavailableDateDto(ud.Id, ud.UserId, DateOnly.FromDateTime(ud.UnavailableDate)))
            .ToList();

        var capabilities = capabilityEntities
            .Select(c => new TherapistCapabilityDto(c.Id, c.UserId, c.TreatmentTypeId))
            .ToList();

        return Ok(new TherapistAvailabilityResponse(workingHours, unavailableDates, capabilities));
    }

    // =========================================================================
    // Working Hours — /api/v1/therapists/{userId}/working-hours[/{weekday}]
    // =========================================================================

    /// <summary>GET /api/v1/therapists/{userId}/working-hours — Both roles.</summary>
    [HttpGet("{userId:guid}/working-hours")]
    public async Task<IActionResult> GetWorkingHours(Guid userId)
    {
        // Materialize first, then project — casting the string-converted Weekday enum to int
        // *inside* the Select() translates to an invalid SQL CAST on the text column (Postgres
        // 22P02). See the class-level doc comment on Get() above for the full explanation.
        var entities = await _context.TherapistWorkingHours
            .AsNoTracking()
            .Where(wh => wh.UserId == userId)
            .ToListAsync();

        var rows = entities
            .OrderBy(wh => wh.Weekday)
            .Select(wh => new TherapistWorkingHoursDto(wh.Id, wh.UserId, (int)wh.Weekday, wh.StartTime, wh.EndTime))
            .ToList();

        return Ok(rows);
    }

    /// <summary>POST /api/v1/therapists/{userId}/working-hours — Manager only. Creates a new row
    /// for the given weekday; 409 if one already exists (use PUT to replace it).</summary>
    [HttpPost("{userId:guid}/working-hours")]
    [Authorize(Policy = "Manager")]
    public async Task<IActionResult> CreateWorkingHours(Guid userId, [FromBody] CreateWorkingHoursRequest request)
    {
        var (therapist, error) = await ResolveTherapistForWriteAsync(userId);
        if (error != null) return error;

        var weekday = ValidateWeekdayAndTimes(request.Weekday, request.StartTime, request.EndTime);

        var existing = await _context.TherapistWorkingHours
            .FirstOrDefaultAsync(wh => wh.UserId == userId && wh.Weekday == weekday);
        if (existing != null)
            throw new DomainConflictException("כבר קיימות שעות עבודה ליום זה — יש לעדכן את הרשומה הקיימת במקום להוסיף חדשה");

        var entity = new TherapistWorkingHours
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Weekday = weekday,
            StartTime = request.StartTime ?? string.Empty,
            EndTime = request.EndTime ?? string.Empty,
        };

        _context.TherapistWorkingHours.Add(entity);
        await _context.SaveChangesAsync();

        var dto = new TherapistWorkingHoursDto(entity.Id, entity.UserId, (int)entity.Weekday, entity.StartTime, entity.EndTime);
        return CreatedAtAction(nameof(GetWorkingHours), new { userId }, dto);
    }

    /// <summary>PUT /api/v1/therapists/{userId}/working-hours/{weekday} — Manager only. Upserts:
    /// replaces the existing entry for that weekday, or creates one if none exists yet.</summary>
    [HttpPut("{userId:guid}/working-hours/{weekday:int}")]
    [Authorize(Policy = "Manager")]
    public async Task<IActionResult> UpdateWorkingHours(Guid userId, int weekday, [FromBody] UpdateWorkingHoursRequest request)
    {
        var (therapist, error) = await ResolveTherapistForWriteAsync(userId);
        if (error != null) return error;

        var weekdayEnum = ValidateWeekdayAndTimes(weekday, request.StartTime, request.EndTime);

        var existing = await _context.TherapistWorkingHours
            .FirstOrDefaultAsync(wh => wh.UserId == userId && wh.Weekday == weekdayEnum);

        if (existing == null)
        {
            existing = new TherapistWorkingHours
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Weekday = weekdayEnum,
            };
            _context.TherapistWorkingHours.Add(existing);
        }

        existing.StartTime = request.StartTime ?? string.Empty;
        existing.EndTime = request.EndTime ?? string.Empty;

        await _context.SaveChangesAsync();

        var dto = new TherapistWorkingHoursDto(existing.Id, existing.UserId, (int)existing.Weekday, existing.StartTime, existing.EndTime);
        return Ok(dto);
    }

    /// <summary>DELETE /api/v1/therapists/{userId}/working-hours/{weekday} — Manager only.</summary>
    [HttpDelete("{userId:guid}/working-hours/{weekday:int}")]
    [Authorize(Policy = "Manager")]
    public async Task<IActionResult> DeleteWorkingHours(Guid userId, int weekday)
    {
        var (therapist, error) = await ResolveTherapistForWriteAsync(userId);
        if (error != null) return error;

        if (weekday < 0 || weekday > 6)
            throw new DomainValidationException("יום בשבוע לא תקין");

        var existing = await _context.TherapistWorkingHours
            .FirstOrDefaultAsync(wh => wh.UserId == userId && wh.Weekday == (Weekday)weekday);
        if (existing == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "לא נמצאו שעות עבודה ליום זה.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        _context.TherapistWorkingHours.Remove(existing);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // =========================================================================
    // Capabilities — /api/v1/therapists/{userId}/capabilities[/{treatmentTypeId}]
    // =========================================================================

    /// <summary>GET /api/v1/therapists/{userId}/capabilities — Both roles.</summary>
    [HttpGet("{userId:guid}/capabilities")]
    public async Task<IActionResult> GetCapabilities(Guid userId)
    {
        var rows = await _context.TherapistCapabilities
            .AsNoTracking()
            .Where(c => c.UserId == userId)
            .Select(c => new TherapistCapabilityDto(c.Id, c.UserId, c.TreatmentTypeId))
            .ToListAsync();

        return Ok(rows);
    }

    /// <summary>POST /api/v1/therapists/{userId}/capabilities — Manager only.</summary>
    [HttpPost("{userId:guid}/capabilities")]
    [Authorize(Policy = "Manager")]
    public async Task<IActionResult> CreateCapability(Guid userId, [FromBody] CreateCapabilityRequest request)
    {
        var (therapist, error) = await ResolveTherapistForWriteAsync(userId);
        if (error != null) return error;

        var treatmentType = await _treatmentTypeRepository.GetByIdAsync(request.TreatmentTypeId);
        if (treatmentType == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "סוג הטיפול לא נמצא.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var existing = await _context.TherapistCapabilities
            .AnyAsync(c => c.UserId == userId && c.TreatmentTypeId == request.TreatmentTypeId);
        if (existing)
            throw new DomainConflictException("למטפלת כבר יש הסמכה לסוג טיפול זה");

        var entity = new TherapistCapability
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TreatmentTypeId = request.TreatmentTypeId,
        };

        _context.TherapistCapabilities.Add(entity);
        await _context.SaveChangesAsync();

        var dto = new TherapistCapabilityDto(entity.Id, entity.UserId, entity.TreatmentTypeId);
        return CreatedAtAction(nameof(GetCapabilities), new { userId }, dto);
    }

    /// <summary>DELETE /api/v1/therapists/{userId}/capabilities/{treatmentTypeId} — Manager only.</summary>
    [HttpDelete("{userId:guid}/capabilities/{treatmentTypeId:guid}")]
    [Authorize(Policy = "Manager")]
    public async Task<IActionResult> DeleteCapability(Guid userId, Guid treatmentTypeId)
    {
        var (therapist, error) = await ResolveTherapistForWriteAsync(userId);
        if (error != null) return error;

        var existing = await _context.TherapistCapabilities
            .FirstOrDefaultAsync(c => c.UserId == userId && c.TreatmentTypeId == treatmentTypeId);
        if (existing == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "ההסמכה לא נמצאה.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        _context.TherapistCapabilities.Remove(existing);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // =========================================================================
    // Unavailable Dates — /api/v1/therapists/{userId}/unavailable-dates[/{date}]
    // =========================================================================

    /// <summary>GET /api/v1/therapists/{userId}/unavailable-dates — Both roles.</summary>
    [HttpGet("{userId:guid}/unavailable-dates")]
    public async Task<IActionResult> GetUnavailableDates(Guid userId)
    {
        var rows = await _context.TherapistUnavailableDates
            .AsNoTracking()
            .Where(ud => ud.UserId == userId)
            .OrderBy(ud => ud.UnavailableDate)
            .Select(ud => new TherapistUnavailableDateDto(ud.Id, ud.UserId, DateOnly.FromDateTime(ud.UnavailableDate)))
            .ToListAsync();

        return Ok(rows);
    }

    /// <summary>POST /api/v1/therapists/{userId}/unavailable-dates — Manager only. RC-3: persists
    /// Kind=Utc, date-only — matching AvailabilityService's existing query convention and
    /// DbSeeder's existing writes for this table. Getting this wrong silently breaks availability
    /// blocking for the newly-added date.</summary>
    [HttpPost("{userId:guid}/unavailable-dates")]
    [Authorize(Policy = "Manager")]
    public async Task<IActionResult> CreateUnavailableDate(Guid userId, [FromBody] CreateUnavailableDateRequest request)
    {
        var (therapist, error) = await ResolveTherapistForWriteAsync(userId);
        if (error != null) return error;

        var unavailableDateUtc = DateTime.SpecifyKind(request.Date.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);

        var existing = await _context.TherapistUnavailableDates
            .AnyAsync(ud => ud.UserId == userId && ud.UnavailableDate == unavailableDateUtc);
        if (existing)
            throw new DomainConflictException("התאריך כבר מסומן כלא זמין עבור מטפלת זו");

        var entity = new TherapistUnavailableDate
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            UnavailableDate = unavailableDateUtc,
        };

        _context.TherapistUnavailableDates.Add(entity);
        await _context.SaveChangesAsync();

        var dto = new TherapistUnavailableDateDto(entity.Id, entity.UserId, DateOnly.FromDateTime(entity.UnavailableDate));
        return CreatedAtAction(nameof(GetUnavailableDates), new { userId }, dto);
    }

    /// <summary>DELETE /api/v1/therapists/{userId}/unavailable-dates/{date} — Manager only.
    /// {date} is "yyyy-MM-dd".</summary>
    [HttpDelete("{userId:guid}/unavailable-dates/{date}")]
    [Authorize(Policy = "Manager")]
    public async Task<IActionResult> DeleteUnavailableDate(Guid userId, string date)
    {
        var (therapist, error) = await ResolveTherapistForWriteAsync(userId);
        if (error != null) return error;

        if (!DateOnly.TryParseExact(date, "yyyy-MM-dd", out var parsedDate))
            throw new DomainValidationException("תאריך לא תקין — יש להשתמש בפורמט yyyy-MM-dd");

        // RC-3 — same Kind=Utc, date-only convention as the POST write path above.
        var unavailableDateUtc = DateTime.SpecifyKind(parsedDate.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);

        var existing = await _context.TherapistUnavailableDates
            .FirstOrDefaultAsync(ud => ud.UserId == userId && ud.UnavailableDate == unavailableDateUtc);
        if (existing == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "התאריך לא נמצא.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        _context.TherapistUnavailableDates.Remove(existing);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // ── Shared validation helpers ────────────────────────────────────────────

    /// <summary>Loads the target user and validates it is an existing, active Therapist. Returns
    /// a 404 IActionResult for "not found" (kept as a return value, not an exception, so the
    /// message stays Hebrew and consistent with every other controller's not-found handling);
    /// throws DomainValidationException (422) for a wrong-role or inactive target.</summary>
    private async Task<(User? Therapist, IActionResult? Error)> ResolveTherapistForWriteAsync(Guid userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
            return (null, NotFound(new ErrorResponse(ErrorCodes.NotFound, "המטפלת לא נמצאה.", DateTime.UtcNow, HttpContext.TraceIdentifier)));

        if (user.Role != UserRole.Therapist)
            throw new DomainValidationException("המשתמש שנבחר אינו מטפלת");

        if (!user.IsActive)
            throw new DomainValidationException("לא ניתן לערוך נתונים עבור מטפלת שאינה פעילה");

        return (user, null);
    }

    /// <summary>Validates the weekday range and the working-hours time-range rules shared by
    /// Create/Update: both null (day off) or both non-null with valid "HH:mm" format and
    /// start &lt; end.</summary>
    private static Weekday ValidateWeekdayAndTimes(int weekday, string? startTime, string? endTime)
    {
        if (weekday < 0 || weekday > 6)
            throw new DomainValidationException("יום בשבוע לא תקין");

        var hasStart = !string.IsNullOrWhiteSpace(startTime);
        var hasEnd = !string.IsNullOrWhiteSpace(endTime);

        if (hasStart != hasEnd)
            throw new DomainValidationException("יש להזין גם שעת התחלה וגם שעת סיום, או להשאיר את שתיהן ריקות (יום חופש)");

        if (hasStart && hasEnd)
        {
            if (!TimeOnly.TryParseExact(startTime, "HH:mm", out var start) ||
                !TimeOnly.TryParseExact(endTime, "HH:mm", out var end))
                throw new DomainValidationException("פורמט שעה לא תקין — יש להשתמש ב-HH:mm");

            if (start >= end)
                throw new DomainValidationException("שעת הסיום חייבת להיות אחרי שעת ההתחלה");
        }

        return (Weekday)weekday;
    }
}
