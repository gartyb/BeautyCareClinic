using System.Data;
using BeautyCareClinic.Application.DTOs;
using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Domain.Exceptions;
using BeautyCareClinic.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BeautyCareClinic.Api.Controllers;

[ApiController]
[Authorize]
public class PaymentsController : ControllerBase
{
    private readonly ICustomerOrderRepository _orderRepository;
    private readonly IPaymentRepository _paymentRepository;
    private readonly IUserRepository _userRepository;
    private readonly ICurrentUserService _currentUserService;
    private readonly AppDbContext _context;

    public PaymentsController(
        ICustomerOrderRepository orderRepository,
        IPaymentRepository paymentRepository,
        IUserRepository userRepository,
        ICurrentUserService currentUserService,
        AppDbContext context)
    {
        _orderRepository    = orderRepository;
        _paymentRepository  = paymentRepository;
        _userRepository     = userRepository;
        _currentUserService = currentUserService;
        _context            = context;
    }

    /// <summary>GET /api/v1/orders/{orderId}/payments — Both roles.</summary>
    [HttpGet("api/v1/orders/{orderId:guid}/payments")]
    public async Task<IActionResult> ListByOrder(Guid orderId)
    {
        var order = await _orderRepository.GetByIdWithDetailsAsync(orderId);
        if (order == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "ההזמנה לא נמצאה.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var payments = await _paymentRepository.GetByOrderIdAsync(orderId);
        return Ok(payments.Select(ToDto));
    }

    /// <summary>
    /// POST /api/v1/orders/{orderId}/payments — Both roles.
    /// Uses SELECT FOR UPDATE row-level lock on the order to prevent concurrent payment race conditions (RC-2).
    /// </summary>
    [HttpPost("api/v1/orders/{orderId:guid}/payments")]
    public async Task<IActionResult> Create(Guid orderId, [FromBody] CreatePaymentRequest request)
    {
        if (request.Amount <= 0)
            throw new DomainValidationException("הסכום חייב להיות חיובי");

        if (request.Amount > 99_999_999.99m)
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "סכום התשלום גבוה מדי.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (Math.Round(request.Amount, 2) != request.Amount)
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "סכום התשלום אינו תקין — מותרות עד שתי ספרות אחרי הנקודה.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var allowedMethods = new[] { "Cash", "Credit Card", "Bank Transfer", "Check", "Other" };
        if (!allowedMethods.Contains(request.PaymentMethod))
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "אמצעי תשלום לא תקין.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (request.PaymentDate > today)
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "תאריך תשלום לא יכול להיות בעתיד.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (request.PaymentDate < DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-10)))
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "תאריך תשלום לא תקין.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        // Acquire transaction + row-level lock before reading order state (RC-2)
        await using var tx = await _context.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
        try
        {
            // Row-level lock on the order row — prevents concurrent payments from racing
            await _context.Database.SqlQueryRaw<Guid>(
                "SELECT \"Id\" FROM \"CustomerOrders\" WHERE \"Id\" = {0} FOR UPDATE",
                orderId).ToListAsync();

            var order = await _orderRepository.GetByIdWithDetailsAsync(orderId);
            if (order == null)
                return NotFound(new ErrorResponse(ErrorCodes.NotFound, "ההזמנה לא נמצאה.", DateTime.UtcNow, HttpContext.TraceIdentifier));

            // Reload to get the current PostgreSQL-computed RemainingBalance
            await _context.Entry(order).ReloadAsync();

            if (request.Amount > order.RemainingBalance)
                throw new DomainValidationException("הסכום חורג מהיתרה");

            var paymentCount = await _paymentRepository.CountByOrderIdAsync(orderId);
            if (paymentCount >= order.MaxPaymentCount)
                throw new DomainConflictException("הגעת למספר המקסימלי של תשלומים");

            // Resolve recorder identity from JWT — never trust the client (CR-008 / RC-4)
            var currentUserId = _currentUserService.GetCurrentUserId();
            var currentUser   = await _userRepository.GetByIdAsync(currentUserId);
            var recorderName  = currentUser?.FullName ?? string.Empty;

            var payment = new Payment
            {
                Id                  = Guid.NewGuid(),
                OrderId             = orderId,
                Amount              = request.Amount,
                PaymentMethod       = request.PaymentMethod,
                PaymentDate         = request.PaymentDate.ToDateTime(TimeOnly.MinValue),
                RecordedByUserId    = currentUserId,
                RecordedByFullName  = recorderName,
            };

            // Update AmountPaid — RemainingBalance is recalculated by PostgreSQL
            order.AmountPaid += request.Amount;
            _context.CustomerOrders.Update(order);

            _context.Payments.Add(payment);
            await _context.SaveChangesAsync();

            // Reload to get updated RemainingBalance from the computed column
            await _context.Entry(order).ReloadAsync();

            await tx.CommitAsync();

            return CreatedAtAction(nameof(ListByOrder), new { orderId }, ToDto(payment));
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    private static PaymentDto ToDto(Payment p) => new(
        p.Id,
        p.OrderId,
        p.Amount,
        p.PaymentMethod,
        DateOnly.FromDateTime(p.PaymentDate),
        p.RecordedByUserId,
        p.RecordedByFullName);
}
