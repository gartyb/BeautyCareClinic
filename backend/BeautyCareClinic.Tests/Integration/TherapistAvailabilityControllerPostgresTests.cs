using BeautyCareClinic.Api.Controllers;
using BeautyCareClinic.Application.DTOs;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Domain.Enums;
using BeautyCareClinic.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace BeautyCareClinic.Tests.Integration;

/// <summary>
/// Regression coverage for a bug found during Phase 011 live verification: GET
/// /api/v1/therapists/availability threw a 500 (Postgres error 22P02 — "invalid input syntax for
/// type integer") against real Postgres. Root cause: TherapistWorkingHours.Weekday is mapped with
/// HasConversion&lt;string&gt;() (stored as text, e.g. "Sunday"), but the controller's original
/// implementation cast it to int *inside* an EF Core Select() projection — EF translated
/// `(int)wh.Weekday` to a literal SQL CAST(... AS integer) on the text column instead of applying
/// the enum's string converter first, which Postgres rejects since "Sunday" isn't numeric.
///
/// Invisible to the EF InMemory provider (see Phase011Tests.cs, which never round-trips through
/// real SQL translation) — only a test against a real Npgsql-backed AppDbContext can catch it.
///
/// Requires a reachable Postgres instance via the ConnectionStrings__DefaultConnection env var
/// (same variable used by the EF CLI tooling — see DesignTimeDbContextFactory.cs).
/// </summary>
public class TherapistAvailabilityControllerPostgresTests : IAsyncLifetime
{
    private AppDbContext _context = null!;
    private User _therapist = null!;
    private User _manager = null!;
    private TreatmentType _treatmentType = null!;
    private TherapistWorkingHours _workingHours = null!;
    private TherapistCapability _capability = null!;
    private TherapistUnavailableDate _unavailableDate = null!;

    public async Task InitializeAsync()
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? throw new InvalidOperationException(
                "Set env var ConnectionStrings__DefaultConnection to a reachable Postgres instance " +
                "to run TherapistAvailabilityControllerPostgresTests (same variable used by the EF " +
                "CLI tooling — see DesignTimeDbContextFactory.cs).");

        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connectionString).Options;
        _context = new AppDbContext(options);
        await _context.Database.MigrateAsync();

        _therapist = new User
        {
            Id = Guid.NewGuid(), FullName = "מטפלת זמינות", Email = $"avail-{Guid.NewGuid():N}@test.com",
            Role = UserRole.Therapist,
        };
        _manager = new User
        {
            Id = Guid.NewGuid(), FullName = "מנהלת זמינות", Email = $"mgr-avail-{Guid.NewGuid():N}@test.com",
            Role = UserRole.Manager,
        };
        _treatmentType = new TreatmentType { Id = Guid.NewGuid(), Name = "טיפול זמינות " + Guid.NewGuid() };
        _context.Users.AddRange(_therapist, _manager);
        _context.TreatmentTypes.Add(_treatmentType);
        await _context.SaveChangesAsync();

        _workingHours = new TherapistWorkingHours
        {
            Id = Guid.NewGuid(), UserId = _therapist.Id, Weekday = Weekday.Sunday, StartTime = "09:00", EndTime = "17:00",
        };
        _capability = new TherapistCapability { Id = Guid.NewGuid(), UserId = _therapist.Id, TreatmentTypeId = _treatmentType.Id };
        _unavailableDate = new TherapistUnavailableDate
        {
            Id = Guid.NewGuid(), UserId = _therapist.Id, UnavailableDate = DateTime.UtcNow.Date.AddDays(20),
        };
        _context.TherapistWorkingHours.Add(_workingHours);
        _context.TherapistCapabilities.Add(_capability);
        _context.TherapistUnavailableDates.Add(_unavailableDate);
        await _context.SaveChangesAsync();
    }

    public async Task DisposeAsync()
    {
        _context.TherapistWorkingHours.Remove(_workingHours);
        _context.TherapistCapabilities.Remove(_capability);
        _context.TherapistUnavailableDates.Remove(_unavailableDate);
        _context.TreatmentTypes.Remove(_treatmentType);
        _context.Users.RemoveRange(_therapist, _manager);
        await _context.SaveChangesAsync();
        await _context.DisposeAsync();
    }

    [Fact]
    public async Task Get_AgainstRealPostgres_Returns200_WithWeekdayAsInt_MatchingSundayEqualsZero()
    {
        var controller = new TherapistAvailabilityController(_context);

        // Before the fix, this throws Npgsql.PostgresException 22P02 from inside ToListAsync().
        var result = await controller.Get();

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<TherapistAvailabilityResponse>(ok.Value);

        var wh = Assert.Single(response.WorkingHours, w => w.Id == _workingHours.Id);
        Assert.Equal(0, wh.Weekday); // Sunday=0, matching Weekday enum order and the frontend's Date.getDay()
        Assert.Equal("09:00", wh.StartTime);
        Assert.Equal("17:00", wh.EndTime);

        Assert.Contains(response.Capabilities, c => c.Id == _capability.Id && c.TreatmentTypeId == _treatmentType.Id);
        Assert.Contains(response.UnavailableDates, d => d.Id == _unavailableDate.Id);
    }

    /// <summary>
    /// Bugfix regression: GET /api/v1/therapists (the new narrow, non-Manager-gated therapist
    /// picker endpoint) returns only Role=Therapist users, projected to name+id only — no
    /// email/phone (unlike UsersController's UserDto), and excludes Manager-role users.
    /// </summary>
    [Fact]
    public async Task GetTherapists_AgainstRealPostgres_ReturnsOnlyTherapists_NameAndIdOnly()
    {
        var controller = new TherapistAvailabilityController(_context);

        var result = await controller.GetTherapists();

        var ok = Assert.IsType<OkObjectResult>(result);
        var therapists = Assert.IsAssignableFrom<List<TherapistSummaryDto>>(ok.Value);

        Assert.Contains(therapists, t => t.Id == _therapist.Id && t.FullName == _therapist.FullName);
        Assert.DoesNotContain(therapists, t => t.Id == _manager.Id);
    }
}
