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
public class TreatmentsController : ControllerBase
{
    private readonly ICustomerRepository _customerRepository;
    private readonly ITreatmentTypeRepository _treatmentTypeRepository;
    private readonly ITreatmentRepository _treatmentRepository;
    private readonly IUserRepository _userRepository;
    private readonly ICurrentUserService _currentUserService;
    private readonly AppDbContext _context;

    public TreatmentsController(
        ICustomerRepository customerRepository,
        ITreatmentTypeRepository treatmentTypeRepository,
        ITreatmentRepository treatmentRepository,
        IUserRepository userRepository,
        ICurrentUserService currentUserService,
        AppDbContext context)
    {
        _customerRepository      = customerRepository;
        _treatmentTypeRepository = treatmentTypeRepository;
        _treatmentRepository     = treatmentRepository;
        _userRepository          = userRepository;
        _currentUserService      = currentUserService;
        _context                 = context;
    }

    /// <summary>GET /api/v1/customers/{customerId}/treatments — Both roles.</summary>
    [HttpGet("api/v1/customers/{customerId:guid}/treatments")]
    public async Task<IActionResult> ListByCustomer(Guid customerId)
    {
        var customer = await _customerRepository.GetByIdAsync(customerId);
        if (customer == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "הלקוח לא נמצא.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var treatments = await _treatmentRepository.ListByCustomerAsync(customerId);
        return Ok(treatments.Select(ToDto));
    }

    /// <summary>GET /api/v1/treatments/{id} — Both roles.</summary>
    [HttpGet("api/v1/treatments/{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var treatment = await _treatmentRepository.GetByIdAsync(id);
        if (treatment == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "הטיפול לא נמצא.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        return Ok(ToDto(treatment));
    }

    /// <summary>
    /// POST /api/v1/customers/{customerId}/treatments — Both roles.
    /// If TreatmentSeriesId is supplied, uses SELECT FOR UPDATE row-level lock on the series.
    /// </summary>
    [HttpPost("api/v1/customers/{customerId:guid}/treatments")]
    public async Task<IActionResult> Create(Guid customerId, [FromBody] CreateTreatmentRequest request)
    {
        // Validation: DurationMinutes >= 0 (0 is allowed for quantity-based series)
        if (request.DurationMinutes < 0)
            throw new DomainValidationException("משך הטיפול אינו יכול להיות שלילי");

        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var treatmentDate = request.TreatmentDate ?? today;
        // Preserve the current time for today's treatments; use midnight for back-dated entries
        var treatmentTime = treatmentDate == today ? TimeOnly.FromDateTime(now) : TimeOnly.MinValue;

        if (treatmentDate > today)
            throw new DomainValidationException("תאריך הטיפול אינו יכול להיות בעתיד");

        // Verify customer exists
        var customer = await _customerRepository.GetByIdAsync(customerId);
        if (customer == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "הלקוח לא נמצא.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        // Verify TreatmentType exists
        var treatmentType = await _treatmentTypeRepository.GetByIdAsync(request.TreatmentTypeId);
        if (treatmentType == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "סוג הטיפול לא נמצא.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        // Resolve current user from JWT
        var currentUserId = _currentUserService.GetCurrentUserId();
        var currentUser   = await _userRepository.GetByIdAsync(currentUserId);
        var performedBy   = currentUser?.FullName ?? string.Empty;

        Treatment treatment;

        if (request.TreatmentSeriesId.HasValue)
        {
            // Transaction + row-level lock on TreatmentSeries (same pattern as PaymentsController)
            await using var tx = await _context.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
            try
            {
                // Row-level lock: no-op UPDATE acquires an exclusive row lock within the transaction
                await _context.Database.ExecuteSqlRawAsync(
                    "UPDATE \"TreatmentSeries\" SET \"Id\" = \"Id\" WHERE \"Id\" = {0}",
                    request.TreatmentSeriesId.Value);

                // Load series with OrderItem + PackageType to determine timer vs quantity
                var series = await _context.TreatmentSeries
                    .Include(s => s.OrderItem)
                        .ThenInclude(oi => oi.PackageType)
                    .FirstOrDefaultAsync(s => s.Id == request.TreatmentSeriesId.Value);

                if (series == null)
                    return NotFound(new ErrorResponse(ErrorCodes.NotFound, "סדרת הטיפולים לא נמצאה.", DateTime.UtcNow, HttpContext.TraceIdentifier));

                var isTimerBased = series.OrderItem.PackageType.IsTimerBased;

                if (isTimerBased)
                {
                    series.UsedMinutes = Math.Min(
                        series.UsedMinutes + request.DurationMinutes,
                        series.TotalMinutes);
                }
                else
                {
                    series.CompletedTreatments = Math.Min(
                        series.CompletedTreatments + 1,
                        series.TotalTreatments);
                }

                _context.TreatmentSeries.Update(series);

                treatment = new Treatment
                {
                    Id                  = Guid.NewGuid(),
                    CustomerId          = customerId,
                    TreatmentTypeId     = request.TreatmentTypeId,
                    TreatmentSeriesId   = request.TreatmentSeriesId,
                    TreatmentDate       = treatmentDate.ToDateTime(treatmentTime, DateTimeKind.Utc),
                    DurationMinutes     = request.DurationMinutes,
                    Notes               = request.Notes,
                    UserId              = currentUserId,
                    PerformedByFullName = performedBy,
                };

                _context.Treatments.Add(treatment);
                await _context.SaveChangesAsync();
                await tx.CommitAsync();
            }
            catch
            {
                await tx.RollbackAsync();
                throw;
            }
        }
        else
        {
            // No series — create standalone treatment, no transaction needed
            treatment = new Treatment
            {
                Id                  = Guid.NewGuid(),
                CustomerId          = customerId,
                TreatmentTypeId     = request.TreatmentTypeId,
                TreatmentSeriesId   = null,
                TreatmentDate       = treatmentDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
                DurationMinutes     = request.DurationMinutes,
                Notes               = request.Notes,
                UserId              = currentUserId,
                PerformedByFullName = performedBy,
            };
            await _treatmentRepository.AddAsync(treatment);
        }

        // Reload the treatment with TreatmentType for the response DTO
        var saved = await _treatmentRepository.GetByIdAsync(treatment.Id);
        return CreatedAtAction(nameof(GetById), new { id = treatment.Id }, ToDto(saved!));
    }

    /// <summary>
    /// DELETE /api/v1/treatments/{id} — Both roles.
    /// Only the author or a Manager may delete a treatment.
    /// If associated with a series, reverses the series progress under a row-level lock.
    /// </summary>
    [HttpDelete("api/v1/treatments/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var treatment = await _treatmentRepository.GetByIdAsync(id);
        if (treatment == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "הטיפול לא נמצא.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var currentUserId = _currentUserService.GetCurrentUserId();
        var isManager     = _currentUserService.IsManager();

        if (treatment.UserId != currentUserId && !isManager)
            return StatusCode(403, new ErrorResponse(ErrorCodes.Forbidden, "אין הרשאה למחוק טיפול זה.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (treatment.TreatmentSeriesId.HasValue)
        {
            await using var tx = await _context.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
            try
            {
                await _context.Database.ExecuteSqlRawAsync(
                    "UPDATE \"TreatmentSeries\" SET \"Id\" = \"Id\" WHERE \"Id\" = {0}",
                    treatment.TreatmentSeriesId.Value);

                var series = await _context.TreatmentSeries
                    .Include(s => s.OrderItem)
                        .ThenInclude(oi => oi.PackageType)
                    .FirstOrDefaultAsync(s => s.Id == treatment.TreatmentSeriesId.Value);

                if (series != null)
                {
                    var isTimerBased = series.OrderItem.PackageType.IsTimerBased;

                    if (isTimerBased)
                    {
                        series.UsedMinutes = Math.Max(series.UsedMinutes - treatment.DurationMinutes, 0);
                    }
                    else
                    {
                        series.CompletedTreatments = Math.Max(series.CompletedTreatments - 1, 0);
                    }

                    _context.TreatmentSeries.Update(series);
                }

                _context.Treatments.Remove(treatment);
                await _context.SaveChangesAsync();
                await tx.CommitAsync();
            }
            catch
            {
                await tx.RollbackAsync();
                throw;
            }
        }
        else
        {
            await _treatmentRepository.DeleteAsync(treatment);
        }

        return NoContent();
    }

    private static TreatmentDto ToDto(Treatment t) => new(
        t.Id,
        t.CustomerId,
        t.TreatmentTypeId,
        t.TreatmentType?.Name ?? string.Empty,
        t.TreatmentSeriesId,
        t.TreatmentDate,
        t.DurationMinutes,
        t.Notes,
        t.UserId,
        t.PerformedByFullName);
}
