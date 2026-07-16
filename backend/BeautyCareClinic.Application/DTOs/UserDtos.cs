namespace BeautyCareClinic.Application.DTOs;

public record CreateUserRequest(string FullName, string Email, string Password);
public record UpdateUserRequest(string FullName, string Email);
