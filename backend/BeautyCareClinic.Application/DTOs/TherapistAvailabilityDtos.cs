namespace BeautyCareClinic.Application.DTOs;

/// <summary>
/// Phase 011 Architecture Review Correction #1 — read-only exposure of therapist availability
/// data (working hours / unavailable dates / capabilities), keyed by the real seeded therapist
/// User.Id GUIDs. No write/management API for this data in Phase 011 (Q4 stays deferred).
/// Weekday is 0=Sunday..6=Saturday, matching both the Weekday enum's declaration order and the
/// frontend's Date.getDay() convention — no remapping required by a future frontend consumer.
/// </summary>
public record TherapistWorkingHoursDto(Guid Id, Guid UserId, int Weekday, string StartTime, string EndTime);

public record TherapistUnavailableDateDto(Guid Id, Guid UserId, DateOnly Date);

public record TherapistCapabilityDto(Guid Id, Guid UserId, Guid TreatmentTypeId);

public record TherapistAvailabilityResponse(
    List<TherapistWorkingHoursDto> WorkingHours,
    List<TherapistUnavailableDateDto> UnavailableDates,
    List<TherapistCapabilityDto> Capabilities);

/// <summary>
/// Bugfix follow-up to Architecture Review Correction #1 — a minimal, name+id-only projection of
/// Role=Therapist users for populating the appointment-booking therapist picker. Deliberately
/// does NOT include Email/Phone (unlike UserDto): UsersController stays Manager-only because its
/// UserDto carries PII for every user, but the booking flow (any authenticated user, Manager or
/// Therapist — Q7) only ever needs a name to show in the picker, so this endpoint is scoped to
/// exactly that.
/// </summary>
public record TherapistSummaryDto(Guid Id, string FullName);
