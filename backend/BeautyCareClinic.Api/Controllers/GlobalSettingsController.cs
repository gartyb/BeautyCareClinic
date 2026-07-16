using BeautyCareClinic.Application.DTOs;
using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BeautyCareClinic.Api.Controllers;

[ApiController]
[Route("api/v1/global-settings")]
[Authorize]
public class GlobalSettingsController : ControllerBase
{
    private readonly IGlobalSettingsRepository _repository;

    public GlobalSettingsController(IGlobalSettingsRepository repository)
    {
        _repository = repository;
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
        foreach (var req in requestList)
        {
            var setting = await _repository.GetByNameAsync(req.Name);
            if (setting == null)
                return NotFound(new ErrorResponse(ErrorCodes.NotFound, $"Setting '{req.Name}' not found.", DateTime.UtcNow, HttpContext.TraceIdentifier));

            setting.Value = req.Value;
            var result = await _repository.UpdateAsync(setting);
            updated.Add(new GlobalSettingDto(result.Name, result.Value));
        }

        return Ok(updated);
    }
}
