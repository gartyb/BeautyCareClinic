namespace BeautyCareClinic.Application.DTOs;

public record ErrorResponse(string Code, string Message, DateTime Timestamp, string TraceId);
