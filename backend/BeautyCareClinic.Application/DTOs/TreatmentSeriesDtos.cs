namespace BeautyCareClinic.Application.DTOs;

public record TreatmentSeriesDto(
    Guid Id,
    Guid OrderItemId,
    string PackageTypeName,
    bool IsTimerBased,
    Guid TreatmentTypeId,
    int TotalTreatments,
    int CompletedTreatments,
    int TotalMinutes,
    int UsedMinutes,
    int? MinutesPerTreatment,
    int PackageNumber);
