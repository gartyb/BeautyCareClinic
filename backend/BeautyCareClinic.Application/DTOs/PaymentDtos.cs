namespace BeautyCareClinic.Application.DTOs;

public record PaymentDto(
    Guid Id,
    Guid OrderId,
    decimal Amount,
    string PaymentMethod,
    DateOnly PaymentDate,
    Guid RecordedByUserId,
    string RecordedByFullName);

public record CreatePaymentRequest(
    decimal Amount,
    string PaymentMethod,
    DateOnly PaymentDate);
