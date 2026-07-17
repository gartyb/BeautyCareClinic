namespace BeautyCareClinic.Application.DTOs;

public record OrderItemDto(
    Guid Id,
    Guid PackageTypeId,
    string PackageTypeName,
    decimal UnitPrice,
    Guid? SeriesId);

public record OrderDto(
    Guid Id,
    Guid CustomerId,
    DateOnly OrderDate,
    decimal OriginalPrice,
    decimal DiscountedPrice,
    decimal DiscountPercentage,
    int MaxPaymentCount,
    decimal AmountPaid,
    decimal RemainingBalance,
    int PaymentCount,
    IReadOnlyList<OrderItemDto> Items);

public record CreateOrderRequest(
    decimal DiscountPercentage,
    int? MaxPaymentCount,
    IReadOnlyList<CreateOrderItemRequest> Items);

public record CreateOrderItemRequest(Guid PackageTypeId);

public record UpdateOrderRequest(
    decimal DiscountPercentage,
    int MaxPaymentCount);
