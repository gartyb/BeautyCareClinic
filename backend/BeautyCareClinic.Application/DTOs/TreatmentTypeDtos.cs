namespace BeautyCareClinic.Application.DTOs;

public record TreatmentTypeDto(Guid Id, string Name, int? DefaultDurationMinutes);
public record CreateTreatmentTypeRequest(string Name, int? DefaultDurationMinutes);
public record UpdateTreatmentTypeRequest(string Name, int? DefaultDurationMinutes);
