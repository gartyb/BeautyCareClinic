using BeautyCareClinic.Application.DTOs;
using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BeautyCareClinic.Api.Controllers;

[ApiController]
[Authorize]
public class TreatmentSeriesController : ControllerBase
{
    private readonly ITreatmentSeriesRepository _repository;
    private readonly ICustomerRepository _customerRepository;

    public TreatmentSeriesController(
        ITreatmentSeriesRepository repository,
        ICustomerRepository customerRepository)
    {
        _repository          = repository;
        _customerRepository  = customerRepository;
    }

    /// <summary>GET /api/v1/customers/{customerId}/treatment-series — Both roles. Returns active series only.</summary>
    [HttpGet("api/v1/customers/{customerId:guid}/treatment-series")]
    public async Task<IActionResult> ListByCustomer(Guid customerId)
    {
        var customer = await _customerRepository.GetByIdAsync(customerId);
        if (customer == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "הלקוח לא נמצא.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var series = await _repository.GetActiveByCustomerIdAsync(customerId);
        return Ok(series.Select(ToDto));
    }

    /// <summary>GET /api/v1/treatment-series/{id} — Both roles.</summary>
    [HttpGet("api/v1/treatment-series/{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var series = await _repository.GetByIdAsync(id);
        if (series == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "הסדרה לא נמצאה.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        return Ok(ToDto(series));
    }

    private static TreatmentSeriesDto ToDto(TreatmentSeries ts) => new(
        ts.Id,
        ts.OrderItemId,
        ts.OrderItem?.PackageType?.Name ?? string.Empty,
        ts.OrderItem?.PackageType?.IsTimerBased ?? false,
        ts.TotalTreatments,
        ts.CompletedTreatments,
        ts.TotalMinutes,
        ts.UsedMinutes);
}
