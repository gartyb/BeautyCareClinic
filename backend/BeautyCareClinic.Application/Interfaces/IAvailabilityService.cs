namespace BeautyCareClinic.Application.Interfaces;

/// <summary>Result of an appointment availability check. Reason is a Hebrew message for the
/// first rejection reason found, intended to surface directly as a 409 error message.</summary>
public record AvailabilityCheckResult(bool IsAvailable, string? Reason);

/// <summary>
/// Phase 011 — Application-layer availability checking (Architecture Review: business logic must
/// not live inline in the controller). Checks, in order: working hours cover the slot, no
/// unavailable-date entry blocks the date, therapist has capability for the treatment type, and
/// no overlapping Scheduled/Completed appointment exists for the therapist.
///
/// IMPORTANT (ADR-011-A): the overlap check portion of this method is only race-free when the
/// caller has already acquired a `FOR UPDATE` lock on the target therapist's `User` row, within
/// the same transaction/DbContext, before calling this method. This service does not acquire that
/// lock itself — it is a mutex the caller (AppointmentsController) is responsible for holding.
/// </summary>
public interface IAvailabilityService
{
    Task<AvailabilityCheckResult> CheckAvailabilityAsync(
        Guid userId,
        Guid treatmentTypeId,
        DateTime startTime,
        DateTime endTime,
        Guid? excludeAppointmentId = null);
}
