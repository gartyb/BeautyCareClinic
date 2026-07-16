using BeautyCareClinic.Application.DTOs;
using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BeautyCareClinic.Api.Controllers;

[ApiController]
[Route("api/v1/customers")]
[Authorize]
public class CustomersController : ControllerBase
{
    private readonly ICustomerRepository _repository;

    public CustomersController(ICustomerRepository repository)
    {
        _repository = repository;
    }

    /// <summary>GET /api/v1/customers?search= — Both roles.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? search)
    {
        var customers = await _repository.GetAllAsync(search);
        var dtos = customers.Select(c => new CustomerDto(c.Id, c.FullName, c.Phone, c.Email));
        return Ok(dtos);
    }

    /// <summary>GET /api/v1/customers/{id} — Both roles.</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var customer = await _repository.GetByIdAsync(id);
        if (customer == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "The requested resource was not found.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        return Ok(new CustomerDto(customer.Id, customer.FullName, customer.Phone, customer.Email));
    }

    /// <summary>POST /api/v1/customers — Both roles.</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCustomerRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.FullName))
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "FullName is required.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (string.IsNullOrWhiteSpace(request.Phone))
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "Phone is required.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (!string.IsNullOrWhiteSpace(request.Email) && !IsValidEmail(request.Email))
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "Email is not valid.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var customer = new Customer
        {
            Id       = Guid.NewGuid(),
            FullName = request.FullName.Trim(),
            Phone    = request.Phone.Trim(),
            Email    = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim()
        };

        var created = await _repository.CreateAsync(customer);
        return CreatedAtAction(nameof(GetById), new { id = created.Id },
            new CustomerDto(created.Id, created.FullName, created.Phone, created.Email));
    }

    /// <summary>PUT /api/v1/customers/{id} — Manager only.</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Manager")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCustomerRequest request)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "The requested resource was not found.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (string.IsNullOrWhiteSpace(request.FullName))
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "FullName is required.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (string.IsNullOrWhiteSpace(request.Phone))
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "Phone is required.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        if (!string.IsNullOrWhiteSpace(request.Email) && !IsValidEmail(request.Email))
            return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed, "Email is not valid.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        existing.FullName = request.FullName.Trim();
        existing.Phone    = request.Phone.Trim();
        existing.Email    = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();

        var updated = await _repository.UpdateAsync(existing);
        return Ok(new CustomerDto(updated.Id, updated.FullName, updated.Phone, updated.Email));
    }

    /// <summary>DELETE /api/v1/customers/{id} — Manager only.</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Manager")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null)
            return NotFound(new ErrorResponse(ErrorCodes.NotFound, "The requested resource was not found.", DateTime.UtcNow, HttpContext.TraceIdentifier));

        var hasRelated = await _repository.HasRelatedDataAsync(id);
        if (hasRelated)
            return Conflict(new ErrorResponse(ErrorCodes.Conflict,
                "Cannot delete customer with existing orders, appointments, treatments, or notes.",
                DateTime.UtcNow, HttpContext.TraceIdentifier));

        await _repository.DeleteAsync(id);
        return NoContent();
    }

    private static bool IsValidEmail(string email)
    {
        try
        {
            var addr = new System.Net.Mail.MailAddress(email);
            return addr.Address == email.Trim();
        }
        catch
        {
            return false;
        }
    }
}
