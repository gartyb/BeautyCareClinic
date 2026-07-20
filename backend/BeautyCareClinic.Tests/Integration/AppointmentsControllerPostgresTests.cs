using System.Text.Json;
using BeautyCareClinic.Api.Controllers;
using BeautyCareClinic.Application.DTOs;
using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Domain.Enums;
using BeautyCareClinic.Domain.Exceptions;
using BeautyCareClinic.Infrastructure.Data;
using BeautyCareClinic.Infrastructure.Repositories;
using BeautyCareClinic.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace BeautyCareClinic.Tests.Integration;

/// <summary>
/// Phase 011 — real-controller coverage for <see cref="AppointmentsController"/> against a real
/// Npgsql-backed <see cref="AppDbContext"/>, the same pattern used by
/// <see cref="TreatmentsControllerPostgresTests"/> / <see cref="NotesControllerPostgresTests"/> /
/// <see cref="PaymentsControllerPostgresTests"/> / <see cref="CustomerOrdersControllerPostgresTests"/>.
///
/// Covers: create success, availability-check rejections (working hours / unavailable date /
/// capability / overlap), reschedule (including therapist-change dual-lock), cancel, 403/404/409
/// paths, and double-booking prevention under REAL concurrent requests (ADR-011-A — the
/// therapist's User-row FOR UPDATE lock). The concurrency test's genuineness was verified manually
/// during implementation: temporarily removing the `FOR UPDATE` lock line in
/// AppointmentsController.Create made Create_ConcurrentOverlappingRequestsForSameSlot_OnlyOneSucceeds
/// fail/flake (more than one request succeeding for the same slot); restoring the lock made it
/// pass reliably again.
///
/// Requires a reachable Postgres instance via the ConnectionStrings__DefaultConnection env var
/// (same variable used by the EF CLI tooling — see DesignTimeDbContextFactory.cs).
/// </summary>
public class AppointmentsControllerPostgresTests : IAsyncLifetime
{
    private string _connectionString = null!;
    private AppDbContext _context = null!;
    private Customer _customer = null!;
    private TreatmentType _treatmentType = null!;
    private User _author = null!;         // Therapist — the appointment's assigned therapist
    private User _otherTherapist = null!; // Therapist — used as the reschedule target / wrong-user 403 case
    private User _manager = null!;
    private DayOfWeek _weekday;
    private readonly List<Guid> _createdAppointmentIds = new();
    private readonly List<Guid> _createdUserIds = new();

    public async Task InitializeAsync()
    {
        _connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? throw new InvalidOperationException(
                "Set env var ConnectionStrings__DefaultConnection to a reachable Postgres instance " +
                "to run AppointmentsControllerPostgresTests (same variable used by the EF CLI " +
                "tooling — see DesignTimeDbContextFactory.cs).");

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(_connectionString)
            .Options;
        _context = new AppDbContext(options);

        await _context.Database.MigrateAsync();

        _customer = new Customer { Id = Guid.NewGuid(), FullName = "בדיקת תורים", Phone = "050-9990001" };
        _treatmentType = new TreatmentType { Id = Guid.NewGuid(), Name = "טיפול בדיקת תורים " + Guid.NewGuid() };
        _author = new User
        {
            Id = Guid.NewGuid(), FullName = "מטפלת קובעת התור", Email = $"appt-author-{Guid.NewGuid():N}@test.com",
            Role = UserRole.Therapist,
        };
        _otherTherapist = new User
        {
            Id = Guid.NewGuid(), FullName = "מטפלת אחרת לתור", Email = $"appt-other-{Guid.NewGuid():N}@test.com",
            Role = UserRole.Therapist,
        };
        _manager = new User
        {
            Id = Guid.NewGuid(), FullName = "מנהלת בדיקת תורים", Email = $"appt-manager-{Guid.NewGuid():N}@test.com",
            Role = UserRole.Manager,
        };

        _context.Customers.Add(_customer);
        _context.TreatmentTypes.Add(_treatmentType);
        _context.Users.AddRange(_author, _otherTherapist, _manager);
        await _context.SaveChangesAsync();

        _createdUserIds.AddRange(new[] { _author.Id, _otherTherapist.Id, _manager.Id });

        // A weekday comfortably a week+ in the future, so every slot built from it is never "in
        // the past" and always falls on the same working-hours weekday row seeded below.
        _weekday = NextSlot().DayOfWeek;

        // Both therapists work 09:00-20:00 on that weekday and are capable of the seeded
        // treatment type, unless a specific test overrides this (e.g. the capability-rejection
        // test removes/never adds the capability row for a fresh therapist).
        await SeedWorkingHours(_author.Id, _weekday, "09:00", "20:00");
        await SeedWorkingHours(_otherTherapist.Id, _weekday, "09:00", "20:00");
        await SeedCapability(_author.Id, _treatmentType.Id);
        await SeedCapability(_otherTherapist.Id, _treatmentType.Id);
    }

    public async Task DisposeAsync()
    {
        foreach (var id in _createdAppointmentIds)
        {
            var appt = await _context.Appointments.FindAsync(id);
            if (appt != null)
                _context.Appointments.Remove(appt);
        }
        await _context.SaveChangesAsync();

        _context.TherapistWorkingHours.RemoveRange(
            _context.TherapistWorkingHours.Where(w => _createdUserIds.Contains(w.UserId)));
        _context.TherapistCapabilities.RemoveRange(
            _context.TherapistCapabilities.Where(c => _createdUserIds.Contains(c.UserId)));
        _context.TherapistUnavailableDates.RemoveRange(
            _context.TherapistUnavailableDates.Where(d => _createdUserIds.Contains(d.UserId)));
        await _context.SaveChangesAsync();

        foreach (var userId in _createdUserIds)
        {
            var tracked = await _context.Users.FindAsync(userId);
            if (tracked != null)
                _context.Users.Remove(tracked);
        }

        _context.TreatmentTypes.Remove(_treatmentType);
        _context.Customers.Remove(_customer);
        await _context.SaveChangesAsync();
        await _context.DisposeAsync();
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    /// <summary>A DateTime 8 days from now at 10:00 — always safely in the future, and always the
    /// same weekday across a single test run.</summary>
    private static DateTime NextSlot(int hour = 10, int minute = 0)
        => DateTime.UtcNow.Date.AddDays(8).AddHours(hour).AddMinutes(minute);

    private async Task SeedWorkingHours(Guid userId, DayOfWeek weekday, string start, string end)
    {
        _context.TherapistWorkingHours.Add(new TherapistWorkingHours
        {
            Id = Guid.NewGuid(), UserId = userId, Weekday = (Weekday)(int)weekday, StartTime = start, EndTime = end,
        });
        await _context.SaveChangesAsync();
    }

    private async Task SeedCapability(Guid userId, Guid treatmentTypeId)
    {
        _context.TherapistCapabilities.Add(new TherapistCapability
        {
            Id = Guid.NewGuid(), UserId = userId, TreatmentTypeId = treatmentTypeId,
        });
        await _context.SaveChangesAsync();
    }

    private static AppointmentsController BuildController(AppDbContext context, Guid currentUserId, bool isManager)
    {
        var customerRepository = new CustomerRepository(context);
        var treatmentTypeRepository = new TreatmentTypeRepository(context);
        var userRepository = new UserRepository(context);
        var appointmentRepository = new AppointmentRepository(context);
        var availabilityService = new AvailabilityService(context);

        var currentUserMock = new Mock<ICurrentUserService>();
        currentUserMock.Setup(s => s.GetCurrentUserId()).Returns(currentUserId);
        currentUserMock.Setup(s => s.IsManager()).Returns(isManager);

        var controller = new AppointmentsController(
            customerRepository, treatmentTypeRepository, userRepository, appointmentRepository,
            availabilityService, currentUserMock.Object, context);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext(),
        };

        return controller;
    }

    private async Task<Appointment> CreateAppointmentAsAuthor(DateTime? start = null, DateTime? end = null, Guid? userId = null)
    {
        var controller = BuildController(_context, _author.Id, isManager: false);
        var slotStart = start ?? NextSlot();
        var slotEnd = end ?? slotStart.AddHours(1);

        var request = new CreateAppointmentRequest(_treatmentType.Id, userId ?? _author.Id, slotStart, slotEnd);
        var result = await controller.Create(_customer.Id, request);

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var dto = Assert.IsType<AppointmentDto>(created.Value);
        _createdAppointmentIds.Add(dto.Id);

        return await _context.Appointments.AsNoTracking().SingleAsync(a => a.Id == dto.Id);
    }

    // =========================================================================
    // CREATE
    // =========================================================================

    [Fact]
    public async Task Create_ValidRequest_Returns201_PersistsSnapshottedFullName()
    {
        var appointment = await CreateAppointmentAsAuthor();

        Assert.Equal(_customer.Id, appointment.CustomerId);
        Assert.Equal(_author.Id, appointment.UserId);
        Assert.Equal("מטפלת קובעת התור", appointment.UserFullName);
        Assert.Equal(AppointmentStatus.Scheduled, appointment.Status);
    }

    /// <summary>
    /// Regression test for the "12:00 booked, renders as 15:00" bug. StartTime/EndTime are
    /// documented as naive-local (no timezone) throughout this codebase, but the controller used
    /// to mislabel them Kind=Utc before persisting to what was then a "timestamp with time zone"
    /// column.
    ///
    /// Note on what actually reproduces the symptom: a plain DateTime.Hour check on the value
    /// round-tripped through Npgsql is NOT sufficient to catch this bug — verified empirically
    /// during implementation (temporarily reverting the controller Kind label + AppDbContext
    /// column-type override + a matching migration rollback and re-running this style of
    /// assertion still passed with Hour==12, because Npgsql round-trips a Kind=Utc timestamptz
    /// value with its digits unchanged; a plain DateTime has no serialized "Z"). The actual
    /// client-visible bug happens one layer up, at JSON serialization: System.Text.Json appends
    /// "Z" for Kind=Utc DateTimes (a true instant, e.g. "...T12:00:00Z") but no suffix for
    /// Kind=Unspecified (naive-local, "...T12:00:00") — confirmed empirically too. The frontend
    /// then parses the "Z" string as a real UTC instant and localizes it for display in the
    /// browser's Israel timezone (UTC+3), turning 12:00 into 15:00. So this test asserts both: (a)
    /// no digit-level shift through the DB round trip, and (b) the DTO's StartTime/EndTime carry
    /// Kind=Unspecified and serialize WITHOUT a "Z"/offset suffix — the actual observable contract
    /// the frontend depends on (src/types/Appointment.ts's documented naive-local ISO format).
    /// </summary>
    [Fact]
    public async Task Create_AtNoonLocalTime_RoundTripsWithNoTimezoneShift_AndSerializesAsNaiveLocal()
    {
        var controller = BuildController(_context, _author.Id, isManager: false);
        var slotStart = DateTime.SpecifyKind(NextSlot(hour: 12), DateTimeKind.Unspecified);
        var slotEnd = slotStart.AddHours(1);

        var request = new CreateAppointmentRequest(_treatmentType.Id, _author.Id, slotStart, slotEnd);
        var result = await controller.Create(_customer.Id, request);

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var dto = Assert.IsType<AppointmentDto>(created.Value);
        _createdAppointmentIds.Add(dto.Id);

        // (a) No digit-level shift on the value returned directly from Create.
        Assert.Equal(12, dto.StartTime.Hour);
        Assert.Equal(13, dto.EndTime.Hour);

        // (b) The actual client-visible contract: naive-local Kind, and JSON serialization with
        // no "Z"/offset suffix — this is what would have failed against the pre-fix code (which
        // produced Kind=Utc and thus a "...T12:00:00Z" JSON payload the frontend misinterprets).
        Assert.Equal(DateTimeKind.Unspecified, dto.StartTime.Kind);
        Assert.Equal(DateTimeKind.Unspecified, dto.EndTime.Kind);
        Assert.DoesNotContain("Z", JsonSerializer.Serialize(dto.StartTime));
        Assert.DoesNotContain("+", JsonSerializer.Serialize(dto.StartTime));

        // Re-fetch via a genuinely fresh, untracked query — a real round trip through Postgres —
        // and re-assert the same, proving the fix holds after persistence, not just in-memory.
        var persisted = await _context.Appointments.AsNoTracking().SingleAsync(a => a.Id == dto.Id);
        Assert.Equal(12, persisted.StartTime.Hour);
        Assert.Equal(13, persisted.EndTime.Hour);
        Assert.Equal(DateTimeKind.Unspecified, persisted.StartTime.Kind);
        Assert.DoesNotContain("Z", JsonSerializer.Serialize(persisted.StartTime));
    }

    [Fact]
    public async Task Create_EndTimeNotAfterStartTime_ThrowsDomainValidationException()
    {
        var controller = BuildController(_context, _author.Id, isManager: false);
        var start = NextSlot();
        var request = new CreateAppointmentRequest(_treatmentType.Id, _author.Id, start, start);

        await Assert.ThrowsAsync<DomainValidationException>(() => controller.Create(_customer.Id, request));
    }

    [Fact]
    public async Task Create_StartTimeInPast_ThrowsDomainValidationException()
    {
        var controller = BuildController(_context, _author.Id, isManager: false);
        var start = DateTime.UtcNow.AddDays(-1);
        var request = new CreateAppointmentRequest(_treatmentType.Id, _author.Id, start, start.AddHours(1));

        await Assert.ThrowsAsync<DomainValidationException>(() => controller.Create(_customer.Id, request));
    }

    [Fact]
    public async Task Create_NonExistentCustomer_Returns404()
    {
        var controller = BuildController(_context, _author.Id, isManager: false);
        var start = NextSlot();
        var request = new CreateAppointmentRequest(_treatmentType.Id, _author.Id, start, start.AddHours(1));

        var result = await controller.Create(Guid.NewGuid(), request);

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal(404, notFound.StatusCode);
    }

    [Fact]
    public async Task Create_NonExistentTreatmentType_Returns404()
    {
        var controller = BuildController(_context, _author.Id, isManager: false);
        var start = NextSlot();
        var request = new CreateAppointmentRequest(Guid.NewGuid(), _author.Id, start, start.AddHours(1));

        var result = await controller.Create(_customer.Id, request);

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal(404, notFound.StatusCode);
    }

    [Fact]
    public async Task Create_NonExistentTherapist_Returns404()
    {
        var controller = BuildController(_context, _author.Id, isManager: false);
        var start = NextSlot();
        var request = new CreateAppointmentRequest(_treatmentType.Id, Guid.NewGuid(), start, start.AddHours(1));

        var result = await controller.Create(_customer.Id, request);

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal(404, notFound.StatusCode);
    }

    [Fact]
    public async Task Create_UserIdIsNotATherapist_ThrowsDomainValidationException()
    {
        var controller = BuildController(_context, _author.Id, isManager: false);
        var start = NextSlot();
        // _manager exists but has Role=Manager, not Therapist.
        var request = new CreateAppointmentRequest(_treatmentType.Id, _manager.Id, start, start.AddHours(1));

        await Assert.ThrowsAsync<DomainValidationException>(() => controller.Create(_customer.Id, request));
    }

    [Fact]
    public async Task Create_NoWorkingHoursForWeekday_ThrowsDomainConflictException()
    {
        var freshTherapist = new User
        {
            Id = Guid.NewGuid(), FullName = "מטפלת ללא שעות עבודה", Email = $"appt-nowh-{Guid.NewGuid():N}@test.com",
            Role = UserRole.Therapist,
        };
        _context.Users.Add(freshTherapist);
        await _context.SaveChangesAsync();
        _createdUserIds.Add(freshTherapist.Id);
        await SeedCapability(freshTherapist.Id, _treatmentType.Id); // capable, but no working-hours row at all

        var controller = BuildController(_context, freshTherapist.Id, isManager: false);
        var start = NextSlot();
        var request = new CreateAppointmentRequest(_treatmentType.Id, freshTherapist.Id, start, start.AddHours(1));

        await Assert.ThrowsAsync<DomainConflictException>(() => controller.Create(_customer.Id, request));
    }

    [Fact]
    public async Task Create_UnavailableDate_ThrowsDomainConflictException()
    {
        var start = NextSlot();
        _context.TherapistUnavailableDates.Add(new TherapistUnavailableDate
        {
            Id = Guid.NewGuid(), UserId = _author.Id, UnavailableDate = start.Date,
        });
        await _context.SaveChangesAsync();

        try
        {
            var controller = BuildController(_context, _author.Id, isManager: false);
            var request = new CreateAppointmentRequest(_treatmentType.Id, _author.Id, start, start.AddHours(1));

            await Assert.ThrowsAsync<DomainConflictException>(() => controller.Create(_customer.Id, request));
        }
        finally
        {
            var row = await _context.TherapistUnavailableDates
                .FirstOrDefaultAsync(d => d.UserId == _author.Id && d.UnavailableDate == start.Date);
            if (row != null)
            {
                _context.TherapistUnavailableDates.Remove(row);
                await _context.SaveChangesAsync();
            }
        }
    }

    [Fact]
    public async Task Create_NoCapabilityForTreatmentType_ThrowsDomainConflictException()
    {
        var otherTreatmentType = new TreatmentType { Id = Guid.NewGuid(), Name = "טיפול ללא הסמכה " + Guid.NewGuid() };
        _context.TreatmentTypes.Add(otherTreatmentType);
        await _context.SaveChangesAsync();

        try
        {
            var controller = BuildController(_context, _author.Id, isManager: false);
            var start = NextSlot();
            // _author has no TherapistCapability row for otherTreatmentType.
            var request = new CreateAppointmentRequest(otherTreatmentType.Id, _author.Id, start, start.AddHours(1));

            await Assert.ThrowsAsync<DomainConflictException>(() => controller.Create(_customer.Id, request));
        }
        finally
        {
            _context.TreatmentTypes.Remove(otherTreatmentType);
            await _context.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task Create_OverlapsExistingScheduledAppointment_ThrowsDomainConflictException()
    {
        var existing = await CreateAppointmentAsAuthor();

        var controller = BuildController(_context, _author.Id, isManager: false);
        // Overlapping window: starts 30 min into the existing appointment.
        var overlappingStart = existing.StartTime.AddMinutes(30);
        var request = new CreateAppointmentRequest(_treatmentType.Id, _author.Id, overlappingStart, overlappingStart.AddHours(1));

        await Assert.ThrowsAsync<DomainConflictException>(() => controller.Create(_customer.Id, request));
    }

    [Fact]
    public async Task Create_ConcurrentOverlappingRequestsForSameSlot_OnlyOneSucceeds()
    {
        const int concurrency = 5;
        var slotStart = NextSlot(hour: 14);
        var slotEnd = slotStart.AddHours(1);

        var contexts = new AppDbContext[concurrency];
        var tasks = new Task<(bool Success, Guid? AppointmentId)>[concurrency];

        try
        {
            for (var i = 0; i < concurrency; i++)
            {
                var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(_connectionString).Options;
                var ctx = new AppDbContext(options);
                contexts[i] = ctx;

                tasks[i] = Task.Run(async () =>
                {
                    var controller = BuildController(ctx, _author.Id, isManager: false);
                    var request = new CreateAppointmentRequest(_treatmentType.Id, _author.Id, slotStart, slotEnd);
                    try
                    {
                        var result = await controller.Create(_customer.Id, request);
                        var created = Assert.IsType<CreatedAtActionResult>(result);
                        var dto = Assert.IsType<AppointmentDto>(created.Value);
                        return (true, (Guid?)dto.Id);
                    }
                    catch (DomainConflictException)
                    {
                        return (false, (Guid?)null);
                    }
                });
            }

            var results = await Task.WhenAll(tasks);

            foreach (var (_, appointmentId) in results)
                if (appointmentId.HasValue)
                    _createdAppointmentIds.Add(appointmentId.Value);

            // Exactly one of the N truly-concurrent requests for the identical therapist/slot must
            // win — the rest must be rejected as a double-booking conflict (409). Without the
            // ADR-011-A FOR UPDATE lock on the therapist's User row, this is expected to be
            // flaky/fail under real concurrent load (verified manually during implementation by
            // temporarily removing the lock line).
            Assert.Equal(1, results.Count(r => r.Success));
            Assert.Equal(concurrency - 1, results.Count(r => !r.Success));

            // StartTime/EndTime are "timestamp without time zone" columns (naive-local); slotStart
            // /slotEnd here are Kind=Utc (derived from NextSlot()'s DateTime.UtcNow.Date base), so
            // relabel to Unspecified for this LINQ predicate — Npgsql requires the Kind to match
            // the column type for parameter binding. This doesn't change the underlying clock
            // digits being compared, only the Kind tag.
            var slotStartUnspecified = DateTime.SpecifyKind(slotStart, DateTimeKind.Unspecified);
            var slotEndUnspecified = DateTime.SpecifyKind(slotEnd, DateTimeKind.Unspecified);

            var verifyOptions = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(_connectionString).Options;
            await using var verifyContext = new AppDbContext(verifyOptions);
            var persistedCount = await verifyContext.Appointments
                .AsNoTracking()
                .CountAsync(a => a.UserId == _author.Id && a.StartTime == slotStartUnspecified && a.EndTime == slotEndUnspecified);
            Assert.Equal(1, persistedCount);
        }
        finally
        {
            foreach (var ctx in contexts)
                if (ctx != null)
                    await ctx.DisposeAsync();
        }
    }

    // =========================================================================
    // READ
    // =========================================================================

    [Fact]
    public async Task GetById_ExistingAppointment_ReturnsDto()
    {
        var appointment = await CreateAppointmentAsAuthor();
        var controller = BuildController(_context, _author.Id, isManager: false);

        var result = await controller.GetById(appointment.Id);

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = Assert.IsType<AppointmentDto>(ok.Value);
        Assert.Equal(appointment.Id, dto.Id);
    }

    [Fact]
    public async Task GetById_NonExistentAppointment_Returns404()
    {
        var controller = BuildController(_context, _author.Id, isManager: false);

        var result = await controller.GetById(Guid.NewGuid());

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal(404, notFound.StatusCode);
    }

    [Fact]
    public async Task ListByCustomer_ReturnsOnlyThatCustomersAppointments()
    {
        await CreateAppointmentAsAuthor();
        var controller = BuildController(_context, _author.Id, isManager: false);

        var result = await controller.ListByCustomer(_customer.Id);

        var ok = Assert.IsType<OkObjectResult>(result);
        var dtos = Assert.IsAssignableFrom<IEnumerable<AppointmentDto>>(ok.Value);
        Assert.All(dtos, d => Assert.Equal(_customer.Id, d.CustomerId));
    }

    [Fact]
    public async Task ListByCustomer_NonExistentCustomer_Returns404()
    {
        var controller = BuildController(_context, _author.Id, isManager: false);

        var result = await controller.ListByCustomer(Guid.NewGuid());

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal(404, notFound.StatusCode);
    }

    [Fact]
    public async Task ListAll_IncludesCreatedAppointment()
    {
        var appointment = await CreateAppointmentAsAuthor();
        var controller = BuildController(_context, _author.Id, isManager: false);

        var result = await controller.ListAll();

        var ok = Assert.IsType<OkObjectResult>(result);
        var dtos = Assert.IsAssignableFrom<IEnumerable<AppointmentDto>>(ok.Value);
        Assert.Contains(dtos, d => d.Id == appointment.Id);
    }

    // =========================================================================
    // UPDATE (reschedule)
    // =========================================================================

    [Fact]
    public async Task Update_ByAuthor_ReschedulesTimeOnly_AndPersists()
    {
        var appointment = await CreateAppointmentAsAuthor();
        var controller = BuildController(_context, _author.Id, isManager: false);

        var newStart = appointment.StartTime.AddHours(2);
        var request = new UpdateAppointmentRequest(_author.Id, newStart, newStart.AddHours(1));

        var result = await controller.Update(appointment.Id, request);

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = Assert.IsType<AppointmentDto>(ok.Value);
        Assert.Equal(newStart, dto.StartTime);

        var persisted = await _context.Appointments.AsNoTracking().SingleAsync(a => a.Id == appointment.Id);
        Assert.Equal(newStart, persisted.StartTime);
    }

    /// <summary>
    /// Regression test for the reschedule (Update) path, mirroring
    /// <see cref="Create_AtNoonLocalTime_RoundTripsWithNoTimezoneShift_AndSerializesAsNaiveLocal"/>.
    /// <see cref="AppointmentsController.Update"/> had the identical Kind-mislabeling bug at its own
    /// StartTime/EndTime re-stamping site (now DateTimeKind.Unspecified) — this asserts the fix
    /// holds for the reschedule flow too, not just Create.
    /// </summary>
    [Fact]
    public async Task Update_RescheduleToNoonLocalTime_RoundTripsWithNoTimezoneShift_AndSerializesAsNaiveLocal()
    {
        var appointment = await CreateAppointmentAsAuthor();
        var controller = BuildController(_context, _author.Id, isManager: false);

        // Same seeded weekday as the original appointment (NextSlot()'s default day), just a
        // different, non-overlapping hour — noon, matching the Create-path regression test's slot.
        var newStart = DateTime.SpecifyKind(NextSlot(hour: 12, minute: 0), DateTimeKind.Unspecified);
        var newEnd = newStart.AddHours(1);
        var request = new UpdateAppointmentRequest(_author.Id, newStart, newEnd);

        var result = await controller.Update(appointment.Id, request);

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = Assert.IsType<AppointmentDto>(ok.Value);

        // (a) No digit-level shift on the value returned directly from Update.
        Assert.Equal(12, dto.StartTime.Hour);
        Assert.Equal(13, dto.EndTime.Hour);

        // (b) The actual client-visible contract: naive-local Kind, and JSON serialization with
        // no "Z"/offset suffix — this is what would have failed against the pre-fix code (which
        // produced Kind=Utc and thus a "...T12:00:00Z" JSON payload the frontend misinterprets).
        Assert.Equal(DateTimeKind.Unspecified, dto.StartTime.Kind);
        Assert.Equal(DateTimeKind.Unspecified, dto.EndTime.Kind);
        Assert.DoesNotContain("Z", JsonSerializer.Serialize(dto.StartTime));
        Assert.DoesNotContain("+", JsonSerializer.Serialize(dto.StartTime));

        // Re-fetch via a genuinely fresh, untracked query — a real round trip through Postgres —
        // and re-assert the same, proving the fix holds after persistence, not just in-memory.
        var persisted = await _context.Appointments.AsNoTracking().SingleAsync(a => a.Id == appointment.Id);
        Assert.Equal(12, persisted.StartTime.Hour);
        Assert.Equal(13, persisted.EndTime.Hour);
        Assert.Equal(DateTimeKind.Unspecified, persisted.StartTime.Kind);
        Assert.DoesNotContain("Z", JsonSerializer.Serialize(persisted.StartTime));
    }

    [Fact]
    public async Task Update_ByManager_ForAnotherTherapistsAppointment_Succeeds()
    {
        var appointment = await CreateAppointmentAsAuthor();
        var controller = BuildController(_context, _manager.Id, isManager: true);

        var newStart = appointment.StartTime.AddHours(3);
        var request = new UpdateAppointmentRequest(_author.Id, newStart, newStart.AddHours(1));

        var result = await controller.Update(appointment.Id, request);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(200, ok.StatusCode);
    }

    [Fact]
    public async Task Update_ChangesTherapist_LocksBothUserRows_AndPersistsNewTherapist()
    {
        var appointment = await CreateAppointmentAsAuthor();
        var controller = BuildController(_context, _author.Id, isManager: false);

        var newStart = appointment.StartTime.AddHours(4);
        var request = new UpdateAppointmentRequest(_otherTherapist.Id, newStart, newStart.AddHours(1));

        var result = await controller.Update(appointment.Id, request);

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = Assert.IsType<AppointmentDto>(ok.Value);
        Assert.Equal(_otherTherapist.Id, dto.UserId);
        Assert.Equal("מטפלת אחרת לתור", dto.UserFullName);

        var persisted = await _context.Appointments.AsNoTracking().SingleAsync(a => a.Id == appointment.Id);
        Assert.Equal(_otherTherapist.Id, persisted.UserId);
    }

    [Fact]
    public async Task Update_ByDifferentNonManagerTherapist_Returns403_AndDoesNotPersist()
    {
        var appointment = await CreateAppointmentAsAuthor();
        var controller = BuildController(_context, _otherTherapist.Id, isManager: false);

        var newStart = appointment.StartTime.AddHours(2);
        var request = new UpdateAppointmentRequest(_author.Id, newStart, newStart.AddHours(1));

        var result = await controller.Update(appointment.Id, request);

        var forbidden = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, forbidden.StatusCode);

        var persisted = await _context.Appointments.AsNoTracking().SingleAsync(a => a.Id == appointment.Id);
        Assert.Equal(appointment.StartTime, persisted.StartTime);
    }

    [Fact]
    public async Task Update_NonExistentAppointment_Returns404()
    {
        var controller = BuildController(_context, _author.Id, isManager: false);
        var start = NextSlot();
        var request = new UpdateAppointmentRequest(_author.Id, start, start.AddHours(1));

        var result = await controller.Update(Guid.NewGuid(), request);

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal(404, notFound.StatusCode);
    }

    [Fact]
    public async Task Update_AlreadyCancelledAppointment_ThrowsDomainConflictException_ForAnyRoleIncludingManager()
    {
        var appointment = await CreateAppointmentAsAuthor();
        var cancelController = BuildController(_context, _author.Id, isManager: false);
        await cancelController.Delete(appointment.Id);

        var managerController = BuildController(_context, _manager.Id, isManager: true);
        var newStart = appointment.StartTime.AddHours(2);
        var request = new UpdateAppointmentRequest(_author.Id, newStart, newStart.AddHours(1));

        // Q6: blocked for every role, including Manager — no exception.
        await Assert.ThrowsAsync<DomainConflictException>(() => managerController.Update(appointment.Id, request));
    }

    [Fact]
    public async Task Update_AppointmentAlreadyInThePast_ThrowsDomainConflictException_ForAnyRoleIncludingManager()
    {
        // Insert directly (bypassing Create, which itself blocks past start times) to simulate an
        // appointment that has since passed.
        var pastStart = DateTime.SpecifyKind(DateTime.UtcNow.AddDays(-1), DateTimeKind.Unspecified);
        var pastAppointment = new Appointment
        {
            Id = Guid.NewGuid(), CustomerId = _customer.Id, TreatmentTypeId = _treatmentType.Id, UserId = _author.Id,
            StartTime = pastStart, EndTime = pastStart.AddHours(1),
            Status = AppointmentStatus.Scheduled, CreatedAt = DateTime.UtcNow, UserFullName = _author.FullName,
        };
        _context.Appointments.Add(pastAppointment);
        await _context.SaveChangesAsync();
        _createdAppointmentIds.Add(pastAppointment.Id);

        var managerController = BuildController(_context, _manager.Id, isManager: true);
        var newStart = NextSlot();
        var request = new UpdateAppointmentRequest(_author.Id, newStart, newStart.AddHours(1));

        await Assert.ThrowsAsync<DomainConflictException>(() => managerController.Update(pastAppointment.Id, request));
    }

    [Fact]
    public async Task Update_NewStartTimeOverlapsAnotherAppointment_ThrowsDomainConflictException()
    {
        var blocking = await CreateAppointmentAsAuthor(start: NextSlot(hour: 12));
        var toReschedule = await CreateAppointmentAsAuthor(start: NextSlot(hour: 15));

        var controller = BuildController(_context, _author.Id, isManager: false);
        var overlappingStart = blocking.StartTime.AddMinutes(15);
        var request = new UpdateAppointmentRequest(_author.Id, overlappingStart, overlappingStart.AddHours(1));

        await Assert.ThrowsAsync<DomainConflictException>(() => controller.Update(toReschedule.Id, request));
    }

    // =========================================================================
    // DELETE (cancel)
    // =========================================================================

    [Fact]
    public async Task Delete_ByAuthor_CancelsAppointment_AndPersists()
    {
        var appointment = await CreateAppointmentAsAuthor();
        var controller = BuildController(_context, _author.Id, isManager: false);

        var result = await controller.Delete(appointment.Id);

        Assert.IsType<NoContentResult>(result);
        var persisted = await _context.Appointments.AsNoTracking().SingleAsync(a => a.Id == appointment.Id);
        Assert.Equal(AppointmentStatus.Cancelled, persisted.Status);
    }

    [Fact]
    public async Task Delete_ByManager_ForAnotherTherapistsAppointment_Succeeds()
    {
        var appointment = await CreateAppointmentAsAuthor();
        var controller = BuildController(_context, _manager.Id, isManager: true);

        var result = await controller.Delete(appointment.Id);

        Assert.IsType<NoContentResult>(result);
    }

    [Fact]
    public async Task Delete_ByDifferentNonManagerTherapist_Returns403_AndDoesNotPersist()
    {
        var appointment = await CreateAppointmentAsAuthor();
        var controller = BuildController(_context, _otherTherapist.Id, isManager: false);

        var result = await controller.Delete(appointment.Id);

        var forbidden = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, forbidden.StatusCode);

        var persisted = await _context.Appointments.AsNoTracking().SingleAsync(a => a.Id == appointment.Id);
        Assert.Equal(AppointmentStatus.Scheduled, persisted.Status);
    }

    [Fact]
    public async Task Delete_NonExistentAppointment_Returns404()
    {
        var controller = BuildController(_context, _author.Id, isManager: false);

        var result = await controller.Delete(Guid.NewGuid());

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal(404, notFound.StatusCode);
    }

    [Fact]
    public async Task Delete_AlreadyCancelledAppointment_ThrowsDomainConflictException()
    {
        var appointment = await CreateAppointmentAsAuthor();
        var controller = BuildController(_context, _author.Id, isManager: false);
        await controller.Delete(appointment.Id);

        await Assert.ThrowsAsync<DomainConflictException>(() => controller.Delete(appointment.Id));
    }
}
