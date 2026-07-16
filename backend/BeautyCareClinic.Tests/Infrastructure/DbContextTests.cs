using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Domain.Enums;
using BeautyCareClinic.Infrastructure.Data;
using BeautyCareClinic.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace BeautyCareClinic.Tests.Infrastructure;

/// <summary>
/// Verifies DbContext configuration: DbSets exist, enum-to-string conversions,
/// and entity relationships. Uses InMemory provider — does not require PostgreSQL.
/// </summary>
public class DbContextTests : IDisposable
{
    private readonly AppDbContext _context;

    public DbContextTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new AppDbContext(options);
    }

    public void Dispose() => _context.Dispose();

    [Fact]
    public void DbContext_HasAllRequiredDbSets()
    {
        // Verify all 16 domain entity DbSets exist
        Assert.NotNull(_context.Users);
        Assert.NotNull(_context.Customers);
        Assert.NotNull(_context.TreatmentTypes);
        Assert.NotNull(_context.PackageTypes);
        Assert.NotNull(_context.CustomerOrders);
        Assert.NotNull(_context.OrderItems);
        Assert.NotNull(_context.Payments);
        Assert.NotNull(_context.TreatmentSeries);
        Assert.NotNull(_context.Treatments);
        Assert.NotNull(_context.TreatmentPhotos);
        Assert.NotNull(_context.Appointments);
        Assert.NotNull(_context.TherapistWorkingHours);
        Assert.NotNull(_context.TherapistUnavailableDates);
        Assert.NotNull(_context.TherapistCapabilities);
        Assert.NotNull(_context.Notes);
        Assert.NotNull(_context.GlobalSettings);
    }

    [Fact]
    public async Task User_CanBeAddedAndRetrieved()
    {
        var user = new User
        {
            Id       = Guid.NewGuid(),
            FullName = "Test Manager",
            Email    = "test@clinic.local",
            Role     = UserRole.Manager
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var retrieved = await _context.Users.FindAsync(user.Id);
        Assert.NotNull(retrieved);
        Assert.Equal("Test Manager", retrieved.FullName);
        Assert.Equal(UserRole.Manager, retrieved.Role);
    }

    [Fact]
    public async Task Appointment_DefaultStatus_PersistedAsScheduled()
    {
        var customer      = new Customer { Id = Guid.NewGuid(), FullName = "Test", Phone = "050-0000000" };
        var treatmentType = new TreatmentType { Id = Guid.NewGuid(), Name = "Test" };
        var user          = new User { Id = Guid.NewGuid(), FullName = "T", Email = "t@t.com", Role = UserRole.Therapist };

        _context.Customers.Add(customer);
        _context.TreatmentTypes.Add(treatmentType);
        _context.Users.Add(user);

        var appointment = new Appointment
        {
            Id              = Guid.NewGuid(),
            CustomerId      = customer.Id,
            TreatmentTypeId = treatmentType.Id,
            UserId          = user.Id,
            StartTime       = DateTime.UtcNow,
            EndTime         = DateTime.UtcNow.AddHours(1),
            CreatedAt       = DateTime.UtcNow
            // Status defaults to Scheduled
        };

        _context.Appointments.Add(appointment);
        await _context.SaveChangesAsync();

        var retrieved = await _context.Appointments.FindAsync(appointment.Id);
        Assert.NotNull(retrieved);
        Assert.Equal(AppointmentStatus.Scheduled, retrieved.Status);
    }

    [Fact]
    public async Task GlobalSetting_CanBeAddedAndQueried()
    {
        var setting = new GlobalSetting
        {
            Id    = Guid.NewGuid(),
            Name  = "default_max_payment_count",
            Value = "12"
        };

        _context.GlobalSettings.Add(setting);
        await _context.SaveChangesAsync();

        var retrieved = _context.GlobalSettings.FirstOrDefault(g => g.Name == "default_max_payment_count");
        Assert.NotNull(retrieved);
        Assert.Equal("12", retrieved.Value);
    }

    [Fact]
    public async Task TreatmentSeries_OneToOne_OrderItem()
    {
        // Verify the 1:1 relationship: OrderItem → TreatmentSeries
        var customer      = new Customer { Id = Guid.NewGuid(), FullName = "T", Phone = "050-0000000" };
        var treatmentType = new TreatmentType { Id = Guid.NewGuid(), Name = "TT" };
        var packageType   = new PackageType { Id = Guid.NewGuid(), TreatmentTypeId = treatmentType.Id, Name = "Pkg", IsSeries = true, IsTimerBased = false };
        var order         = new CustomerOrder { Id = Guid.NewGuid(), CustomerId = customer.Id, OrderDate = DateTime.UtcNow };
        var orderItem     = new OrderItem { Id = Guid.NewGuid(), OrderId = order.Id, PackageTypeId = packageType.Id };
        var series        = new TreatmentSeries { Id = Guid.NewGuid(), OrderItemId = orderItem.Id, TotalTreatments = 10, CompletedTreatments = 0, TotalMinutes = 0, UsedMinutes = 0 };

        _context.Customers.Add(customer);
        _context.TreatmentTypes.Add(treatmentType);
        _context.PackageTypes.Add(packageType);
        _context.CustomerOrders.Add(order);
        _context.OrderItems.Add(orderItem);
        _context.TreatmentSeries.Add(series);
        await _context.SaveChangesAsync();

        var retrievedItem = await _context.OrderItems
            .Include(oi => oi.TreatmentSeries)
            .FirstOrDefaultAsync(oi => oi.Id == orderItem.Id);

        Assert.NotNull(retrievedItem);
        Assert.NotNull(retrievedItem.TreatmentSeries);
        Assert.Equal(10, retrievedItem.TreatmentSeries.TotalTreatments);
    }
}
