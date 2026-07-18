namespace BeautyCareClinic.Application.DTOs;

public record CreateNoteRequest(
    Guid? TreatmentTypeId,
    DateOnly? NoteDate,
    string Content);

public record UpdateNoteRequest(
    Guid? TreatmentTypeId,
    DateOnly? NoteDate,
    string Content);

public record NoteDto(
    Guid Id,
    Guid CustomerId,
    Guid? TreatmentTypeId,
    string? TreatmentTypeName,
    DateOnly NoteDate,
    string Content,
    Guid UserId,
    string WrittenByFullName);
