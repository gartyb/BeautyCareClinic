namespace BeautyCareClinic.Application.DTOs;

/// <summary>
/// Request to create a new appointment. StartTime/EndTime are naive local time (Israel, UTC+2/3),
/// matching the TreatmentDate/PaymentDate/NoteDate convention (Phase 011 Q5) — never trusted as-is
/// from the client; the controller always re-stamps them with DateTimeKind.Unspecified explicitly
/// before persisting into the "timestamp without time zone" StartTime/EndTime columns (CR-019
/// stays deferred; no DateTimeOffset here).
/// </summary>
public record CreateAppointmentRequest(
    Guid TreatmentTypeId,
    Guid UserId,
    DateTime StartTime,
    DateTime EndTime);

/// <summary>
/// Request to reschedule an existing appointment. Only StartTime/EndTime/UserId (therapist) may
/// change — CustomerId and TreatmentTypeId are immutable after creation for Phase 011's MVP scope.
/// </summary>
public record UpdateAppointmentRequest(
    Guid UserId,
    DateTime StartTime,
    DateTime EndTime);

public record AppointmentDto(
    Guid Id,
    Guid CustomerId,
    Guid TreatmentTypeId,
    string TreatmentTypeName,
    Guid UserId,
    string UserFullName,
    DateTime StartTime,
    DateTime EndTime,
    string Status,
    DateTime CreatedAt);
