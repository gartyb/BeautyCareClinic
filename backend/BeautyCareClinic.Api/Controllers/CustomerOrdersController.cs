using BeautyCareClinic.Application.DTOs;
using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Application.Services;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Domain.Exceptions;
using BeautyCareClinic.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BeautyCareClinic.Api.Controllers;

[ApiController]
[Authorize]
public class CustomerOrdersController : ControllerBase
{
    private readonly ICustomerRepository _customerRepository;
    private readonly IPackageTypeRepository _packageTypeRepository;
    private readonly ICustomerOrderRepository _orderRepository;
    private readonly IGlobalSettingsRepository _settingsRepository;
    private readonly AppDbContext _context;

    public CustomerOrdersController(
        ICustomerRepository customerRepository,
        IPackageTypeRepository packageTypeRepository,
        ICustomerOrderRepository orderRepository,
        IGlobalSettingsRepository settingsRepository,
        AppDbContext context)
    {
        _customerRepository     = customerRepository;
        _packageTypeRepository  = packageTypeRepository;
        _orderRepository        = orderRepository;
        _settingsRepository     = settingsRepository;
        _context                = context;
    }

    /// <summary>GET /api/v1/customers/{customerId}/orders — Both roles.</summary>
    [HttpGet("api/v1/customers/{customerId:guid}/orders")]
    public async Task<IActionResult> ListByCustomer(Guid customerId)
    {
        var customer = await _customerRepository.GetByIdAsync(customerId);
        if (customer == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "הלקוח לא נמצא.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var orders = await _orderRepository.GetByCustomerIdAsync(customerId);
        var paymentCounts = await _orderRepository.GetPaymentCountsByOrderIdsAsync(orders.Select(o => o.Id));
        var dtos = orders.Select(order =>
            ToDto(order, paymentCounts.GetValueOrDefault(order.Id, 0))).ToList();
        return Ok(dtos);
    }

    /// <summary>GET /api/v1/orders/{id} — Both roles.</summary>
    [HttpGet("api/v1/orders/{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var order = await _orderRepository.GetByIdWithDetailsAsync(id);
        if (order == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "ההזמנה לא נמצאה.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var paymentCount = await _orderRepository.GetPaymentCountAsync(id);
        return Ok(ToDto(order, paymentCount));
    }

    /// <summary>POST /api/v1/customers/{customerId}/orders — Both roles.</summary>
    [HttpPost("api/v1/customers/{customerId:guid}/orders")]
    public async Task<IActionResult> Create(Guid customerId, [FromBody] CreateOrderRequest request)
    {
        var customer = await _customerRepository.GetByIdAsync(customerId);
        if (customer == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "הלקוח לא נמצא.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (request.Items == null || request.Items.Count == 0)
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "ההזמנה חייבת לכלול לפחות פריט אחד.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (request.Items.Count > 50)
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "ניתן לבחור עד 50 פריטים בהזמנה אחת.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (request.DiscountPercentage < 0 || request.DiscountPercentage > 100)
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "אחוז ההנחה חייב להיות בין 0 ל-100.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        // Fetch all package types
        var packageTypes = new List<PackageType>();
        foreach (var item in request.Items)
        {
            var pt = await _packageTypeRepository.GetByIdAsync(item.PackageTypeId);
            if (pt == null)
                return NotFound(new ErrorResponse(ErrorCodes.NotFound, $"חבילה עם מזהה {item.PackageTypeId} לא נמצאה.", DateTime.UtcNow, HttpContext.TraceIdentifier));
            packageTypes.Add(pt);
        }

        // Compute prices using decimal arithmetic (never double/float)
        var originalPrice   = packageTypes.Sum(pt => pt.Price);
        var discountedPrice = originalPrice * (1m - request.DiscountPercentage / 100m);
        discountedPrice     = Math.Round(discountedPrice, 2, MidpointRounding.AwayFromZero);

        // Resolve maxPaymentCount
        var maxPaymentCount = request.MaxPaymentCount
            ?? await GlobalSettingsKeys.GetDefaultMaxPaymentCountAsync(_settingsRepository);

        // Create order + items + series in one transaction
        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            // Row-level lock on the customer row — serializes concurrent order creation for the
            // same customer so per-customer PackageNumber assignment below (base+1, base+2, ...)
            // cannot race (CR-031 / RC-1, same pattern as PaymentsController's order-row lock).
            await _context.Database.SqlQueryRaw<Guid>(
                "SELECT \"Id\" FROM \"Customers\" WHERE \"Id\" = {0} FOR UPDATE",
                customerId).ToListAsync();

            var packageNumberBase = await _context.Database.SqlQueryRaw<int>(
                "SELECT COALESCE(MAX(oi.\"PackageNumber\"),0) AS \"Value\" " +
                "FROM \"OrderItems\" oi JOIN \"CustomerOrders\" co ON co.\"Id\" = oi.\"OrderId\" " +
                "WHERE co.\"CustomerId\" = {0}",
                customerId).SingleAsync();

            var order = new CustomerOrder
            {
                Id                 = Guid.NewGuid(),
                CustomerId         = customerId,
                OrderDate          = DateTime.UtcNow,
                OriginalPrice      = originalPrice,
                DiscountedPrice    = discountedPrice,
                DiscountPercentage = request.DiscountPercentage,
                MaxPaymentCount    = maxPaymentCount,
                AmountPaid         = 0m,
                // RemainingBalance is computed by PostgreSQL — do not set here
            };
            _context.CustomerOrders.Add(order);

            for (var i = 0; i < request.Items.Count; i++)
            {
                var pt = packageTypes[i];
                var orderItem = new OrderItem
                {
                    Id            = Guid.NewGuid(),
                    OrderId       = order.Id,
                    PackageTypeId = pt.Id,
                    UnitPrice     = pt.Price,
                    PackageNumber = packageNumberBase + i + 1,
                };
                _context.OrderItems.Add(orderItem);

                var series = new TreatmentSeries
                {
                    Id          = Guid.NewGuid(),
                    OrderItemId = orderItem.Id,
                    CustomerId  = customerId,
                };

                if (!pt.IsTimerBased)
                {
                    series.TotalTreatments     = pt.IsSeries ? (pt.TreatmentCount ?? 0) : 1;
                    series.CompletedTreatments = 0;
                    series.TotalMinutes        = 0;
                    series.UsedMinutes         = 0;
                }
                else
                {
                    series.TotalTreatments     = 0;
                    series.CompletedTreatments = 0;
                    series.TotalMinutes        = pt.IsSeries
                        ? (pt.TreatmentCount ?? 0) * (pt.MinutesPerTreatment ?? 0)
                        : (pt.MinutesPerTreatment ?? 0);
                    series.UsedMinutes         = 0;
                }

                _context.TreatmentSeries.Add(series);
            }

            await _context.SaveChangesAsync();

            // Reload to pick up the PostgreSQL-computed RemainingBalance
            await _context.Entry(order).ReloadAsync();

            // Reload navigation for DTO building
            await _context.Entry(order)
                .Collection(o => o.Items)
                .Query()
                .Include(i => i.PackageType)
                .Include(i => i.TreatmentSeries)
                .LoadAsync();

            await transaction.CommitAsync();

            var paymentCount = 0;
            return CreatedAtAction(nameof(GetById), new { id = order.Id }, ToDto(order, paymentCount));
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    /// <summary>PUT /api/v1/orders/{id} — Manager only.</summary>
    [HttpPut("api/v1/orders/{id:guid}")]
    [Authorize(Policy = "Manager")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateOrderRequest request)
    {
        var order = await _orderRepository.GetByIdWithDetailsAsync(id);
        if (order == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "ההזמנה לא נמצאה.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (request.DiscountPercentage < 0 || request.DiscountPercentage > 100)
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "אחוז ההנחה חייב להיות בין 0 ל-100.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (request.MaxPaymentCount < 1)
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "מקסימום תשלומים חייב להיות לפחות 1.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        order.DiscountPercentage = request.DiscountPercentage;
        order.DiscountedPrice    = Math.Round(order.OriginalPrice * (1m - request.DiscountPercentage / 100m), 2, MidpointRounding.AwayFromZero);
        order.MaxPaymentCount    = request.MaxPaymentCount;

        _context.CustomerOrders.Update(order);
        await _context.SaveChangesAsync();
        await _context.Entry(order).ReloadAsync();

        var paymentCount = await _orderRepository.GetPaymentCountAsync(id);
        return Ok(ToDto(order, paymentCount));
    }

    /// <summary>DELETE /api/v1/orders/{id} — Manager only.</summary>
    [HttpDelete("api/v1/orders/{id:guid}")]
    [Authorize(Policy = "Manager")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var order = await _orderRepository.GetByIdWithDetailsAsync(id);
        if (order == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "ההזמנה לא נמצאה.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var hasDependent = await _orderRepository.HasDependentDataAsync(id);
        if (hasDependent)
            throw new DomainConflictException("לא ניתן למחוק — קיימים תשלומים או טיפולים");

        await _orderRepository.DeleteAsync(order);
        return NoContent();
    }

    private static OrderDto ToDto(CustomerOrder order, int paymentCount) => new(
        order.Id,
        order.CustomerId,
        DateOnly.FromDateTime(order.OrderDate),
        order.OriginalPrice,
        order.DiscountedPrice,
        order.DiscountPercentage,
        order.MaxPaymentCount,
        order.AmountPaid,
        order.RemainingBalance,
        paymentCount,
        order.Items.Select(i => new OrderItemDto(
            i.Id,
            i.PackageTypeId,
            i.PackageType?.Name ?? string.Empty,
            i.UnitPrice,
            i.TreatmentSeries?.Id,
            i.PackageNumber)).ToList());
}
