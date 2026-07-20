using BeautyCareClinic.Application.DTOs;
using BeautyCareClinic.Domain.Enums;
using BeautyCareClinic.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BeautyCareClinic.Api.Controllers;

/// <summary>
/// Phase 011 Architecture Review Correction #1 — small dedicated read-only endpoint exposing
/// therapist working-hours / unavailable-dates / capabilities to any authenticated user (not
/// Manager-restricted like UsersController, since the calendar's therapist picker and booking
/// flow — Q7 — must be usable by Therapist-role users too, not just Managers). No write endpoint
/// is added here; TherapistWorkingHours/TherapistUnavailableDate/TherapistCapability remain
/// seed-only data for Phase 011 (Q4 stays deferred).
///
/// Bugfix (post-Phase-011): also exposes GET /api/v1/therapists — a minimal name+id-only list of
/// Role=Therapist users, following the exact same "narrow, non-Manager-gated read endpoint"
/// pattern as the availability action below. This exists because UsersController (which the
/// therapist picker originally called via GET /users?role=Therapist) is Manager-only for ALL
/// actions since its UserDto carries email/phone for every user — relaxing that class-wide would
/// be a real PII exposure expansion. UsersController itself is intentionally left untouched.
/// </summary>
[ApiController]
[Authorize]
[Route("api/v1/therapists")]
public class TherapistAvailabilityController : ControllerBase
{
    private readonly AppDbContext _context;

    public TherapistAvailabilityController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>GET /api/v1/therapists — Both roles. Name+id only, no PII.</summary>
    [HttpGet]
    public async Task<IActionResult> GetTherapists()
    {
        var therapists = await _context.Users
            .AsNoTracking()
            .Where(u => u.Role == UserRole.Therapist)
            .OrderBy(u => u.FullName)
            .Select(u => new TherapistSummaryDto(u.Id, u.FullName))
            .ToListAsync();

        return Ok(therapists);
    }

    /// <summary>GET /api/v1/therapists/availability — Both roles.</summary>
    [HttpGet("availability")]
    public async Task<IActionResult> Get()
    {
        // NOTE: entities are materialized first, then projected to DTOs in memory. Projecting
        // `(int)wh.Weekday` directly inside an EF Select() gets translated to a SQL CAST on the
        // "Weekday" text column (the enum's HasConversion<string>() mapping isn't applied through
        // an explicit numeric cast in a server-side projection), which fails at runtime with
        // Postgres error 22P02 ("invalid input syntax for type integer") since the stored value is
        // text like "Sunday", not a number. Materializing first avoids the bad SQL translation.
        var workingHoursEntities = await _context.TherapistWorkingHours.AsNoTracking().ToListAsync();
        var unavailableDateEntities = await _context.TherapistUnavailableDates.AsNoTracking().ToListAsync();
        var capabilityEntities = await _context.TherapistCapabilities.AsNoTracking().ToListAsync();

        var workingHours = workingHoursEntities
            .Select(wh => new TherapistWorkingHoursDto(wh.Id, wh.UserId, (int)wh.Weekday, wh.StartTime, wh.EndTime))
            .ToList();

        var unavailableDates = unavailableDateEntities
            .Select(ud => new TherapistUnavailableDateDto(ud.Id, ud.UserId, DateOnly.FromDateTime(ud.UnavailableDate)))
            .ToList();

        var capabilities = capabilityEntities
            .Select(c => new TherapistCapabilityDto(c.Id, c.UserId, c.TreatmentTypeId))
            .ToList();

        return Ok(new TherapistAvailabilityResponse(workingHours, unavailableDates, capabilities));
    }
}
