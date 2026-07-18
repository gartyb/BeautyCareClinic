using BeautyCareClinic.Application.DTOs;
using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Domain.Exceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BeautyCareClinic.Api.Controllers;

[ApiController]
[Authorize]
public class NotesController : ControllerBase
{
    private readonly ICustomerRepository _customerRepository;
    private readonly ITreatmentTypeRepository _treatmentTypeRepository;
    private readonly INoteRepository _noteRepository;
    private readonly IUserRepository _userRepository;
    private readonly ICurrentUserService _currentUserService;

    public NotesController(
        ICustomerRepository customerRepository,
        ITreatmentTypeRepository treatmentTypeRepository,
        INoteRepository noteRepository,
        IUserRepository userRepository,
        ICurrentUserService currentUserService)
    {
        _customerRepository      = customerRepository;
        _treatmentTypeRepository = treatmentTypeRepository;
        _noteRepository          = noteRepository;
        _userRepository          = userRepository;
        _currentUserService      = currentUserService;
    }

    /// <summary>GET /api/v1/customers/{customerId}/notes — Both roles.</summary>
    [HttpGet("api/v1/customers/{customerId:guid}/notes")]
    public async Task<IActionResult> ListByCustomer(Guid customerId)
    {
        var customer = await _customerRepository.GetByIdAsync(customerId);
        if (customer == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "הלקוח לא נמצא.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var notes = await _noteRepository.ListByCustomerAsync(customerId);
        return Ok(notes.Select(ToDto));
    }

    /// <summary>GET /api/v1/notes/{id} — Both roles.</summary>
    [HttpGet("api/v1/notes/{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var note = await _noteRepository.GetByIdAsync(id);
        if (note == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "ההערה לא נמצאה.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        return Ok(ToDto(note));
    }

    /// <summary>POST /api/v1/customers/{customerId}/notes — Both roles.</summary>
    [HttpPost("api/v1/customers/{customerId:guid}/notes")]
    public async Task<IActionResult> Create(Guid customerId, [FromBody] CreateNoteRequest request)
    {
        // Validate content
        if (string.IsNullOrWhiteSpace(request.Content))
            throw new DomainValidationException("תוכן ההערה אינו יכול להיות ריק");

        if (request.Content.Length > 5000)
            throw new DomainValidationException("תוכן ההערה חורג מ-5000 תווים");

        var today    = DateOnly.FromDateTime(DateTime.UtcNow);
        var noteDate = request.NoteDate ?? today;

        if (noteDate > today)
            throw new DomainValidationException("תאריך ההערה אינו יכול להיות בעתיד");

        // Verify customer exists
        var customer = await _customerRepository.GetByIdAsync(customerId);
        if (customer == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "הלקוח לא נמצא.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        // Optional: verify TreatmentType exists
        if (request.TreatmentTypeId.HasValue)
        {
            var tt = await _treatmentTypeRepository.GetByIdAsync(request.TreatmentTypeId.Value);
            if (tt == null)
                return NotFound(new ErrorResponse(ErrorCodes.NotFound, "סוג הטיפול לא נמצא.", DateTime.UtcNow, HttpContext.TraceIdentifier));
        }

        // Resolve current user from JWT
        var currentUserId = _currentUserService.GetCurrentUserId();
        var currentUser   = await _userRepository.GetByIdAsync(currentUserId);
        var writtenBy     = currentUser?.FullName ?? string.Empty;

        var note = new Note
        {
            Id                = Guid.NewGuid(),
            CustomerId        = customerId,
            UserId            = currentUserId,
            TreatmentTypeId   = request.TreatmentTypeId,
            NoteDate          = noteDate.ToDateTime(TimeOnly.MinValue),
            Content           = request.Content,
            WrittenByFullName = writtenBy,
        };

        await _noteRepository.AddAsync(note);

        // Reload to get navigation property for DTO
        var saved = await _noteRepository.GetByIdAsync(note.Id);
        return CreatedAtAction(nameof(GetById), new { id = note.Id }, ToDto(saved!));
    }

    /// <summary>PUT /api/v1/notes/{id} — Both roles. Only author or Manager may update.</summary>
    [HttpPut("api/v1/notes/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateNoteRequest request)
    {
        var note = await _noteRepository.GetByIdAsync(id);
        if (note == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "ההערה לא נמצאה.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var currentUserId = _currentUserService.GetCurrentUserId();
        var isManager     = _currentUserService.IsManager();

        if (note.UserId != currentUserId && !isManager)
            return StatusCode(403, new ErrorResponse(ErrorCodes.Forbidden, "אין הרשאה לעדכן הערה זו.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        // Validate content
        if (string.IsNullOrWhiteSpace(request.Content))
            throw new DomainValidationException("תוכן ההערה אינו יכול להיות ריק");

        if (request.Content.Length > 5000)
            throw new DomainValidationException("תוכן ההערה חורג מ-5000 תווים");

        var today    = DateOnly.FromDateTime(DateTime.UtcNow);
        var noteDate = request.NoteDate ?? today;

        if (noteDate > today)
            throw new DomainValidationException("תאריך ההערה אינו יכול להיות בעתיד");

        // Optional: verify TreatmentType
        if (request.TreatmentTypeId.HasValue)
        {
            var tt = await _treatmentTypeRepository.GetByIdAsync(request.TreatmentTypeId.Value);
            if (tt == null)
                return NotFound(new ErrorResponse(ErrorCodes.NotFound, "סוג הטיפול לא נמצא.", DateTime.UtcNow, HttpContext.TraceIdentifier));
        }

        note.TreatmentTypeId = request.TreatmentTypeId;
        note.NoteDate        = noteDate.ToDateTime(TimeOnly.MinValue);
        note.Content         = request.Content;

        await _noteRepository.UpdateAsync(note);

        var updated = await _noteRepository.GetByIdAsync(note.Id);
        return Ok(ToDto(updated!));
    }

    /// <summary>DELETE /api/v1/notes/{id} — Both roles. Only author or Manager may delete.</summary>
    [HttpDelete("api/v1/notes/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var note = await _noteRepository.GetByIdAsync(id);
        if (note == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "ההערה לא נמצאה.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var currentUserId = _currentUserService.GetCurrentUserId();
        var isManager     = _currentUserService.IsManager();

        if (note.UserId != currentUserId && !isManager)
            return StatusCode(403, new ErrorResponse(ErrorCodes.Forbidden, "אין הרשאה למחוק הערה זו.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        await _noteRepository.DeleteAsync(note);
        return NoContent();
    }

    private static NoteDto ToDto(Note n) => new(
        n.Id,
        n.CustomerId,
        n.TreatmentTypeId,
        n.TreatmentType?.Name,
        DateOnly.FromDateTime(n.NoteDate),
        n.Content,
        n.UserId,
        n.WrittenByFullName);
}
