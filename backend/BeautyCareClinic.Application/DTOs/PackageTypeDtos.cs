namespace BeautyCareClinic.Application.DTOs;

public record PackageTypeDto(
    Guid Id,
    Guid TreatmentTypeId,
    string Name,
    decimal Price,
    bool IsSeries,
    bool IsTimerBased,
    int? TreatmentCount,
    int? MinutesPerTreatment);

public record CreatePackageTypeRequest(
    Guid TreatmentTypeId,
    string Name,
    decimal Price,
    bool IsSeries,
    bool IsTimerBased,
    int? TreatmentCount,
    int? MinutesPerTreatment);

public record UpdatePackageTypeRequest(
    Guid TreatmentTypeId,
    string Name,
    decimal Price,
    bool IsSeries,
    bool IsTimerBased,
    int? TreatmentCount,
    int? MinutesPerTreatment);
