using BeautyCareClinic.Api.Controllers;
using BeautyCareClinic.Application.DTOs;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Infrastructure.Data;
using BeautyCareClinic.Infrastructure.Repositories;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace BeautyCareClinic.Tests.Integration;

/// <summary>
/// Regression coverage for the "POST /api/v1/customers/{customerId}/orders always returns 500"
/// bug (fixed 2026-07-19, migration 20260719085129_AddTreatmentSeriesCustomerId).
///
/// Root cause was migration drift: TreatmentSeries.CustomerId existed in the Domain entity,
/// Fluent config and the EF model snapshot, but no migration file actually added the column to
/// the physical Postgres table — so __EFMigrationsHistory claimed the schema was current when
/// it structurally wasn't. This class of bug is invisible to every other test in this project
/// because they all use the EF InMemory provider (see Phase009Tests.cs / Phase010Tests.cs),
/// which materializes the C# model directly and never touches a real schema or runs real
/// migrations. Only a test that opens a real Npgsql connection and applies real migrations can
/// catch a gap between the model snapshot and the actual migration files.
///
/// Requires a reachable Postgres instance, configured the same way the EF CLI tooling is
/// configured for this repo (see BeautyCareClinic.Infrastructure/Data/DesignTimeDbContextFactory.cs):
/// set the ConnectionStrings__DefaultConnection environment variable before running `dotnet test`.
/// </summary>
public class CustomerOrdersControllerPostgresTests : IAsyncLifetime
{
    private AppDbContext _context = null!;
    private Customer _customer = null!;
    private TreatmentType _treatmentType = null!;
    private PackageType _packageType = null!;
    private Guid _createdOrderId;

    public async Task InitializeAsync()
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? throw new InvalidOperationException(
                "Set env var ConnectionStrings__DefaultConnection to a reachable Postgres instance " +
                "to run CustomerOrdersControllerPostgresTests (same variable used by the EF CLI " +
                "tooling — see DesignTimeDbContextFactory.cs).");

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .Options;
        _context = new AppDbContext(options);

        // Ensure the schema really reflects every committed migration (including
        // 20260719085129_AddTreatmentSeriesCustomerId) — this is the step that would have
        // caught the original bug: if a future migration edit again updates the model/snapshot
        // without a matching Up() operation, this Migrate() call succeeds (there's nothing new
        // to apply) but the subsequent real INSERT below fails with a Postgres error instead of
        // silently passing, exactly reproducing the original 500.
        await _context.Database.MigrateAsync();

        // Self-contained seed data — created and torn down by this test only.
        _customer = new Customer { Id = Guid.NewGuid(), FullName = "בדיקת רגרסיה", Phone = "050-1112222" };
        _treatmentType = new TreatmentType { Id = Guid.NewGuid(), Name = "טיפול בדיקה" };
        _packageType = new PackageType
        {
            Id = Guid.NewGuid(),
            TreatmentTypeId = _treatmentType.Id,
            Name = "חבילת בדיקה",
            Price = 250m,
            IsSeries = false,
            IsTimerBased = false,
        };

        _context.Customers.Add(_customer);
        _context.TreatmentTypes.Add(_treatmentType);
        _context.PackageTypes.Add(_packageType);
        await _context.SaveChangesAsync();
    }

    public async Task DisposeAsync()
    {
        // Deleting the order cascades to OrderItems then TreatmentSeries (ON DELETE CASCADE).
        if (_createdOrderId != Guid.Empty)
        {
            var order = await _context.CustomerOrders.FindAsync(_createdOrderId);
            if (order != null)
                _context.CustomerOrders.Remove(order);
        }
        _context.PackageTypes.Remove(_packageType);
        _context.TreatmentTypes.Remove(_treatmentType);
        _context.Customers.Remove(_customer);
        await _context.SaveChangesAsync();
        await _context.DisposeAsync();
    }

    [Fact]
    public async Task Create_InsertsTreatmentSeriesWithCorrectCustomerId_AndReturns201()
    {
        var customerRepository = new CustomerRepository(_context);
        var packageTypeRepository = new PackageTypeRepository(_context);
        var orderRepository = new CustomerOrderRepository(_context);
        var settingsRepository = new GlobalSettingsRepository(_context);

        var controller = new CustomerOrdersController(
            customerRepository, packageTypeRepository, orderRepository, settingsRepository, _context);

        var request = new CreateOrderRequest(
            DiscountPercentage: 0,
            MaxPaymentCount: 1,
            Items: [new CreateOrderItemRequest(_packageType.Id)]);

        var result = await controller.Create(_customer.Id, request);

        var created = Assert.IsType<CreatedAtActionResult>(result);
        Assert.Equal(201, created.StatusCode);

        var dto = Assert.IsType<OrderDto>(created.Value);
        _createdOrderId = dto.Id;
        Assert.Equal(_customer.Id, dto.CustomerId);
        Assert.Single(dto.Items);
        Assert.NotNull(dto.Items[0].SeriesId);

        // Read back directly from Postgres (bypassing the change-tracker/first-level cache) to
        // prove the CustomerId column really exists on the physical table and was persisted —
        // this is the assertion that would have failed with the original bug (500 before any
        // row was ever written, since the INSERT itself failed against the incomplete schema).
        var seriesId = dto.Items[0].SeriesId!.Value;
        var persisted = await _context.TreatmentSeries
            .AsNoTracking()
            .SingleAsync(ts => ts.Id == seriesId);

        Assert.Equal(_customer.Id, persisted.CustomerId);
        Assert.Equal(dto.Items[0].Id, persisted.OrderItemId);
    }
}
