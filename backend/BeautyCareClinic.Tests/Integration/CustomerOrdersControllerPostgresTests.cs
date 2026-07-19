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
    private string _connectionString = null!;
    private AppDbContext _context = null!;
    private Customer _customer = null!;
    private TreatmentType _treatmentType = null!;
    private PackageType _packageType = null!;
    private Guid _createdOrderId;

    public async Task InitializeAsync()
    {
        _connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? throw new InvalidOperationException(
                "Set env var ConnectionStrings__DefaultConnection to a reachable Postgres instance " +
                "to run CustomerOrdersControllerPostgresTests (same variable used by the EF CLI " +
                "tooling — see DesignTimeDbContextFactory.cs).");

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(_connectionString)
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

    /// <summary>
    /// Coverage for CR-031 (stable per-customer package numbering). Asserts PackageNumber
    /// increments correctly (a) across multiple items within a single order and (b) across
    /// two sequential separate orders for the same customer — the class of test that would
    /// catch both a broken numbering algorithm and a migration-drift bug (missing column /
    /// mismatched NOT NULL state), since it runs against a real Postgres schema built from the
    /// actual migration files rather than the EF InMemory provider.
    /// </summary>
    [Fact]
    public async Task Create_AssignsSequentialPackageNumbers_AcrossMultipleItemsAndSeparateOrders()
    {
        var customerRepository = new CustomerRepository(_context);
        var packageTypeRepository = new PackageTypeRepository(_context);
        var orderRepository = new CustomerOrderRepository(_context);
        var settingsRepository = new GlobalSettingsRepository(_context);

        // Second package type so a single order can contain two distinct items.
        var packageType2 = new PackageType
        {
            Id = Guid.NewGuid(),
            TreatmentTypeId = _treatmentType.Id,
            Name = "חבילת בדיקה 2",
            Price = 300m,
            IsSeries = false,
            IsTimerBased = false,
        };
        _context.PackageTypes.Add(packageType2);
        await _context.SaveChangesAsync();

        try
        {
            var controller = new CustomerOrdersController(
                customerRepository, packageTypeRepository, orderRepository, settingsRepository, _context);

            // First order: two items in one request — should be numbered #1 and #2, in request order.
            var firstRequest = new CreateOrderRequest(
                DiscountPercentage: 0,
                MaxPaymentCount: 1,
                Items:
                [
                    new CreateOrderItemRequest(_packageType.Id),
                    new CreateOrderItemRequest(packageType2.Id),
                ]);

            var firstResult = await controller.Create(_customer.Id, firstRequest);
            var firstCreated = Assert.IsType<CreatedAtActionResult>(firstResult);
            var firstDto = Assert.IsType<OrderDto>(firstCreated.Value);
            _createdOrderId = firstDto.Id;

            Assert.Equal(2, firstDto.Items.Count);
            Assert.Equal(1, firstDto.Items[0].PackageNumber);
            Assert.Equal(2, firstDto.Items[1].PackageNumber);

            // Second, separate order for the same customer — should continue at #3.
            var secondRequest = new CreateOrderRequest(
                DiscountPercentage: 0,
                MaxPaymentCount: 1,
                Items: [new CreateOrderItemRequest(_packageType.Id)]);

            var secondResult = await controller.Create(_customer.Id, secondRequest);
            var secondCreated = Assert.IsType<CreatedAtActionResult>(secondResult);
            var secondDto = Assert.IsType<OrderDto>(secondCreated.Value);

            Assert.Single(secondDto.Items);
            Assert.Equal(3, secondDto.Items[0].PackageNumber);

            // Read back directly from Postgres, bypassing the change tracker, to prove the
            // numbers really persisted to the physical column (not just held in memory).
            var persistedNumbers = await _context.OrderItems
                .AsNoTracking()
                .Where(oi => oi.Id == firstDto.Items[0].Id || oi.Id == firstDto.Items[1].Id || oi.Id == secondDto.Items[0].Id)
                .Select(oi => oi.PackageNumber)
                .ToListAsync();
            Assert.Equal(new[] { 1, 2, 3 }, persistedNumbers.OrderBy(n => n));

            // Clean up the second order too (DisposeAsync only tracks _createdOrderId).
            var secondOrder = await _context.CustomerOrders.FindAsync(secondDto.Id);
            if (secondOrder != null)
                _context.CustomerOrders.Remove(secondOrder);
            await _context.SaveChangesAsync();
        }
        finally
        {
            _context.PackageTypes.Remove(packageType2);
            await _context.SaveChangesAsync();
        }
    }

    /// <summary>
    /// Coverage for CR-031 / RC-1 (row-level lock preventing concurrent PackageNumber
    /// collisions). Fires N truly parallel <see cref="CustomerOrdersController.Create"/> calls
    /// for the same customer — each on its own <see cref="AppDbContext"/>, since DbContext is
    /// not thread-safe and must never be shared across concurrent operations — and asserts the
    /// resulting PackageNumber set is exactly {1..N} with no duplicates and no gaps. Without the
    /// "SELECT ... FOR UPDATE" row lock on the Customer row in CustomerOrdersController.Create,
    /// this test is expected to be flaky/fail under real concurrent load (two transactions both
    /// reading the same MAX(PackageNumber) before either commits).
    /// </summary>
    [Fact]
    public async Task Create_ConcurrentRequestsForSameCustomer_AssignUniqueSequentialPackageNumbers()
    {
        const int concurrency = 5;

        var contexts = new AppDbContext[concurrency];
        var orderIds = new Guid[concurrency];

        try
        {
            var tasks = new Task<int[]>[concurrency];
            for (var i = 0; i < concurrency; i++)
            {
                var options = new DbContextOptionsBuilder<AppDbContext>()
                    .UseNpgsql(_connectionString)
                    .Options;
                var ctx = new AppDbContext(options);
                contexts[i] = ctx;

                var index = i;
                tasks[i] = Task.Run(async () =>
                {
                    var customerRepository = new CustomerRepository(ctx);
                    var packageTypeRepository = new PackageTypeRepository(ctx);
                    var orderRepository = new CustomerOrderRepository(ctx);
                    var settingsRepository = new GlobalSettingsRepository(ctx);

                    var controller = new CustomerOrdersController(
                        customerRepository, packageTypeRepository, orderRepository, settingsRepository, ctx);

                    var request = new CreateOrderRequest(
                        DiscountPercentage: 0,
                        MaxPaymentCount: 1,
                        Items: [new CreateOrderItemRequest(_packageType.Id)]);

                    var result = await controller.Create(_customer.Id, request);
                    var created = Assert.IsType<CreatedAtActionResult>(result);
                    var dto = Assert.IsType<OrderDto>(created.Value);
                    orderIds[index] = dto.Id;
                    return dto.Items.Select(x => x.PackageNumber).ToArray();
                });
            }

            var results = await Task.WhenAll(tasks);
            var packageNumbers = results.SelectMany(r => r).OrderBy(n => n).ToArray();

            // No duplicates, no gaps — exactly {1..concurrency} since this customer (fresh per
            // test, per IAsyncLifetime) has no other orders.
            Assert.Equal(concurrency, packageNumbers.Length);
            Assert.Equal(concurrency, packageNumbers.Distinct().Count());
            Assert.Equal(Enumerable.Range(1, concurrency), packageNumbers);

            // Read back directly from Postgres via a fresh context, bypassing every call's own
            // change tracker, to prove the numbers really persisted without collisions.
            var verifyOptions = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(_connectionString).Options;
            await using var verifyContext = new AppDbContext(verifyOptions);
            var persisted = await verifyContext.OrderItems
                .AsNoTracking()
                .Where(oi => orderIds.Contains(oi.OrderId))
                .Select(oi => oi.PackageNumber)
                .ToListAsync();
            Assert.Equal(Enumerable.Range(1, concurrency), persisted.OrderBy(n => n));
        }
        finally
        {
            // Clean up via a fresh context — the per-call contexts are disposed right after.
            var cleanupOptions = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(_connectionString).Options;
            await using (var cleanupContext = new AppDbContext(cleanupOptions))
            {
                foreach (var orderId in orderIds)
                {
                    if (orderId == Guid.Empty)
                        continue;
                    var order = await cleanupContext.CustomerOrders.FindAsync(orderId);
                    if (order != null)
                        cleanupContext.CustomerOrders.Remove(order);
                }
                await cleanupContext.SaveChangesAsync();
            }

            foreach (var ctx in contexts)
            {
                if (ctx != null)
                    await ctx.DisposeAsync();
            }
        }
    }
}
