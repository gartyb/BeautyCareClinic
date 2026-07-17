namespace BeautyCareClinic.Application.DTOs;

public record TreatmentSeriesDto(
    Guid Id,
    Guid OrderItemId,
    string PackageTypeName,
    bool IsTimerBased,
    int TotalTreatments,
    int CompletedTreatments,
    int TotalMinutes,
    int UsedMinutes);
