using BeautyCareClinic.Application.DTOs;
using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Application.Services;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BeautyCareClinic.Api.Controllers;

[ApiController]
[Route("api/v1/global-settings")]
[Authorize]
public class GlobalSettingsController : ControllerBase
{
    private readonly IGlobalSettingsRepository _repository;
    private readonly AppDbContext _dbContext;

    public GlobalSettingsController(IGlobalSettingsRepository repository, AppDbContext dbContext)
    {
        _repository = repository;
        _dbContext  = dbContext;
    }

    /// <summary>GET /api/v1/global-settings — Both roles.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var settings = await _repository.GetAllAsync();
        return Ok(settings.Select(s => new GlobalSettingDto(s.Name, s.Value)));
    }

    /// <summary>PUT /api/v1/global-settings — Manager only. Accepts an array of updates.</summary>
    [HttpPut]
    [Authorize(Policy = "Manager")]
    public async Task<IActionResult> Update([FromBody] IEnumerable<UpdateGlobalSettingRequest> requests)
    {
        var requestList = requests.ToList();

        // Validate that all keys are known
        foreach (var req in requestList)
        {
            if (!GlobalSettingsKeys.KnownKeys.Contains(req.Name))
                return BadRequest(new ErrorResponse(ErrorCodes.ValidationFailed,
                    $"Unknown setting name: '{req.Name}'. Known settings: {string.Join(", ", GlobalSettingsKeys.KnownKeys)}",
                    DateTime.UtcNow, HttpContext.TraceIdentifier));
        }

        var updated = new List<GlobalSettingDto>();

        // Wrap all updates in a transaction so a partial failure rolls back everything
        await using var transaction = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            foreach (var req in requestList)
            {
                // Fix 1: upsert — create the setting if it does not yet exist
                var setting = await _repository.GetByNameAsync(req.Name);
                setting ??= new GlobalSetting { Id = Guid.NewGuid(), Name = req.Name };
                setting.Value = req.Value;
                var result = await _repository.UpdateAsync(setting);
                updated.Add(new GlobalSettingDto(result.Name, result.Value));
            }

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }

        return Ok(updated);
    }
}
