namespace BeautyCareClinic.Application.DTOs;

public record CreateUserRequest(string FullName, string Email, string Password, string? Phone = null);
public record UpdateUserRequest(string FullName, string Email, string? Phone = null);
