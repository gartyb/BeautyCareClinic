namespace BeautyCareClinic.Application.DTOs;

public record CustomerDto(Guid Id, string FullName, string Phone, string? Email, int ActiveSeriesCount, decimal? OutstandingBalance);
public record CreateCustomerRequest(string FullName, string Phone, string? Email);
public record UpdateCustomerRequest(string FullName, string Phone, string? Email);
