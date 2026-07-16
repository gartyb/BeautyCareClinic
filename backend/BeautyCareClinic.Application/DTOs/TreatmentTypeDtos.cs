namespace BeautyCareClinic.Application.DTOs;

public record TreatmentTypeDto(Guid Id, string Name);
public record CreateTreatmentTypeRequest(string Name);
public record UpdateTreatmentTypeRequest(string Name);
