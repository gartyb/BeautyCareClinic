namespace BeautyCareClinic.Application.DTOs;

/// <summary>
/// Request to create a new treatment record.
/// UserId is never supplied by the client — always resolved from JWT.
/// </summary>
public record CreateTreatmentRequest(
    Guid TreatmentTypeId,
    Guid? TreatmentSeriesId,
    DateOnly? TreatmentDate,
    int DurationMinutes,
    string? Notes);

public record TreatmentDto(
    Guid Id,
    Guid CustomerId,
    Guid TreatmentTypeId,
    string TreatmentTypeName,
    Guid? TreatmentSeriesId,
    DateTime TreatmentDate,
    int DurationMinutes,
    string? Notes,
    Guid UserId,
    string PerformedByFullName);
