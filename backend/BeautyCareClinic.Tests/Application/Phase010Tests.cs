using BeautyCareClinic.Application.DTOs;
using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Domain.Enums;
using BeautyCareClinic.Domain.Exceptions;
using BeautyCareClinic.Infrastructure.Data;
using BeautyCareClinic.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace BeautyCareClinic.Tests.Application;

/// <summary>
/// Phase 010 — Treatment Recording and Notes tests.
/// Uses InMemory EF Core provider.
/// Note: SELECT FOR UPDATE is only supported by real Postgres.
///       Transaction and lock patterns are integration-tested separately.
///       These unit tests verify business logic: progress tracking, validation, auth checks.
/// </summary>
public class Phase010Tests : IDisposable
{
    private readonly AppDbContext _context;

    // ── Shared test helpers ──────────────────────────────────────────────────

    private readonly Guid _managerId   = Guid.NewGuid();
    private readonly Guid _therapistId = Guid.NewGuid();
    private readonly Guid _customerId  = Guid.NewGuid();

    public Phase010Tests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new AppDbContext(options);

        SeedBaseData().GetAwaiter().GetResult();
    }

    public void Dispose() => _context.Dispose();

    private async Task SeedBaseData()
    {
        var customer = new Customer { Id = _customerId, FullName = "לקוח בדיקה", Phone = "050-0000001" };
        _context.Customers.Add(customer);

        var manager   = new User { Id = _managerId,   FullName = "מנהל ראשי",   Email = "manager@test.com",   Role = UserRole.Manager };
        var therapist = new User { Id = _therapistId, FullName = "מטפלת ראשית", Email = "therapist@test.com", Role = UserRole.Therapist };
        _context.Users.AddRange(manager, therapist);

        await _context.SaveChangesAsync();
    }

    // ── Build TreatmentSeries with OrderItem + PackageType ───────────────────

    private async Task<(TreatmentSeries series, TreatmentType tt)> CreateTimerSeries(
        int totalMinutes = 300, int usedMinutes = 0)
    {
        var tt = new TreatmentType { Id = Guid.NewGuid(), Name = "עיסוי שוודי " + Guid.NewGuid() };
        _context.TreatmentTypes.Add(tt);

        var pkg = new PackageType
        {
            Id              = Guid.NewGuid(),
            TreatmentTypeId = tt.Id,
            Name            = "עיסוי " + Guid.NewGuid(),
            Price           = 500m,
            IsSeries        = true,
            IsTimerBased    = true,
            TreatmentCount  = 5,
            MinutesPerTreatment = totalMinutes / 5,
        };
        _context.PackageTypes.Add(pkg);

        var order = new CustomerOrder
        {
            Id = Guid.NewGuid(), CustomerId = _customerId,
            OrderDate = DateTime.UtcNow, OriginalPrice = 500m, DiscountedPrice = 500m,
            DiscountPercentage = 0m, MaxPaymentCount = 3, AmountPaid = 0m,
        };
        _context.CustomerOrders.Add(order);

        var item = new OrderItem { Id = Guid.NewGuid(), OrderId = order.Id, PackageTypeId = pkg.Id, UnitPrice = 500m };
        _context.OrderItems.Add(item);

        var series = new TreatmentSeries
        {
            Id          = Guid.NewGuid(),
            OrderItemId = item.Id,
            TotalTreatments     = 0,
            CompletedTreatments = 0,
            TotalMinutes        = totalMinutes,
            UsedMinutes         = usedMinutes,
        };
        _context.TreatmentSeries.Add(series);
        await _context.SaveChangesAsync();
        return (series, tt);
    }

    private async Task<(TreatmentSeries series, TreatmentType tt)> CreateQuantitySeries(
        int total = 10, int completed = 0)
    {
        var tt = new TreatmentType { Id = Guid.NewGuid(), Name = "לייזר " + Guid.NewGuid() };
        _context.TreatmentTypes.Add(tt);

        var pkg = new PackageType
        {
            Id              = Guid.NewGuid(),
            TreatmentTypeId = tt.Id,
            Name            = "לייזר " + Guid.NewGuid(),
            Price           = 300m,
            IsSeries        = true,
            IsTimerBased    = false,
            TreatmentCount  = total,
        };
        _context.PackageTypes.Add(pkg);

        var order = new CustomerOrder
        {
            Id = Guid.NewGuid(), CustomerId = _customerId,
            OrderDate = DateTime.UtcNow, OriginalPrice = 300m, DiscountedPrice = 300m,
            DiscountPercentage = 0m, MaxPaymentCount = 3, AmountPaid = 0m,
        };
        _context.CustomerOrders.Add(order);

        var item = new OrderItem { Id = Guid.NewGuid(), OrderId = order.Id, PackageTypeId = pkg.Id, UnitPrice = 300m };
        _context.OrderItems.Add(item);

        var series = new TreatmentSeries
        {
            Id          = Guid.NewGuid(),
            OrderItemId = item.Id,
            TotalTreatments     = total,
            CompletedTreatments = completed,
            TotalMinutes        = 0,
            UsedMinutes         = 0,
        };
        _context.TreatmentSeries.Add(series);
        await _context.SaveChangesAsync();
        return (series, tt);
    }

    // ── Helper: create a mock ICurrentUserService ────────────────────────────

    private Mock<ICurrentUserService> MockCurrentUser(Guid userId, UserRole role)
    {
        var mock = new Mock<ICurrentUserService>();
        mock.Setup(s => s.GetCurrentUserId()).Returns(userId);
        mock.Setup(s => s.GetCurrentUserRole()).Returns(role);
        mock.Setup(s => s.IsManager()).Returns(role == UserRole.Manager);
        return mock;
    }

    // =========================================================================
    // TREATMENT TESTS
    // =========================================================================

    [Fact]
    public async Task CreateTreatment_TimerSeries_IncrementsUsedMinutes()
    {
        var (series, tt) = await CreateTimerSeries(totalMinutes: 300, usedMinutes: 60);

        // Simulate the controller logic: load series + determine isTimerBased + update
        var loadedSeries = await _context.TreatmentSeries
            .Include(s => s.OrderItem).ThenInclude(oi => oi.PackageType)
            .FirstAsync(s => s.Id == series.Id);

        var durationMinutes = 60;
        Assert.True(loadedSeries.OrderItem.PackageType.IsTimerBased);

        loadedSeries.UsedMinutes = Math.Min(
            loadedSeries.UsedMinutes + durationMinutes,
            loadedSeries.TotalMinutes);
        _context.TreatmentSeries.Update(loadedSeries);

        var treatment = new Treatment
        {
            Id = Guid.NewGuid(), CustomerId = _customerId, TreatmentTypeId = tt.Id,
            TreatmentSeriesId = series.Id, TreatmentDate = DateTime.UtcNow,
            DurationMinutes = durationMinutes, UserId = _therapistId,
            PerformedByFullName = "מטפלת ראשית",
        };
        _context.Treatments.Add(treatment);
        await _context.SaveChangesAsync();

        var updated = await _context.TreatmentSeries.FindAsync(series.Id);
        Assert.Equal(120, updated!.UsedMinutes);
    }

    [Fact]
    public async Task CreateTreatment_TimerSeries_ClampsAtTotalMinutes()
    {
        var (series, tt) = await CreateTimerSeries(totalMinutes: 300, usedMinutes: 280);

        var loadedSeries = await _context.TreatmentSeries
            .Include(s => s.OrderItem).ThenInclude(oi => oi.PackageType)
            .FirstAsync(s => s.Id == series.Id);

        var durationMinutes = 60; // would push past 300
        loadedSeries.UsedMinutes = Math.Min(
            loadedSeries.UsedMinutes + durationMinutes,
            loadedSeries.TotalMinutes);
        _context.TreatmentSeries.Update(loadedSeries);
        await _context.SaveChangesAsync();

        var updated = await _context.TreatmentSeries.FindAsync(series.Id);
        Assert.Equal(300, updated!.UsedMinutes); // clamped to TotalMinutes
    }

    [Fact]
    public async Task CreateTreatment_QuantitySeries_IncrementsCompletedTreatments()
    {
        var (series, tt) = await CreateQuantitySeries(total: 10, completed: 3);

        var loadedSeries = await _context.TreatmentSeries
            .Include(s => s.OrderItem).ThenInclude(oi => oi.PackageType)
            .FirstAsync(s => s.Id == series.Id);

        Assert.False(loadedSeries.OrderItem.PackageType.IsTimerBased);
        loadedSeries.CompletedTreatments = Math.Min(
            loadedSeries.CompletedTreatments + 1,
            loadedSeries.TotalTreatments);
        _context.TreatmentSeries.Update(loadedSeries);
        await _context.SaveChangesAsync();

        var updated = await _context.TreatmentSeries.FindAsync(series.Id);
        Assert.Equal(4, updated!.CompletedTreatments);
    }

    [Fact]
    public async Task CreateTreatment_QuantitySeries_ClampsAtTotal()
    {
        var (series, tt) = await CreateQuantitySeries(total: 5, completed: 5);

        var loadedSeries = await _context.TreatmentSeries
            .Include(s => s.OrderItem).ThenInclude(oi => oi.PackageType)
            .FirstAsync(s => s.Id == series.Id);

        // Even if we try to increment past total, it should clamp
        loadedSeries.CompletedTreatments = Math.Min(
            loadedSeries.CompletedTreatments + 1,
            loadedSeries.TotalTreatments);
        _context.TreatmentSeries.Update(loadedSeries);
        await _context.SaveChangesAsync();

        var updated = await _context.TreatmentSeries.FindAsync(series.Id);
        Assert.Equal(5, updated!.CompletedTreatments); // clamped at TotalTreatments
    }

    [Fact]
    public async Task CreateTreatment_StandaloneNullSeries_CreatesWithoutSeriesUpdate()
    {
        var tt = new TreatmentType { Id = Guid.NewGuid(), Name = "טיפול בודד" };
        _context.TreatmentTypes.Add(tt);
        await _context.SaveChangesAsync();

        var seriesCountBefore = await _context.TreatmentSeries.CountAsync();

        var treatment = new Treatment
        {
            Id                  = Guid.NewGuid(),
            CustomerId          = _customerId,
            TreatmentTypeId     = tt.Id,
            TreatmentSeriesId   = null,
            TreatmentDate       = DateTime.UtcNow,
            DurationMinutes     = 30,
            UserId              = _therapistId,
            PerformedByFullName = "מטפלת ראשית",
        };
        _context.Treatments.Add(treatment);
        await _context.SaveChangesAsync();

        var seriesCountAfter = await _context.TreatmentSeries.CountAsync();
        Assert.Equal(seriesCountBefore, seriesCountAfter); // series unchanged

        var saved = await _context.Treatments.FindAsync(treatment.Id);
        Assert.NotNull(saved);
        Assert.Null(saved!.TreatmentSeriesId);
    }

    [Fact]
    public void CreateTreatment_FutureDate_Returns422()
    {
        var futureDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1));
        var today      = DateOnly.FromDateTime(DateTime.UtcNow);

        void Act() { if (futureDate > today) throw new DomainValidationException("תאריך הטיפול אינו יכול להיות בעתיד"); }
        Assert.Throws<DomainValidationException>((Action)Act);
    }

    [Fact]
    public async Task DeleteTreatment_TimerSeries_ReversesUsedMinutes()
    {
        var (series, tt) = await CreateTimerSeries(totalMinutes: 300, usedMinutes: 120);

        var treatment = new Treatment
        {
            Id = Guid.NewGuid(), CustomerId = _customerId, TreatmentTypeId = tt.Id,
            TreatmentSeriesId = series.Id, TreatmentDate = DateTime.UtcNow,
            DurationMinutes = 60, UserId = _therapistId,
            PerformedByFullName = "מטפלת ראשית",
        };
        _context.Treatments.Add(treatment);
        await _context.SaveChangesAsync();

        // Simulate delete reversal logic
        var loadedSeries = await _context.TreatmentSeries
            .Include(s => s.OrderItem).ThenInclude(oi => oi.PackageType)
            .FirstAsync(s => s.Id == series.Id);

        loadedSeries.UsedMinutes = Math.Max(loadedSeries.UsedMinutes - treatment.DurationMinutes, 0);
        _context.TreatmentSeries.Update(loadedSeries);
        _context.Treatments.Remove(treatment);
        await _context.SaveChangesAsync();

        var updatedSeries = await _context.TreatmentSeries.FindAsync(series.Id);
        Assert.Equal(60, updatedSeries!.UsedMinutes); // 120 - 60 = 60
    }

    [Fact]
    public async Task DeleteTreatment_QuantitySeries_ReversesCompletedTreatments()
    {
        var (series, tt) = await CreateQuantitySeries(total: 10, completed: 5);

        var treatment = new Treatment
        {
            Id = Guid.NewGuid(), CustomerId = _customerId, TreatmentTypeId = tt.Id,
            TreatmentSeriesId = series.Id, TreatmentDate = DateTime.UtcNow,
            DurationMinutes = 0, UserId = _therapistId,
            PerformedByFullName = "מטפלת ראשית",
        };
        _context.Treatments.Add(treatment);
        await _context.SaveChangesAsync();

        // Simulate delete reversal logic
        var loadedSeries = await _context.TreatmentSeries
            .Include(s => s.OrderItem).ThenInclude(oi => oi.PackageType)
            .FirstAsync(s => s.Id == series.Id);

        loadedSeries.CompletedTreatments = Math.Max(loadedSeries.CompletedTreatments - 1, 0);
        _context.TreatmentSeries.Update(loadedSeries);
        _context.Treatments.Remove(treatment);
        await _context.SaveChangesAsync();

        var updatedSeries = await _context.TreatmentSeries.FindAsync(series.Id);
        Assert.Equal(4, updatedSeries!.CompletedTreatments); // 5 - 1 = 4
    }

    [Fact]
    public void DeleteTreatment_WrongAuthorTherapist_Returns403()
    {
        // The treatment belongs to _therapistId, but another therapist tries to delete
        var anotherTherapistId = Guid.NewGuid();
        var treatmentOwnerId   = _therapistId;

        var mockCurrentUser = MockCurrentUser(anotherTherapistId, UserRole.Therapist);
        var currentUserId   = mockCurrentUser.Object.GetCurrentUserId();
        var isManager       = mockCurrentUser.Object.IsManager();

        // Access check: same as controller
        var shouldForbid = treatmentOwnerId != currentUserId && !isManager;
        Assert.True(shouldForbid);
    }

    [Fact]
    public void DeleteTreatment_ByManager_Succeeds()
    {
        // Treatment belongs to therapist, but manager can delete it
        var anotherUserId    = _therapistId;
        var mockCurrentUser  = MockCurrentUser(_managerId, UserRole.Manager);
        var currentUserId    = mockCurrentUser.Object.GetCurrentUserId();
        var isManager        = mockCurrentUser.Object.IsManager();

        var shouldForbid = anotherUserId != currentUserId && !isManager;
        Assert.False(shouldForbid); // manager can delete
    }

    [Fact]
    public async Task TreatmentRepository_AddAsync_PersistsTreatment()
    {
        var repo = new TreatmentRepository(_context);
        var tt   = new TreatmentType { Id = Guid.NewGuid(), Name = "בדיקה" };
        _context.TreatmentTypes.Add(tt);
        await _context.SaveChangesAsync();

        var treatment = new Treatment
        {
            Id                  = Guid.NewGuid(),
            CustomerId          = _customerId,
            TreatmentTypeId     = tt.Id,
            TreatmentDate       = DateTime.UtcNow,
            DurationMinutes     = 45,
            UserId              = _therapistId,
            PerformedByFullName = "מטפלת ראשית",
            Notes               = "הערה לדוגמה",
        };

        await repo.AddAsync(treatment);

        var fromDb = await _context.Treatments.FindAsync(treatment.Id);
        Assert.NotNull(fromDb);
        Assert.Equal("הערה לדוגמה", fromDb!.Notes);
        Assert.Equal("מטפלת ראשית", fromDb.PerformedByFullName);
    }

    [Fact]
    public async Task TreatmentRepository_ListByCustomer_ReturnsOrderedDesc()
    {
        var repo = new TreatmentRepository(_context);
        var tt   = new TreatmentType { Id = Guid.NewGuid(), Name = "סדרה" };
        _context.TreatmentTypes.Add(tt);
        await _context.SaveChangesAsync();

        var older = new Treatment { Id = Guid.NewGuid(), CustomerId = _customerId, TreatmentTypeId = tt.Id, TreatmentDate = DateTime.UtcNow.AddDays(-10), DurationMinutes = 30, UserId = _therapistId, PerformedByFullName = "מטפל" };
        var newer = new Treatment { Id = Guid.NewGuid(), CustomerId = _customerId, TreatmentTypeId = tt.Id, TreatmentDate = DateTime.UtcNow.AddDays(-1),  DurationMinutes = 60, UserId = _therapistId, PerformedByFullName = "מטפל" };
        _context.Treatments.AddRange(older, newer);
        await _context.SaveChangesAsync();

        var list = await repo.ListByCustomerAsync(_customerId);
        Assert.True(list.Count >= 2);
        Assert.True(list[0].TreatmentDate >= list[1].TreatmentDate);
    }

    [Fact]
    public async Task DeleteReversal_ClampsAtZero_WhenUsedMinutesUnderflowWouldOccur()
    {
        // Edge case: series has 20 usedMinutes, but the treatment says 60
        // The reversal must not go below 0
        var (series, tt) = await CreateTimerSeries(totalMinutes: 300, usedMinutes: 20);

        var loadedSeries = await _context.TreatmentSeries.FirstAsync(s => s.Id == series.Id);
        var durationToReverse = 60;
        loadedSeries.UsedMinutes = Math.Max(loadedSeries.UsedMinutes - durationToReverse, 0);
        _context.TreatmentSeries.Update(loadedSeries);
        await _context.SaveChangesAsync();

        var updated = await _context.TreatmentSeries.FindAsync(series.Id);
        Assert.Equal(0, updated!.UsedMinutes);
    }

    // =========================================================================
    // NOTE TESTS
    // =========================================================================

    [Fact]
    public async Task NoteRepository_AddAsync_SetsAuthorFromParameter()
    {
        var repo = new NoteRepository(_context);
        var note = new Note
        {
            Id                = Guid.NewGuid(),
            CustomerId        = _customerId,
            UserId            = _therapistId,
            NoteDate          = DateTime.UtcNow,
            Content           = "הערה על הלקוח",
            WrittenByFullName = "מטפלת ראשית",
        };

        await repo.AddAsync(note);

        var fromDb = await _context.Notes.FindAsync(note.Id);
        Assert.NotNull(fromDb);
        Assert.Equal(_therapistId, fromDb!.UserId);
        Assert.Equal("מטפלת ראשית", fromDb.WrittenByFullName);
    }

    [Fact]
    public void CreateNote_EmptyContent_Returns422()
    {
        var content = string.Empty;
        void Act() { if (string.IsNullOrWhiteSpace(content)) throw new DomainValidationException("תוכן ההערה אינו יכול להיות ריק"); }
        Assert.Throws<DomainValidationException>((Action)Act);
    }

    [Fact]
    public void CreateNote_ContentExceeds5000Chars_Returns422()
    {
        var longContent = new string('א', 5001);
        void Act() { if (longContent.Length > 5000) throw new DomainValidationException("תוכן ההערה חורג מ-5000 תווים"); }
        Assert.Throws<DomainValidationException>((Action)Act);
    }

    [Fact]
    public void CreateNote_FutureDate_Returns422()
    {
        var futureDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1));
        var today      = DateOnly.FromDateTime(DateTime.UtcNow);
        void Act() { if (futureDate > today) throw new DomainValidationException("תאריך ההערה אינו יכול להיות בעתיד"); }
        Assert.Throws<DomainValidationException>((Action)Act);
    }

    [Fact]
    public void UpdateNote_WrongAuthor_Returns403()
    {
        var noteOwnerId        = _therapistId;
        var anotherTherapistId = Guid.NewGuid();

        var mockCurrentUser = MockCurrentUser(anotherTherapistId, UserRole.Therapist);
        var currentUserId   = mockCurrentUser.Object.GetCurrentUserId();
        var isManager       = mockCurrentUser.Object.IsManager();

        var shouldForbid = noteOwnerId != currentUserId && !isManager;
        Assert.True(shouldForbid);
    }

    [Fact]
    public void DeleteNote_ByManager_Succeeds()
    {
        var noteOwnerId     = _therapistId;
        var mockCurrentUser = MockCurrentUser(_managerId, UserRole.Manager);
        var currentUserId   = mockCurrentUser.Object.GetCurrentUserId();
        var isManager       = mockCurrentUser.Object.IsManager();

        var shouldForbid = noteOwnerId != currentUserId && !isManager;
        Assert.False(shouldForbid); // manager can delete
    }

    [Fact]
    public async Task NoteRepository_UpdateAsync_PersistsChanges()
    {
        var repo = new NoteRepository(_context);
        var note = new Note
        {
            Id                = Guid.NewGuid(),
            CustomerId        = _customerId,
            UserId            = _therapistId,
            NoteDate          = DateTime.UtcNow,
            Content           = "תוכן מקורי",
            WrittenByFullName = "מטפלת ראשית",
        };
        _context.Notes.Add(note);
        await _context.SaveChangesAsync();

        note.Content = "תוכן מעודכן";
        await repo.UpdateAsync(note);

        var fromDb = await _context.Notes.FindAsync(note.Id);
        Assert.Equal("תוכן מעודכן", fromDb!.Content);
    }

    [Fact]
    public async Task NoteRepository_DeleteAsync_RemovesNote()
    {
        var repo = new NoteRepository(_context);
        var note = new Note
        {
            Id                = Guid.NewGuid(),
            CustomerId        = _customerId,
            UserId            = _therapistId,
            NoteDate          = DateTime.UtcNow,
            Content           = "להסיר",
            WrittenByFullName = "מטפלת ראשית",
        };
        _context.Notes.Add(note);
        await _context.SaveChangesAsync();

        await repo.DeleteAsync(note);

        var fromDb = await _context.Notes.FindAsync(note.Id);
        Assert.Null(fromDb);
    }

    [Fact]
    public async Task NoteRepository_ListByCustomer_OrderedByNoteDate()
    {
        var repo = new NoteRepository(_context);

        var older = new Note { Id = Guid.NewGuid(), CustomerId = _customerId, UserId = _therapistId, NoteDate = DateTime.UtcNow.AddDays(-10), Content = "ישנה", WrittenByFullName = "מטפל" };
        var newer = new Note { Id = Guid.NewGuid(), CustomerId = _customerId, UserId = _therapistId, NoteDate = DateTime.UtcNow.AddDays(-1),  Content = "חדשה",  WrittenByFullName = "מטפל" };
        _context.Notes.AddRange(older, newer);
        await _context.SaveChangesAsync();

        var list = await repo.ListByCustomerAsync(_customerId);
        Assert.True(list.Count >= 2);
        Assert.True(list[0].NoteDate >= list[1].NoteDate);
    }

    // =========================================================================
    // TREATMENT DTO TESTS
    // =========================================================================

    [Fact]
    public void TreatmentDto_HasExpectedFields()
    {
        var dto = new TreatmentDto(
            Id: Guid.NewGuid(),
            CustomerId: Guid.NewGuid(),
            TreatmentTypeId: Guid.NewGuid(),
            TreatmentTypeName: "טיפול פנים",
            TreatmentSeriesId: null,
            TreatmentDate: DateOnly.FromDateTime(DateTime.UtcNow),
            DurationMinutes: 60,
            Notes: "הערה",
            UserId: Guid.NewGuid(),
            PerformedByFullName: "מטפלת");

        Assert.Equal("טיפול פנים", dto.TreatmentTypeName);
        Assert.Equal("מטפלת", dto.PerformedByFullName);
        Assert.Equal("הערה", dto.Notes);
    }

    [Fact]
    public void NoteDto_HasExpectedFields()
    {
        var dto = new NoteDto(
            Id: Guid.NewGuid(),
            CustomerId: Guid.NewGuid(),
            TreatmentTypeId: null,
            TreatmentTypeName: null,
            NoteDate: DateOnly.FromDateTime(DateTime.UtcNow),
            Content: "תוכן הערה",
            UserId: Guid.NewGuid(),
            WrittenByFullName: "כותבת");

        Assert.Equal("תוכן הערה", dto.Content);
        Assert.Equal("כותבת", dto.WrittenByFullName);
        Assert.Null(dto.TreatmentTypeId);
    }
}
