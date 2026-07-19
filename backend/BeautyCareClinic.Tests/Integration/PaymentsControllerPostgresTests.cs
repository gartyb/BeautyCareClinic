using BeautyCareClinic.Api.Controllers;
using BeautyCareClinic.Application.DTOs;
using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Domain.Enums;
using BeautyCareClinic.Infrastructure.Data;
using BeautyCareClinic.Infrastructure.Repositories;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace BeautyCareClinic.Tests.Integration;

/// <summary>
/// Regression coverage for the "recording a payment always returns 500" bug (fixed 2026-07-19).
///
/// Root cause: <c>Payment.PaymentDate</c> is mapped to a Postgres <c>timestamp with time zone</c>
/// column. <see cref="PaymentsController.Create"/> built the value with
/// <c>request.PaymentDate.ToDateTime(TimeOnly.MinValue)</c> — no <see cref="DateTimeKind"/>
/// argument — which produces a <see cref="DateTime"/> with <c>Kind=Unspecified</c>. Npgsql
/// refuses to write <c>Kind=Unspecified</c> values into a <c>timestamptz</c> column and throws
/// <see cref="ArgumentException"/> at SaveChanges time.
///
/// This class of bug is invisible to the EF InMemory provider (see Phase010Tests.cs), which
/// never applies the Npgsql <c>DateTimeKind</c> check. Only a test that writes through a real
/// Npgsql connection can reproduce it — same pattern as
/// <see cref="CustomerOrdersControllerPostgresTests"/> (FU-017).
///
/// Requires a reachable Postgres instance via the ConnectionStrings__DefaultConnection env var
/// (same variable used by the EF CLI tooling — see DesignTimeDbContextFactory.cs).
/// </summary>
public class PaymentsControllerPostgresTests : IAsyncLifetime
{
    private string _connectionString = null!;
    private AppDbContext _context = null!;
    private Customer _customer = null!;
    private TreatmentType _treatmentType = null!;
    private PackageType _packageType = null!;
    private User _user = null!;
    private CustomerOrder _order = null!;

    public async Task InitializeAsync()
    {
        _connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? throw new InvalidOperationException(
                "Set env var ConnectionStrings__DefaultConnection to a reachable Postgres instance " +
                "to run PaymentsControllerPostgresTests (same variable used by the EF CLI tooling — " +
                "see DesignTimeDbContextFactory.cs).");

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(_connectionString)
            .Options;
        _context = new AppDbContext(options);

        // Ensure the schema really reflects every committed migration.
        await _context.Database.MigrateAsync();

        // Self-contained seed data — created and torn down by this test only.
        _customer = new Customer { Id = Guid.NewGuid(), FullName = "בדיקת תשלום", Phone = "050-3334444" };
        _treatmentType = new TreatmentType { Id = Guid.NewGuid(), Name = "טיפול בדיקת תשלום" };
        _packageType = new PackageType
        {
            Id = Guid.NewGuid(),
            TreatmentTypeId = _treatmentType.Id,
            Name = "חבילת בדיקת תשלום",
            Price = 400m,
            IsSeries = false,
            IsTimerBased = false,
        };
        _user = new User
        {
            Id = Guid.NewGuid(),
            FullName = "מטפלת בדיקה",
            Email = $"payment-test-{Guid.NewGuid():N}@test.com",
            Role = UserRole.Therapist,
        };

        _context.Customers.Add(_customer);
        _context.TreatmentTypes.Add(_treatmentType);
        _context.PackageTypes.Add(_packageType);
        _context.Users.Add(_user);
        await _context.SaveChangesAsync();

        _order = new CustomerOrder
        {
            Id = Guid.NewGuid(),
            CustomerId = _customer.Id,
            OrderDate = DateTime.UtcNow,
            OriginalPrice = _packageType.Price,
            DiscountedPrice = _packageType.Price,
            DiscountPercentage = 0m,
            MaxPaymentCount = 3,
            AmountPaid = 0m,
        };
        _context.CustomerOrders.Add(_order);

        var item = new OrderItem
        {
            Id = Guid.NewGuid(),
            OrderId = _order.Id,
            PackageTypeId = _packageType.Id,
            UnitPrice = _packageType.Price,
            PackageNumber = 1,
        };
        _context.OrderItems.Add(item);

        await _context.SaveChangesAsync();
    }

    public async Task DisposeAsync()
    {
        var order = await _context.CustomerOrders.FindAsync(_order.Id);
        if (order != null)
            _context.CustomerOrders.Remove(order); // cascades Payments + OrderItems

        var user = await _context.Users.FindAsync(_user.Id);
        if (user != null)
            _context.Users.Remove(user);

        _context.PackageTypes.Remove(_packageType);
        _context.TreatmentTypes.Remove(_treatmentType);
        _context.Customers.Remove(_customer);
        await _context.SaveChangesAsync();
        await _context.DisposeAsync();
    }

    [Fact]
    public async Task Create_WritesPaymentDateToRealPostgres_AndReturns201()
    {
        var orderRepository = new CustomerOrderRepository(_context);
        var paymentRepository = new PaymentRepository(_context);
        var userRepository = new UserRepository(_context);

        var currentUserMock = new Mock<ICurrentUserService>();
        currentUserMock.Setup(s => s.GetCurrentUserId()).Returns(_user.Id);
        currentUserMock.Setup(s => s.IsManager()).Returns(false);

        var controller = new PaymentsController(
            orderRepository, paymentRepository, userRepository, currentUserMock.Object, _context);

        var request = new CreatePaymentRequest(
            Amount: 150m,
            PaymentMethod: "Cash",
            PaymentDate: DateOnly.FromDateTime(DateTime.UtcNow));

        // Before the fix, this call throws System.ArgumentException ("Cannot write DateTime with
        // Kind=Unspecified to PostgreSQL type 'timestamp with time zone'") from inside
        // SaveChangesAsync — i.e. it never reaches CreatedAtActionResult.
        var result = await controller.Create(_order.Id, request);

        var created = Assert.IsType<CreatedAtActionResult>(result);
        Assert.Equal(201, created.StatusCode);

        var dto = Assert.IsType<PaymentDto>(created.Value);
        Assert.Equal(150m, dto.Amount);
        Assert.Equal(request.PaymentDate, dto.PaymentDate);

        // Read back directly from Postgres, bypassing the change tracker, to prove the row (and
        // its timestamptz column) really persisted.
        var persisted = await _context.Payments
            .AsNoTracking()
            .SingleAsync(p => p.Id == dto.Id);

        Assert.Equal(_order.Id, persisted.OrderId);
        Assert.Equal(150m, persisted.Amount);
        Assert.Equal(request.PaymentDate, DateOnly.FromDateTime(persisted.PaymentDate));
    }
}
