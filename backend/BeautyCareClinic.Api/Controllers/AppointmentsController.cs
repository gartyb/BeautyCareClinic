using System.Data;
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

[ApiController]
[Authorize]
public class AppointmentsController : ControllerBase
{
    private readonly ICustomerRepository _customerRepository;
    private readonly ITreatmentTypeRepository _treatmentTypeRepository;
    private readonly IUserRepository _userRepository;
    private readonly IAppointmentRepository _appointmentRepository;
    private readonly IAvailabilityService _availabilityService;
    private readonly ICurrentUserService _currentUserService;
    private readonly AppDbContext _context;

    public AppointmentsController(
        ICustomerRepository customerRepository,
        ITreatmentTypeRepository treatmentTypeRepository,
        IUserRepository userRepository,
        IAppointmentRepository appointmentRepository,
        IAvailabilityService availabilityService,
        ICurrentUserService currentUserService,
        AppDbContext context)
    {
        _customerRepository = customerRepository;
        _treatmentTypeRepository = treatmentTypeRepository;
        _userRepository = userRepository;
        _appointmentRepository = appointmentRepository;
        _availabilityService = availabilityService;
        _currentUserService = currentUserService;
        _context = context;
    }

    /// <summary>GET /api/v1/appointments — Both roles.</summary>
    [HttpGet("api/v1/appointments")]
    public async Task<IActionResult> ListAll()
    {
        var appointments = await _appointmentRepository.ListAllAsync();
        return Ok(appointments.Select(ToDto));
    }

    /// <summary>GET /api/v1/customers/{customerId}/appointments — Both roles.</summary>
    [HttpGet("api/v1/customers/{customerId:guid}/appointments")]
    public async Task<IActionResult> ListByCustomer(Guid customerId)
    {
        var customer = await _customerRepository.GetByIdAsync(customerId);
        if (customer == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "הלקוח לא נמצא.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var appointments = await _appointmentRepository.ListByCustomerAsync(customerId);
        return Ok(appointments.Select(ToDto));
    }

    /// <summary>GET /api/v1/appointments/{id} — Both roles.</summary>
    [HttpGet("api/v1/appointments/{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var appointment = await _appointmentRepository.GetByIdAsync(id);
        if (appointment == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "התור לא נמצא.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        return Ok(ToDto(appointment));
    }

    /// <summary>
    /// POST /api/v1/customers/{customerId}/appointments — Both roles.
    /// Uses SELECT FOR UPDATE row-level lock on the target therapist's User row as a
    /// serialization mutex before the overlap check + insert (ADR-011-A).
    /// </summary>
    [HttpPost("api/v1/customers/{customerId:guid}/appointments")]
    public async Task<IActionResult> Create(Guid customerId, [FromBody] CreateAppointmentRequest request)
    {
        if (request.EndTime <= request.StartTime)
            throw new DomainValidationException("שעת הסיום חייבת להיות אחרי שעת ההתחלה");

        var startTimeUtc = DateTime.SpecifyKind(request.StartTime, DateTimeKind.Unspecified);
        var endTimeUtc = DateTime.SpecifyKind(request.EndTime, DateTimeKind.Unspecified);

        if (startTimeUtc < GetIsraelLocalNow())
            throw new DomainValidationException("לא ניתן לקבוע תור בזמן שעבר");

        var customer = await _customerRepository.GetByIdAsync(customerId);
        if (customer == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "הלקוח לא נמצא.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var treatmentType = await _treatmentTypeRepository.GetByIdAsync(request.TreatmentTypeId);
        if (treatmentType == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "סוג הטיפול לא נמצא.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var therapist = await _userRepository.GetByIdAsync(request.UserId);
        if (therapist == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "המטפלת לא נמצאה.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (therapist.Role != UserRole.Therapist)
            throw new DomainValidationException("המשתמש שנבחר אינו מטפלת");

        Appointment appointment;

        await using var tx = await _context.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
        try
        {
            // Row-level lock on the therapist's User row — mutex, not a data mutation (ADR-011-A).
            await _context.Database.SqlQueryRaw<Guid>(
                "SELECT \"Id\" FROM \"Users\" WHERE \"Id\" = {0} FOR UPDATE",
                request.UserId).ToListAsync();

            var availability = await _availabilityService.CheckAvailabilityAsync(
                request.UserId, request.TreatmentTypeId, startTimeUtc, endTimeUtc);

            if (!availability.IsAvailable)
                throw new DomainConflictException(availability.Reason!);

            appointment = new Appointment
            {
                Id = Guid.NewGuid(),
                CustomerId = customerId,
                TreatmentTypeId = request.TreatmentTypeId,
                UserId = request.UserId,
                StartTime = startTimeUtc,
                EndTime = endTimeUtc,
                Status = AppointmentStatus.Scheduled,
                CreatedAt = DateTime.UtcNow,
                UserFullName = therapist.FullName,
            };

            _context.Appointments.Add(appointment);
            await _context.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        var saved = await _appointmentRepository.GetByIdAsync(appointment.Id);
        return CreatedAtAction(nameof(GetById), new { id = appointment.Id }, ToDto(saved!));
    }

    /// <summary>
    /// PUT /api/v1/appointments/{id} — Author or Manager. Reschedules start/end time and/or
    /// therapist. Blocked (409) for a non-Scheduled or already-past appointment, for every role
    /// including Manager (Q6). If the therapist changes, locks both the old and new User rows in
    /// ascending-GUID order to avoid deadlocking against a concurrent reschedule doing the
    /// opposite swap (ADR-011-A).
    /// </summary>
    [HttpPut("api/v1/appointments/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateAppointmentRequest request)
    {
        var appointment = await _appointmentRepository.GetByIdAsync(id);
        if (appointment == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "התור לא נמצא.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var currentUserId = _currentUserService.GetCurrentUserId();
        var isManager = _currentUserService.IsManager();

        if (appointment.UserId != currentUserId && !isManager)
            return StatusCode(403, new ErrorResponse(ErrorCodes.Forbidden, "אין הרשאה לעדכן תור זה.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var nowLocal = GetIsraelLocalNow();

        // Q6: blocked for every role including Manager — no exception.
        if (appointment.Status != AppointmentStatus.Scheduled)
            throw new DomainConflictException("לא ניתן לעדכן תור שאינו במצב מתוכנן");

        if (appointment.StartTime < nowLocal)
            throw new DomainConflictException("לא ניתן לעדכן תור שכבר עבר");

        if (request.EndTime <= request.StartTime)
            throw new DomainValidationException("שעת הסיום חייבת להיות אחרי שעת ההתחלה");

        var newStartUtc = DateTime.SpecifyKind(request.StartTime, DateTimeKind.Unspecified);
        var newEndUtc = DateTime.SpecifyKind(request.EndTime, DateTimeKind.Unspecified);

        if (newStartUtc < nowLocal)
            throw new DomainValidationException("לא ניתן לקבוע תור בזמן שעבר");

        var therapist = await _userRepository.GetByIdAsync(request.UserId);
        if (therapist == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "המטפלת לא נמצאה.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (therapist.Role != UserRole.Therapist)
            throw new DomainValidationException("המשתמש שנבחר אינו מטפלת");

        var oldUserId = appointment.UserId;
        var newUserId = request.UserId;

        await using var tx = await _context.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
        try
        {
            if (oldUserId == newUserId)
            {
                await _context.Database.SqlQueryRaw<Guid>(
                    "SELECT \"Id\" FROM \"Users\" WHERE \"Id\" = {0} FOR UPDATE",
                    oldUserId).ToListAsync();
            }
            else
            {
                // Lock both rows in ascending-GUID order so any two concurrent transactions that
                // both touch this pair of therapists always acquire the locks in the same order —
                // preventing a classic AB/BA deadlock.
                var (first, second) = oldUserId.CompareTo(newUserId) <= 0
                    ? (oldUserId, newUserId)
                    : (newUserId, oldUserId);

                await _context.Database.SqlQueryRaw<Guid>(
                    "SELECT \"Id\" FROM \"Users\" WHERE \"Id\" = {0} FOR UPDATE", first).ToListAsync();
                await _context.Database.SqlQueryRaw<Guid>(
                    "SELECT \"Id\" FROM \"Users\" WHERE \"Id\" = {0} FOR UPDATE", second).ToListAsync();
            }

            // Excludes the appointment being moved from its own overlap check.
            var availability = await _availabilityService.CheckAvailabilityAsync(
                newUserId, appointment.TreatmentTypeId, newStartUtc, newEndUtc, excludeAppointmentId: appointment.Id);

            if (!availability.IsAvailable)
                throw new DomainConflictException(availability.Reason!);

            appointment.UserId = newUserId;
            appointment.StartTime = newStartUtc;
            appointment.EndTime = newEndUtc;
            appointment.UserFullName = therapist.FullName;

            _context.Appointments.Update(appointment);
            await _context.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        var updated = await _appointmentRepository.GetByIdAsync(appointment.Id);
        return Ok(ToDto(updated!));
    }

    /// <summary>DELETE /api/v1/appointments/{id} — Author or Manager. Cancels (soft status
    /// transition Scheduled → Cancelled per Q2's MVP scope; no hard delete, no soft-delete flag).</summary>
    [HttpDelete("api/v1/appointments/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var appointment = await _appointmentRepository.GetByIdAsync(id);
        if (appointment == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "התור לא נמצא.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var currentUserId = _currentUserService.GetCurrentUserId();
        var isManager = _currentUserService.IsManager();

        if (appointment.UserId != currentUserId && !isManager)
            return StatusCode(403, new ErrorResponse(ErrorCodes.Forbidden, "אין הרשאה לבטל תור זה.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (appointment.Status != AppointmentStatus.Scheduled)
            throw new DomainConflictException("לא ניתן לבטל תור שאינו במצב מתוכנן");

        appointment.Status = AppointmentStatus.Cancelled;
        await _appointmentRepository.UpdateAsync(appointment);

        return NoContent();
    }

    /// <summary>
    /// Best-effort "current Israel wall-clock time" reference, returned as naive-local
    /// (Kind.Unspecified) — consistent with how Appointment.StartTime/EndTime are stored (Q5 — no
    /// DateTimeOffset/timezone column, per CR-019's deferral). Comparing raw DateTime.UtcNow
    /// against those naive-local values directly would misclassify anything within the current
    /// UTC offset (~2-3h) as future/past incorrectly — a much larger practical impact than the
    /// pre-existing day-granularity TreatmentDate/PaymentDate/NoteDate comparisons (which only
    /// misclassify right at a midnight boundary). This TimeZoneInfo lookup is used purely as an
    /// internal "what time is it in Israel right now" computation for this comparison — the
    /// result is never persisted, and this does not reintroduce timezone-aware storage (CR-019
    /// stays deferred).
    /// </summary>
    private static DateTime GetIsraelLocalNow()
    {
        try
        {
            var israelTz = TimeZoneInfo.FindSystemTimeZoneById("Asia/Jerusalem");
            return DateTime.SpecifyKind(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, israelTz), DateTimeKind.Unspecified);
        }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            // Fallback if the host's tzdata is missing/stripped (e.g. a minimal container image)
            // or corrupt/partial (InvalidTimeZoneException — e.g. a truncated tzdata install):
            // approximate with a fixed UTC+3 (Israel Daylight Time) offset. Less accurate during
            // the ~4-5 months/year Israel is on Standard Time (UTC+2), but still far closer than
            // comparing against raw DateTime.UtcNow.
            return DateTime.SpecifyKind(DateTime.UtcNow.AddHours(3), DateTimeKind.Unspecified);
        }
    }

    private static AppointmentDto ToDto(Appointment a) => new(
        a.Id,
        a.CustomerId,
        a.TreatmentTypeId,
        a.TreatmentType?.Name ?? string.Empty,
        a.UserId,
        a.UserFullName,
        a.StartTime,
        a.EndTime,
        a.Status.ToString(),
        a.CreatedAt);
}
