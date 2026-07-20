namespace BeautyCareClinic.Application.DTOs;

public record LoginRequest(string Email, string Password);
public record LoginResponse(string AccessToken, int ExpiresIn, UserDto User);
public record UserDto(Guid Id, string FullName, string Email, string Role, string? Phone = null, bool IsActive = true);
