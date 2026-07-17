using BeautyCareClinic.Application.DTOs;
using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Domain.Exceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BeautyCareClinic.Api.Controllers;

[ApiController]
[Route("api/v1/package-types")]
[Authorize]
public class PackageTypesController : ControllerBase
{
    private readonly IPackageTypeRepository _repository;

    public PackageTypesController(IPackageTypeRepository repository)
    {
        _repository = repository;
    }

    /// <summary>GET /api/v1/package-types — Both roles.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var types = await _repository.GetAllAsync();
        return Ok(types.Select(ToDto));
    }

    /// <summary>GET /api/v1/package-types/{id} — Both roles.</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var type = await _repository.GetByIdAsync(id);
        if (type == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "סוג החבילה לא נמצא.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        return Ok(ToDto(type));
    }

    /// <summary>POST /api/v1/package-types — Manager only.</summary>
    [HttpPost]
    [Authorize(Policy = "Manager")]
    public async Task<IActionResult> Create([FromBody] CreatePackageTypeRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "שם הוא שדה חובה.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (request.Price < 0)
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "מחיר לא יכול להיות שלילי.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (request.IsTimerBased && !request.IsSeries)
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "חבילה מבוססת טיימר חייבת להיות סדרה.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (request.IsTimerBased && (request.MinutesPerTreatment == null || request.MinutesPerTreatment <= 0))
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "חבילה מבוססת טיימר חייבת לכלול דקות לטיפול.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var nameExists = await _repository.ExistsByNameAsync(request.Name.Trim());
        if (nameExists)
            return Conflict(new ErrorResponse(ErrorCodes.Conflict, $"חבילה בשם '{request.Name}' כבר קיימת.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var packageType = new PackageType
        {
            Id                 = Guid.NewGuid(),
            TreatmentTypeId    = request.TreatmentTypeId,
            Name               = request.Name.Trim(),
            Price              = request.Price,
            IsSeries           = request.IsSeries,
            IsTimerBased       = request.IsTimerBased,
            TreatmentCount     = request.TreatmentCount,
            MinutesPerTreatment = request.MinutesPerTreatment,
        };

        var created = await _repository.AddAsync(packageType);

        // Reload to get navigation property
        var fetched = await _repository.GetByIdAsync(created.Id) ?? created;
        return CreatedAtAction(nameof(GetById), new { id = fetched.Id }, ToDto(fetched));
    }

    /// <summary>PUT /api/v1/package-types/{id} — Manager only.</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Manager")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePackageTypeRequest request)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "סוג החבילה לא נמצא.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "שם הוא שדה חובה.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (request.Price < 0)
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "מחיר לא יכול להיות שלילי.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (request.IsTimerBased && !request.IsSeries)
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "חבילה מבוססת טיימר חייבת להיות סדרה.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (request.IsTimerBased && (request.MinutesPerTreatment == null || request.MinutesPerTreatment <= 0))
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "חבילה מבוססת טיימר חייבת לכלול דקות לטיפול.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var nameExists = await _repository.ExistsByNameAsync(request.Name.Trim(), excludeId: id);
        if (nameExists)
            return Conflict(new ErrorResponse(ErrorCodes.Conflict, $"חבילה בשם '{request.Name}' כבר קיימת.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        existing.TreatmentTypeId     = request.TreatmentTypeId;
        existing.Name                = request.Name.Trim();
        existing.Price               = request.Price;
        existing.IsSeries            = request.IsSeries;
        existing.IsTimerBased        = request.IsTimerBased;
        existing.TreatmentCount      = request.TreatmentCount;
        existing.MinutesPerTreatment = request.MinutesPerTreatment;

        var updated = await _repository.UpdateAsync(existing);
        return Ok(ToDto(updated));
    }

    /// <summary>DELETE /api/v1/package-types/{id} — Manager only.</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Manager")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "סוג החבילה לא נמצא.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var hasOrders = await _repository.HasOrderItemsAsync(id);
        if (hasOrders)
            throw new DomainConflictException("לא ניתן למחוק — קיימות הזמנות המשתמשות בחבילה זו");

        await _repository.DeleteAsync(existing);
        return NoContent();
    }

    private static PackageTypeDto ToDto(PackageType p) => new(
        p.Id,
        p.TreatmentTypeId,
        p.Name,
        p.Price,
        p.IsSeries,
        p.IsTimerBased,
        p.TreatmentCount,
        p.MinutesPerTreatment);
}
