using BeautyCareClinic.Application.DTOs;
using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Domain.Enums;
using BeautyCareClinic.Domain.Exceptions;
using BeautyCareClinic.Infrastructure.Data;
using BeautyCareClinic.Infrastructure.Repositories;
using BeautyCareClinic.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace BeautyCareClinic.Tests.Application;

/// <summary>
/// Phase 011 — Appointments Backend. Uses the EF InMemory provider.
/// Note: SELECT FOR UPDATE (ADR-011-A) is only supported by real Postgres — the row-locking /
/// concurrency guarantee is covered separately by AppointmentsControllerPostgresTests.cs. These
/// unit tests verify the AvailabilityService business logic in isolation (working hours,
/// unavailable dates, capability, overlap), plus permission/validation edge cases.
/// </summary>
public class Phase011Tests : IDisposable
{
    private readonly AppDbContext _context;
    private readonly AvailabilityService _availabilityService;

    private readonly Guid _managerId = Guid.NewGuid();
    private readonly Guid _therapistId = Guid.NewGuid();
    private readonly Guid _otherTherapistId = Guid.NewGuid();
    private readonly Guid _customerId = Guid.NewGuid();
    private readonly Guid _treatmentTypeId = Guid.NewGuid();
    private readonly Guid _otherTreatmentTypeId = Guid.NewGuid();

    public Phase011Tests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new AppDbContext(options);
        _availabilityService = new AvailabilityService(_context);

        SeedBaseData().GetAwaiter().GetResult();
    }

    public void Dispose() => _context.Dispose();

    private async Task SeedBaseData()
    {
        var customer = new Customer { Id = _customerId, FullName = "לקוחה לבדיקה", Phone = "050-0000009" };
        _context.Customers.Add(customer);

        var manager = new User { Id = _managerId, FullName = "מנהלת", Email = "mgr011@test.com", Role = UserRole.Manager };
        var therapist = new User { Id = _therapistId, FullName = "מטפלת ראשית", Email = "th011@test.com", Role = UserRole.Therapist };
        var otherTherapist = new User { Id = _otherTherapistId, FullName = "מטפלת שנייה", Email = "th011b@test.com", Role = UserRole.Therapist };
        _context.Users.AddRange(manager, therapist, otherTherapist);

        var treatmentType = new TreatmentType { Id = _treatmentTypeId, Name = "פנים 011" };
        var otherTreatmentType = new TreatmentType { Id = _otherTreatmentTypeId, Name = "לייזר 011" };
        _context.TreatmentTypes.AddRange(treatmentType, otherTreatmentType);

        await _context.SaveChangesAsync();
    }

    private DateTime NextWeekday(DayOfWeek dayOfWeek, int hour, int minute = 0)
    {
        var date = DateTime.UtcNow.Date;
        while (date.DayOfWeek != dayOfWeek)
            date = date.AddDays(1);
        // Push at least a week out so "not in the past" is never in question for these tests.
        date = date.AddDays(7);
        return date.AddHours(hour).AddMinutes(minute);
    }

    private async Task SeedWorkingHours(Guid userId, DayOfWeek dayOfWeek, string start, string end)
    {
        _context.TherapistWorkingHours.Add(new TherapistWorkingHours
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Weekday = (Weekday)(int)dayOfWeek,
            StartTime = start,
            EndTime = end,
        });
        await _context.SaveChangesAsync();
    }

    // =========================================================================
    // AVAILABILITY SERVICE — WORKING HOURS
    // =========================================================================

    [Fact]
    public async Task CheckAvailability_NoWorkingHoursRowForWeekday_IsUnavailable()
    {
        var slotStart = NextWeekday(DayOfWeek.Sunday, 10);
        var slotEnd = slotStart.AddHours(1);

        var result = await _availabilityService.CheckAvailabilityAsync(_therapistId, _treatmentTypeId, slotStart, slotEnd);

        Assert.False(result.IsAvailable);
        Assert.NotNull(result.Reason);
    }

    [Fact]
    public async Task CheckAvailability_WithinWorkingHours_PassesWorkingHoursCheck()
    {
        var slotStart = NextWeekday(DayOfWeek.Sunday, 10);
        await SeedWorkingHours(_therapistId, DayOfWeek.Sunday, "09:00", "17:00");
        // No capability seeded yet → still unavailable, but NOT for the working-hours reason.
        var result = await _availabilityService.CheckAvailabilityAsync(_therapistId, _treatmentTypeId, slotStart, slotStart.AddHours(1));

        Assert.False(result.IsAvailable);
        Assert.Contains("הסמכה", result.Reason);
    }

    [Fact]
    public async Task CheckAvailability_SlotStartsBeforeWorkingHours_IsUnavailable()
    {
        var slotStart = NextWeekday(DayOfWeek.Sunday, 8); // working hours start at 09:00
        await SeedWorkingHours(_therapistId, DayOfWeek.Sunday, "09:00", "17:00");

        var result = await _availabilityService.CheckAvailabilityAsync(_therapistId, _treatmentTypeId, slotStart, slotStart.AddHours(1));

        Assert.False(result.IsAvailable);
        Assert.Contains("שעות העבודה", result.Reason);
    }

    [Fact]
    public async Task CheckAvailability_SlotEndsAfterWorkingHours_IsUnavailable()
    {
        var slotStart = NextWeekday(DayOfWeek.Sunday, 16, 30);
        await SeedWorkingHours(_therapistId, DayOfWeek.Sunday, "09:00", "17:00");

        var result = await _availabilityService.CheckAvailabilityAsync(_therapistId, _treatmentTypeId, slotStart, slotStart.AddHours(1));

        Assert.False(result.IsAvailable);
        Assert.Contains("שעות העבודה", result.Reason);
    }

    // =========================================================================
    // AVAILABILITY SERVICE — UNAVAILABLE DATES
    // =========================================================================

    [Fact]
    public async Task CheckAvailability_UnavailableDateBlocksSlot_EvenWithinWorkingHours()
    {
        var slotStart = NextWeekday(DayOfWeek.Sunday, 10);
        await SeedWorkingHours(_therapistId, DayOfWeek.Sunday, "09:00", "17:00");

        _context.TherapistUnavailableDates.Add(new TherapistUnavailableDate
        {
            Id = Guid.NewGuid(), UserId = _therapistId, UnavailableDate = slotStart.Date,
        });
        await _context.SaveChangesAsync();

        var result = await _availabilityService.CheckAvailabilityAsync(_therapistId, _treatmentTypeId, slotStart, slotStart.AddHours(1));

        Assert.False(result.IsAvailable);
        Assert.Contains("זמינה", result.Reason);
    }

    // =========================================================================
    // AVAILABILITY SERVICE — CAPABILITY
    // =========================================================================

    [Fact]
    public async Task CheckAvailability_NoCapabilityForTreatmentType_IsUnavailable()
    {
        var slotStart = NextWeekday(DayOfWeek.Sunday, 10);
        await SeedWorkingHours(_therapistId, DayOfWeek.Sunday, "09:00", "17:00");
        // Capability only for the OTHER treatment type
        _context.TherapistCapabilities.Add(new TherapistCapability
        {
            Id = Guid.NewGuid(), UserId = _therapistId, TreatmentTypeId = _otherTreatmentTypeId,
        });
        await _context.SaveChangesAsync();

        var result = await _availabilityService.CheckAvailabilityAsync(_therapistId, _treatmentTypeId, slotStart, slotStart.AddHours(1));

        Assert.False(result.IsAvailable);
        Assert.Contains("הסמכה", result.Reason);
    }

    [Fact]
    public async Task CheckAvailability_AllConditionsMet_IsAvailable()
    {
        var slotStart = NextWeekday(DayOfWeek.Sunday, 10);
        await SeedWorkingHours(_therapistId, DayOfWeek.Sunday, "09:00", "17:00");
        _context.TherapistCapabilities.Add(new TherapistCapability
        {
            Id = Guid.NewGuid(), UserId = _therapistId, TreatmentTypeId = _treatmentTypeId,
        });
        await _context.SaveChangesAsync();

        var result = await _availabilityService.CheckAvailabilityAsync(_therapistId, _treatmentTypeId, slotStart, slotStart.AddHours(1));

        Assert.True(result.IsAvailable);
        Assert.Null(result.Reason);
    }

    // =========================================================================
    // AVAILABILITY SERVICE — OVERLAP
    // =========================================================================

    [Fact]
    public async Task CheckAvailability_OverlappingScheduledAppointment_IsUnavailable()
    {
        var slotStart = NextWeekday(DayOfWeek.Sunday, 10);
        await SeedWorkingHours(_therapistId, DayOfWeek.Sunday, "09:00", "17:00");
        _context.TherapistCapabilities.Add(new TherapistCapability
        {
            Id = Guid.NewGuid(), UserId = _therapistId, TreatmentTypeId = _treatmentTypeId,
        });
        _context.Appointments.Add(new Appointment
        {
            Id = Guid.NewGuid(), CustomerId = _customerId, TreatmentTypeId = _treatmentTypeId, UserId = _therapistId,
            StartTime = slotStart.AddMinutes(-30), EndTime = slotStart.AddMinutes(30),
            Status = AppointmentStatus.Scheduled, CreatedAt = DateTime.UtcNow, UserFullName = "מטפלת ראשית",
        });
        await _context.SaveChangesAsync();

        var result = await _availabilityService.CheckAvailabilityAsync(_therapistId, _treatmentTypeId, slotStart, slotStart.AddHours(1));

        Assert.False(result.IsAvailable);
        Assert.Contains("תפוסה", result.Reason);
    }

    [Fact]
    public async Task CheckAvailability_OverlapWithCancelledAppointment_IsIgnored()
    {
        var slotStart = NextWeekday(DayOfWeek.Sunday, 10);
        await SeedWorkingHours(_therapistId, DayOfWeek.Sunday, "09:00", "17:00");
        _context.TherapistCapabilities.Add(new TherapistCapability
        {
            Id = Guid.NewGuid(), UserId = _therapistId, TreatmentTypeId = _treatmentTypeId,
        });
        _context.Appointments.Add(new Appointment
        {
            Id = Guid.NewGuid(), CustomerId = _customerId, TreatmentTypeId = _treatmentTypeId, UserId = _therapistId,
            StartTime = slotStart, EndTime = slotStart.AddHours(1),
            Status = AppointmentStatus.Cancelled, CreatedAt = DateTime.UtcNow, UserFullName = "מטפלת ראשית",
        });
        await _context.SaveChangesAsync();

        var result = await _availabilityService.CheckAvailabilityAsync(_therapistId, _treatmentTypeId, slotStart, slotStart.AddHours(1));

        Assert.True(result.IsAvailable);
    }

    [Fact]
    public async Task CheckAvailability_ExcludeAppointmentId_SkipsItsOwnSlotInOverlapCheck()
    {
        var slotStart = NextWeekday(DayOfWeek.Sunday, 10);
        await SeedWorkingHours(_therapistId, DayOfWeek.Sunday, "09:00", "17:00");
        _context.TherapistCapabilities.Add(new TherapistCapability
        {
            Id = Guid.NewGuid(), UserId = _therapistId, TreatmentTypeId = _treatmentTypeId,
        });
        var existingId = Guid.NewGuid();
        _context.Appointments.Add(new Appointment
        {
            Id = existingId, CustomerId = _customerId, TreatmentTypeId = _treatmentTypeId, UserId = _therapistId,
            StartTime = slotStart, EndTime = slotStart.AddHours(1),
            Status = AppointmentStatus.Scheduled, CreatedAt = DateTime.UtcNow, UserFullName = "מטפלת ראשית",
        });
        await _context.SaveChangesAsync();

        // Rescheduling the SAME appointment to the exact same slot must not conflict with itself.
        var result = await _availabilityService.CheckAvailabilityAsync(
            _therapistId, _treatmentTypeId, slotStart, slotStart.AddHours(1), excludeAppointmentId: existingId);

        Assert.True(result.IsAvailable);
    }

    [Fact]
    public async Task CheckAvailability_DifferentTherapistSameSlot_DoesNotConflict()
    {
        var slotStart = NextWeekday(DayOfWeek.Sunday, 10);
        await SeedWorkingHours(_therapistId, DayOfWeek.Sunday, "09:00", "17:00");
        await SeedWorkingHours(_otherTherapistId, DayOfWeek.Sunday, "09:00", "17:00");
        _context.TherapistCapabilities.AddRange(
            new TherapistCapability { Id = Guid.NewGuid(), UserId = _therapistId, TreatmentTypeId = _treatmentTypeId },
            new TherapistCapability { Id = Guid.NewGuid(), UserId = _otherTherapistId, TreatmentTypeId = _treatmentTypeId });
        _context.Appointments.Add(new Appointment
        {
            Id = Guid.NewGuid(), CustomerId = _customerId, TreatmentTypeId = _treatmentTypeId, UserId = _therapistId,
            StartTime = slotStart, EndTime = slotStart.AddHours(1),
            Status = AppointmentStatus.Scheduled, CreatedAt = DateTime.UtcNow, UserFullName = "מטפלת ראשית",
        });
        await _context.SaveChangesAsync();

        var result = await _availabilityService.CheckAvailabilityAsync(_otherTherapistId, _treatmentTypeId, slotStart, slotStart.AddHours(1));

        Assert.True(result.IsAvailable);
    }

    // Note: validation-edge-case tests (end-time-not-after-start-time, start-time-in-past) and
    // Update-permission tests (author-matches-current-user / manager-override / wrong-author-403)
    // were removed from this file (code-review Fix 5, 2026-07-20). They re-implemented the
    // controller's validation/permission logic inline instead of invoking AppointmentsController,
    // so they'd pass regardless of what the real controller does. Real coverage for the same
    // scenarios exists in AppointmentsControllerPostgresTests.cs, which drives the actual
    // controller.

    // =========================================================================
    // APPOINTMENT REPOSITORY
    // =========================================================================

    [Fact]
    public async Task AppointmentRepository_AddAsync_PersistsAppointment()
    {
        var repo = new AppointmentRepository(_context);
        var appointment = new Appointment
        {
            Id = Guid.NewGuid(), CustomerId = _customerId, TreatmentTypeId = _treatmentTypeId, UserId = _therapistId,
            StartTime = DateTime.UtcNow.AddDays(1), EndTime = DateTime.UtcNow.AddDays(1).AddHours(1),
            Status = AppointmentStatus.Scheduled, CreatedAt = DateTime.UtcNow, UserFullName = "מטפלת ראשית",
        };

        await repo.AddAsync(appointment);

        var fromDb = await _context.Appointments.FindAsync(appointment.Id);
        Assert.NotNull(fromDb);
        Assert.Equal("מטפלת ראשית", fromDb!.UserFullName);
    }

    [Fact]
    public async Task AppointmentRepository_ListByCustomer_ReturnsOnlyThatCustomersAppointments_OrderedByStartTime()
    {
        var otherCustomerId = Guid.NewGuid();
        _context.Customers.Add(new Customer { Id = otherCustomerId, FullName = "לקוחה אחרת", Phone = "050-1112223" });

        var repo = new AppointmentRepository(_context);
        var later = new Appointment
        {
            Id = Guid.NewGuid(), CustomerId = _customerId, TreatmentTypeId = _treatmentTypeId, UserId = _therapistId,
            StartTime = DateTime.UtcNow.AddDays(2), EndTime = DateTime.UtcNow.AddDays(2).AddHours(1),
            Status = AppointmentStatus.Scheduled, CreatedAt = DateTime.UtcNow, UserFullName = "מטפלת ראשית",
        };
        var sooner = new Appointment
        {
            Id = Guid.NewGuid(), CustomerId = _customerId, TreatmentTypeId = _treatmentTypeId, UserId = _therapistId,
            StartTime = DateTime.UtcNow.AddDays(1), EndTime = DateTime.UtcNow.AddDays(1).AddHours(1),
            Status = AppointmentStatus.Scheduled, CreatedAt = DateTime.UtcNow, UserFullName = "מטפלת ראשית",
        };
        var otherCustomerAppt = new Appointment
        {
            Id = Guid.NewGuid(), CustomerId = otherCustomerId, TreatmentTypeId = _treatmentTypeId, UserId = _therapistId,
            StartTime = DateTime.UtcNow.AddDays(1), EndTime = DateTime.UtcNow.AddDays(1).AddHours(1),
            Status = AppointmentStatus.Scheduled, CreatedAt = DateTime.UtcNow, UserFullName = "מטפלת ראשית",
        };
        _context.Appointments.AddRange(later, sooner, otherCustomerAppt);
        await _context.SaveChangesAsync();

        var list = await repo.ListByCustomerAsync(_customerId);

        Assert.Equal(2, list.Count);
        Assert.Equal(sooner.Id, list[0].Id);
        Assert.Equal(later.Id, list[1].Id);
    }

    [Fact]
    public async Task AppointmentRepository_UpdateAsync_PersistsStatusChange()
    {
        var repo = new AppointmentRepository(_context);
        var appointment = new Appointment
        {
            Id = Guid.NewGuid(), CustomerId = _customerId, TreatmentTypeId = _treatmentTypeId, UserId = _therapistId,
            StartTime = DateTime.UtcNow.AddDays(1), EndTime = DateTime.UtcNow.AddDays(1).AddHours(1),
            Status = AppointmentStatus.Scheduled, CreatedAt = DateTime.UtcNow, UserFullName = "מטפלת ראשית",
        };
        _context.Appointments.Add(appointment);
        await _context.SaveChangesAsync();

        appointment.Status = AppointmentStatus.Cancelled;
        await repo.UpdateAsync(appointment);

        var fromDb = await _context.Appointments.FindAsync(appointment.Id);
        Assert.Equal(AppointmentStatus.Cancelled, fromDb!.Status);
    }

    // =========================================================================
    // DTO
    // =========================================================================

    [Fact]
    public void AppointmentDto_HasExpectedFields()
    {
        var dto = new AppointmentDto(
            Id: Guid.NewGuid(),
            CustomerId: Guid.NewGuid(),
            TreatmentTypeId: Guid.NewGuid(),
            TreatmentTypeName: "פנים",
            UserId: Guid.NewGuid(),
            UserFullName: "מטפלת ראשית",
            StartTime: DateTime.UtcNow,
            EndTime: DateTime.UtcNow.AddHours(1),
            Status: "Scheduled",
            CreatedAt: DateTime.UtcNow);

        Assert.Equal("פנים", dto.TreatmentTypeName);
        Assert.Equal("מטפלת ראשית", dto.UserFullName);
        Assert.Equal("Scheduled", dto.Status);
    }
}
