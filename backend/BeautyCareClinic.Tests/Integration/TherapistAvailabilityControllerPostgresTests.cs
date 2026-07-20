using BeautyCareClinic.Api.Controllers;
using BeautyCareClinic.Application.DTOs;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Domain.Enums;
using BeautyCareClinic.Domain.Exceptions;
using BeautyCareClinic.Infrastructure.Data;
using BeautyCareClinic.Infrastructure.Repositories;
using Microsoft.AspNetCore.Http;
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
/// Phase 012 — also covers the write/management CRUD added to this controller (RC-1): full CRUD
/// cycles on working hours / capabilities / unavailable dates, active-therapist gating on writes,
/// and the RC-3 Kind=Utc/date-only persistence convention for unavailable dates.
///
/// Requires a reachable Postgres instance via the ConnectionStrings__DefaultConnection env var
/// (same variable used by the EF CLI tooling — see DesignTimeDbContextFactory.cs).
/// </summary>
public class TherapistAvailabilityControllerPostgresTests : IAsyncLifetime
{
    private AppDbContext _context = null!;
    private User _therapist = null!;
    private User _inactiveTherapist = null!;
    private User _manager = null!;
    private TreatmentType _treatmentType = null!;
    private TherapistWorkingHours _workingHours = null!;
    private TherapistCapability _capability = null!;
    private TherapistUnavailableDate _unavailableDate = null!;
    private readonly List<Guid> _createdUserIds = new();

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
            Role = UserRole.Therapist, IsActive = true,
        };
        _inactiveTherapist = new User
        {
            Id = Guid.NewGuid(), FullName = "מטפלת לא פעילה", Email = $"avail-inactive-{Guid.NewGuid():N}@test.com",
            Role = UserRole.Therapist, IsActive = false,
        };
        _manager = new User
        {
            Id = Guid.NewGuid(), FullName = "מנהלת זמינות", Email = $"mgr-avail-{Guid.NewGuid():N}@test.com",
            Role = UserRole.Manager,
        };
        _treatmentType = new TreatmentType { Id = Guid.NewGuid(), Name = "טיפול זמינות " + Guid.NewGuid() };
        _context.Users.AddRange(_therapist, _inactiveTherapist, _manager);
        _context.TreatmentTypes.Add(_treatmentType);
        await _context.SaveChangesAsync();
        _createdUserIds.AddRange(new[] { _therapist.Id, _inactiveTherapist.Id, _manager.Id });

        _workingHours = new TherapistWorkingHours
        {
            Id = Guid.NewGuid(), UserId = _therapist.Id, Weekday = Weekday.Sunday, StartTime = "09:00", EndTime = "17:00",
        };
        _capability = new TherapistCapability { Id = Guid.NewGuid(), UserId = _therapist.Id, TreatmentTypeId = _treatmentType.Id };
        _unavailableDate = new TherapistUnavailableDate
        {
            Id = Guid.NewGuid(), UserId = _therapist.Id, UnavailableDate = DateTime.SpecifyKind(DateTime.UtcNow.Date.AddDays(20), DateTimeKind.Utc),
        };
        _context.TherapistWorkingHours.Add(_workingHours);
        _context.TherapistCapabilities.Add(_capability);
        _context.TherapistUnavailableDates.Add(_unavailableDate);
        await _context.SaveChangesAsync();
    }

    public async Task DisposeAsync()
    {
        _context.TherapistWorkingHours.RemoveRange(
            _context.TherapistWorkingHours.Where(w => _createdUserIds.Contains(w.UserId)));
        _context.TherapistCapabilities.RemoveRange(
            _context.TherapistCapabilities.Where(c => _createdUserIds.Contains(c.UserId)));
        _context.TherapistUnavailableDates.RemoveRange(
            _context.TherapistUnavailableDates.Where(d => _createdUserIds.Contains(d.UserId)));
        await _context.SaveChangesAsync();

        _context.TreatmentTypes.Remove(_treatmentType);
        foreach (var userId in _createdUserIds)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user != null) _context.Users.Remove(user);
        }
        await _context.SaveChangesAsync();
        await _context.DisposeAsync();
    }

    private static TherapistAvailabilityController BuildController(AppDbContext context)
    {
        var controller = new TherapistAvailabilityController(context, new TreatmentTypeRepository(context));
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        return controller;
    }

    // =========================================================================
    // Existing read endpoints (Phase 011, extended with Phase 012 active-filtering)
    // =========================================================================

    [Fact]
    public async Task Get_AgainstRealPostgres_Returns200_WithWeekdayAsInt_MatchingSundayEqualsZero()
    {
        var controller = BuildController(_context);

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
    /// Phase 012: also excludes inactive therapists (always active-only, no query param).
    /// </summary>
    [Fact]
    public async Task GetTherapists_AgainstRealPostgres_ReturnsOnlyActiveTherapists_NameAndIdOnly()
    {
        var controller = BuildController(_context);

        var result = await controller.GetTherapists();

        var ok = Assert.IsType<OkObjectResult>(result);
        var therapists = Assert.IsAssignableFrom<List<TherapistSummaryDto>>(ok.Value);

        Assert.Contains(therapists, t => t.Id == _therapist.Id && t.FullName == _therapist.FullName);
        Assert.DoesNotContain(therapists, t => t.Id == _manager.Id);
        Assert.DoesNotContain(therapists, t => t.Id == _inactiveTherapist.Id);
    }

    [Fact]
    public async Task Get_Availability_DefaultExcludesInactiveTherapistRows_IncludeInactiveIncludesThem()
    {
        var inactiveHours = new TherapistWorkingHours
        {
            Id = Guid.NewGuid(), UserId = _inactiveTherapist.Id, Weekday = Weekday.Monday, StartTime = "09:00", EndTime = "17:00",
        };
        _context.TherapistWorkingHours.Add(inactiveHours);
        await _context.SaveChangesAsync();

        var controller = BuildController(_context);

        var defaultResult = await controller.Get();
        var defaultOk = Assert.IsType<OkObjectResult>(defaultResult);
        var defaultResponse = Assert.IsType<TherapistAvailabilityResponse>(defaultOk.Value);
        Assert.DoesNotContain(defaultResponse.WorkingHours, w => w.Id == inactiveHours.Id);

        var includeInactiveResult = await controller.Get(includeInactive: true);
        var includeOk = Assert.IsType<OkObjectResult>(includeInactiveResult);
        var includeResponse = Assert.IsType<TherapistAvailabilityResponse>(includeOk.Value);
        Assert.Contains(includeResponse.WorkingHours, w => w.Id == inactiveHours.Id);
    }

    // =========================================================================
    // Working Hours CRUD (Phase 012)
    // =========================================================================

    [Fact]
    public async Task WorkingHours_FullCrudCycle_Succeeds()
    {
        var controller = BuildController(_context);

        // Create — a weekday with no existing row (Tuesday).
        var createResult = await controller.CreateWorkingHours(_therapist.Id,
            new CreateWorkingHoursRequest(2, "08:00", "16:00"));
        var created = Assert.IsType<CreatedAtActionResult>(createResult);
        var createdDto = Assert.IsType<TherapistWorkingHoursDto>(created.Value);
        Assert.Equal(2, createdDto.Weekday);
        Assert.Equal("08:00", createdDto.StartTime);

        // Get — includes the new row.
        var getResult = await controller.GetWorkingHours(_therapist.Id);
        var getOk = Assert.IsType<OkObjectResult>(getResult);
        var rows = Assert.IsAssignableFrom<IEnumerable<TherapistWorkingHoursDto>>(getOk.Value);
        Assert.Contains(rows, r => r.Weekday == 2 && r.StartTime == "08:00");

        // Update — replaces the row via PUT.
        var updateResult = await controller.UpdateWorkingHours(_therapist.Id, 2,
            new UpdateWorkingHoursRequest("09:00", "15:00"));
        var updateOk = Assert.IsType<OkObjectResult>(updateResult);
        var updatedDto = Assert.IsType<TherapistWorkingHoursDto>(updateOk.Value);
        Assert.Equal("09:00", updatedDto.StartTime);
        Assert.Equal("15:00", updatedDto.EndTime);

        var persisted = await _context.TherapistWorkingHours.AsNoTracking()
            .SingleAsync(w => w.UserId == _therapist.Id && w.Weekday == Weekday.Tuesday);
        Assert.Equal("09:00", persisted.StartTime);

        // Delete.
        var deleteResult = await controller.DeleteWorkingHours(_therapist.Id, 2);
        Assert.IsType<NoContentResult>(deleteResult);
        var deleted = await _context.TherapistWorkingHours
            .AnyAsync(w => w.UserId == _therapist.Id && w.Weekday == Weekday.Tuesday);
        Assert.False(deleted);
    }

    [Fact]
    public async Task WorkingHours_Update_UpsertsWhenNoExistingRowForWeekday()
    {
        var controller = BuildController(_context);

        // Wednesday has no seeded row for _therapist — PUT should create it.
        var result = await controller.UpdateWorkingHours(_therapist.Id, 3, new UpdateWorkingHoursRequest("10:00", "14:00"));

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = Assert.IsType<TherapistWorkingHoursDto>(ok.Value);
        Assert.Equal(3, dto.Weekday);

        var persisted = await _context.TherapistWorkingHours.AsNoTracking()
            .SingleOrDefaultAsync(w => w.UserId == _therapist.Id && w.Weekday == Weekday.Wednesday);
        Assert.NotNull(persisted);
    }

    [Fact]
    public async Task WorkingHours_Create_DuplicateWeekday_ThrowsDomainConflictException()
    {
        var controller = BuildController(_context);

        // Sunday already has a seeded row for _therapist.
        await Assert.ThrowsAsync<DomainConflictException>(() =>
            controller.CreateWorkingHours(_therapist.Id, new CreateWorkingHoursRequest(0, "10:00", "12:00")));
    }

    [Fact]
    public async Task WorkingHours_Create_OneNullOneSet_ThrowsDomainValidationException()
    {
        var controller = BuildController(_context);

        await Assert.ThrowsAsync<DomainValidationException>(() =>
            controller.CreateWorkingHours(_therapist.Id, new CreateWorkingHoursRequest(4, "09:00", null)));
    }

    [Fact]
    public async Task WorkingHours_Create_StartAfterEnd_ThrowsDomainValidationException()
    {
        var controller = BuildController(_context);

        await Assert.ThrowsAsync<DomainValidationException>(() =>
            controller.CreateWorkingHours(_therapist.Id, new CreateWorkingHoursRequest(4, "18:00", "09:00")));
    }

    [Fact]
    public async Task WorkingHours_Create_BothNull_DayOff_Succeeds()
    {
        var controller = BuildController(_context);

        var result = await controller.CreateWorkingHours(_therapist.Id, new CreateWorkingHoursRequest(5, null, null));

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var dto = Assert.IsType<TherapistWorkingHoursDto>(created.Value);
        Assert.Equal(string.Empty, dto.StartTime);
        Assert.Equal(string.Empty, dto.EndTime);
    }

    [Fact]
    public async Task WorkingHours_Create_NonExistentTherapist_Returns404()
    {
        var controller = BuildController(_context);

        var result = await controller.CreateWorkingHours(Guid.NewGuid(), new CreateWorkingHoursRequest(1, "09:00", "17:00"));

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal(404, notFound.StatusCode);
    }

    [Fact]
    public async Task WorkingHours_Create_TargetIsManagerNotTherapist_ThrowsDomainValidationException()
    {
        var controller = BuildController(_context);

        await Assert.ThrowsAsync<DomainValidationException>(() =>
            controller.CreateWorkingHours(_manager.Id, new CreateWorkingHoursRequest(1, "09:00", "17:00")));
    }

    [Fact]
    public async Task WorkingHours_Create_TargetIsInactiveTherapist_ThrowsDomainValidationException()
    {
        var controller = BuildController(_context);

        await Assert.ThrowsAsync<DomainValidationException>(() =>
            controller.CreateWorkingHours(_inactiveTherapist.Id, new CreateWorkingHoursRequest(1, "09:00", "17:00")));
    }

    [Fact]
    public async Task WorkingHours_Delete_NonExistentWeekdayRow_Returns404()
    {
        var controller = BuildController(_context);

        // _therapist has no row for Saturday (6).
        var result = await controller.DeleteWorkingHours(_therapist.Id, 6);

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal(404, notFound.StatusCode);
    }

    // =========================================================================
    // Capabilities CRUD (Phase 012)
    // =========================================================================

    [Fact]
    public async Task Capabilities_FullCrudCycle_Succeeds()
    {
        var controller = BuildController(_context);
        var otherTreatmentType = new TreatmentType { Id = Guid.NewGuid(), Name = "טיפול הסמכה " + Guid.NewGuid() };
        _context.TreatmentTypes.Add(otherTreatmentType);
        await _context.SaveChangesAsync();

        try
        {
            var createResult = await controller.CreateCapability(_therapist.Id, new CreateCapabilityRequest(otherTreatmentType.Id));
            var created = Assert.IsType<CreatedAtActionResult>(createResult);
            var createdDto = Assert.IsType<TherapistCapabilityDto>(created.Value);
            Assert.Equal(otherTreatmentType.Id, createdDto.TreatmentTypeId);

            var getResult = await controller.GetCapabilities(_therapist.Id);
            var getOk = Assert.IsType<OkObjectResult>(getResult);
            var rows = Assert.IsAssignableFrom<IEnumerable<TherapistCapabilityDto>>(getOk.Value);
            Assert.Contains(rows, r => r.TreatmentTypeId == otherTreatmentType.Id);

            var deleteResult = await controller.DeleteCapability(_therapist.Id, otherTreatmentType.Id);
            Assert.IsType<NoContentResult>(deleteResult);

            var stillExists = await _context.TherapistCapabilities
                .AnyAsync(c => c.UserId == _therapist.Id && c.TreatmentTypeId == otherTreatmentType.Id);
            Assert.False(stillExists);
        }
        finally
        {
            _context.TreatmentTypes.Remove(otherTreatmentType);
            await _context.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task Capabilities_Create_Duplicate_ThrowsDomainConflictException()
    {
        var controller = BuildController(_context);

        // _therapist already has a capability row for _treatmentType (seeded).
        await Assert.ThrowsAsync<DomainConflictException>(() =>
            controller.CreateCapability(_therapist.Id, new CreateCapabilityRequest(_treatmentType.Id)));
    }

    [Fact]
    public async Task Capabilities_Create_NonExistentTreatmentType_Returns404()
    {
        var controller = BuildController(_context);

        var result = await controller.CreateCapability(_therapist.Id, new CreateCapabilityRequest(Guid.NewGuid()));

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal(404, notFound.StatusCode);
    }

    [Fact]
    public async Task Capabilities_Delete_NonExistent_Returns404()
    {
        var controller = BuildController(_context);

        var result = await controller.DeleteCapability(_therapist.Id, Guid.NewGuid());

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal(404, notFound.StatusCode);
    }

    // =========================================================================
    // Unavailable Dates CRUD (Phase 012, RC-3 storage convention)
    // =========================================================================

    [Fact]
    public async Task UnavailableDates_FullCrudCycle_Succeeds_AndPersistsAsUtcDateOnly()
    {
        var controller = BuildController(_context);
        var date = DateOnly.FromDateTime(DateTime.UtcNow.Date.AddDays(30));

        var createResult = await controller.CreateUnavailableDate(_therapist.Id, new CreateUnavailableDateRequest(date));
        var created = Assert.IsType<CreatedAtActionResult>(createResult);
        var createdDto = Assert.IsType<TherapistUnavailableDateDto>(created.Value);
        Assert.Equal(date, createdDto.Date);

        // RC-3 — must be persisted with Kind=Utc, date-only, matching AvailabilityService's query
        // convention (DateTime.SpecifyKind(startTime.Date, DateTimeKind.Utc)) and DbSeeder's writes.
        var persisted = await _context.TherapistUnavailableDates.AsNoTracking()
            .SingleAsync(d => d.UserId == _therapist.Id && d.UnavailableDate == DateTime.SpecifyKind(date.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc));
        Assert.Equal(TimeSpan.Zero, persisted.UnavailableDate.TimeOfDay);

        var getResult = await controller.GetUnavailableDates(_therapist.Id);
        var getOk = Assert.IsType<OkObjectResult>(getResult);
        var rows = Assert.IsAssignableFrom<IEnumerable<TherapistUnavailableDateDto>>(getOk.Value);
        Assert.Contains(rows, r => r.Date == date);

        var isoDate = date.ToString("yyyy-MM-dd");
        var deleteResult = await controller.DeleteUnavailableDate(_therapist.Id, isoDate);
        Assert.IsType<NoContentResult>(deleteResult);

        var stillExists = await _context.TherapistUnavailableDates
            .AnyAsync(d => d.UserId == _therapist.Id && d.UnavailableDate == DateTime.SpecifyKind(date.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc));
        Assert.False(stillExists);
    }

    [Fact]
    public async Task UnavailableDates_Create_DuplicateDate_ThrowsDomainConflictException()
    {
        var controller = BuildController(_context);
        var seededDate = DateOnly.FromDateTime(_unavailableDate.UnavailableDate);

        await Assert.ThrowsAsync<DomainConflictException>(() =>
            controller.CreateUnavailableDate(_therapist.Id, new CreateUnavailableDateRequest(seededDate)));
    }

    [Fact]
    public async Task UnavailableDates_Delete_InvalidDateFormat_ThrowsDomainValidationException()
    {
        var controller = BuildController(_context);

        await Assert.ThrowsAsync<DomainValidationException>(() =>
            controller.DeleteUnavailableDate(_therapist.Id, "not-a-date"));
    }

    [Fact]
    public async Task UnavailableDates_Delete_NonExistentDate_Returns404()
    {
        var controller = BuildController(_context);
        var farFutureDate = DateOnly.FromDateTime(DateTime.UtcNow.Date.AddYears(2)).ToString("yyyy-MM-dd");

        var result = await controller.DeleteUnavailableDate(_therapist.Id, farFutureDate);

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal(404, notFound.StatusCode);
    }
}
