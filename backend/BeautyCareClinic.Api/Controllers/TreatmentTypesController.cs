using BeautyCareClinic.Application.DTOs;
using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BeautyCareClinic.Api.Controllers;

[ApiController]
[Route("api/v1/treatment-types")]
[Authorize]
public class TreatmentTypesController : ControllerBase
{
    private readonly ITreatmentTypeRepository _repository;

    public TreatmentTypesController(ITreatmentTypeRepository repository)
    {
        _repository = repository;
    }

    /// <summary>GET /api/v1/treatment-types — Both roles.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var types = await _repository.GetAllAsync();
        return Ok(types.Select(t => new TreatmentTypeDto(t.Id, t.Name)));
    }

    /// <summary>GET /api/v1/treatment-types/{id} — Both roles.</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var type = await _repository.GetByIdAsync(id);
        if (type == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, $"TreatmentType {id} not found.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        return Ok(new TreatmentTypeDto(type.Id, type.Name));
    }

    /// <summary>POST /api/v1/treatment-types — Manager only.</summary>
    [HttpPost]
    [Authorize(Policy = "Manager")]
    public async Task<IActionResult> Create([FromBody] CreateTreatmentTypeRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "Name is required.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var nameExists = await _repository.ExistsByNameAsync(request.Name.Trim());
        if (nameExists)
            return Conflict(new ErrorResponse(ErrorCodes.Conflict, $"A treatment type named '{request.Name}' already exists.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var treatmentType = new TreatmentType
        {
            Id   = Guid.NewGuid(),
            Name = request.Name.Trim()
        };

        var created = await _repository.CreateAsync(treatmentType);
        return CreatedAtAction(nameof(GetById), new { id = created.Id },
            new TreatmentTypeDto(created.Id, created.Name));
    }

    /// <summary>PUT /api/v1/treatment-types/{id} — Manager only.</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Manager")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTreatmentTypeRequest request)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, $"TreatmentType {id} not found.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "Name is required.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var nameExists = await _repository.ExistsByNameAsync(request.Name.Trim(), excludeId: id);
        if (nameExists)
            return Conflict(new ErrorResponse(ErrorCodes.Conflict, $"A treatment type named '{request.Name}' already exists.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        existing.Name = request.Name.Trim();
        var updated = await _repository.UpdateAsync(existing);
        return Ok(new TreatmentTypeDto(updated.Id, updated.Name));
    }

    /// <summary>DELETE /api/v1/treatment-types/{id} — Manager only.</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Manager")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, $"TreatmentType {id} not found.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var hasRelated = await _repository.HasRelatedDataAsync(id);
        if (hasRelated)
            return Conflict(new ErrorResponse(ErrorCodes.Conflict,
                "Cannot delete treatment type that is referenced by packages, appointments, treatments, notes, or therapist capabilities.",
                DateTime.UtcNow, HttpContext.TraceIdentifier));

        await _repository.DeleteAsync(id);
        return NoContent();
    }
}
