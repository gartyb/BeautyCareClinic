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
/// Regression coverage for the "Active Series / Outstanding Balance always show '—'/'שולם' in
/// customer search results" bug. Root cause: GET /api/v1/customers never returned per-customer
/// aggregate data, so the frontend fell back to Phase-1 mock data keyed by hardcoded ids that
/// never match real customer GUIDs. Fixed by computing ActiveSeriesCount/OutstandingBalance
/// server-side, in one aggregate query per metric (no N+1), via
/// <see cref="BeautyCareClinic.Application.Interfaces.ICustomerRepository.GetAggregatesAsync"/>.
///
/// Also covers the follow-up refinement distinguishing "no orders at all" (OutstandingBalance
/// null, rendered as a muted "—" in the UI) from "has orders, all fully paid" (OutstandingBalance
/// 0m, rendered as "שולם") — see _customerWithNoData vs _customerFullyPaid below.
///
/// Uses a real Postgres connection (same convention as CustomerOrdersControllerPostgresTests)
/// because RemainingBalance is a PostgreSQL GENERATED ALWAYS AS STORED column that the EF
/// InMemory provider cannot compute.
/// </summary>
public class CustomersControllerPostgresTests : IAsyncLifetime
{
    private string _connectionString = null!;
    private AppDbContext _context = null!;

    private Customer _customerWithData = null!;
    private Customer _customerWithNoData = null!;
    private Customer _customerFullyPaid = null!;
    private TreatmentType _treatmentType = null!;
    private PackageType _seriesPackageType = null!;
    private PackageType _timerPackageType = null!;

    private CustomerOrder _order1 = null!; // partially paid
    private CustomerOrder _order2 = null!; // fully paid
    private CustomerOrder _order3 = null!; // fully paid, sole order for _customerFullyPaid
    private OrderItem _activeSeriesItem = null!;
    private OrderItem _completedSeriesItem = null!;
    private OrderItem _activeTimerItem = null!;
    private TreatmentSeries _activeSeries = null!;
    private TreatmentSeries _completedSeries = null!;
    private TreatmentSeries _activeTimerSeries = null!;

    public async Task InitializeAsync()
    {
        _connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? throw new InvalidOperationException(
                "Set env var ConnectionStrings__DefaultConnection to a reachable Postgres instance " +
                "to run CustomersControllerPostgresTests (same variable used by the EF CLI tooling — " +
                "see DesignTimeDbContextFactory.cs).");

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(_connectionString)
            .Options;
        _context = new AppDbContext(options);
        await _context.Database.MigrateAsync();

        _customerWithData = new Customer { Id = Guid.NewGuid(), FullName = "בדיקת צבירה", Phone = "050-9990001" };
        _customerWithNoData = new Customer { Id = Guid.NewGuid(), FullName = "בדיקת צבירה ריקה", Phone = "050-9990002" };
        _customerFullyPaid = new Customer { Id = Guid.NewGuid(), FullName = "בדיקת תשלום מלא", Phone = "050-9990003" };

        _treatmentType = new TreatmentType { Id = Guid.NewGuid(), Name = "טיפול צבירה בדיקה" };
        _seriesPackageType = new PackageType
        {
            Id = Guid.NewGuid(),
            TreatmentTypeId = _treatmentType.Id,
            Name = "חבילת סדרה בדיקה",
            Price = 500m,
            IsSeries = true,
            IsTimerBased = false,
            TreatmentCount = 5,
        };
        _timerPackageType = new PackageType
        {
            Id = Guid.NewGuid(),
            TreatmentTypeId = _treatmentType.Id,
            Name = "חבילת טיימר בדיקה",
            Price = 300m,
            IsSeries = true,
            IsTimerBased = true,
            MinutesPerTreatment = 600,
        };

        _context.Customers.AddRange(_customerWithData, _customerWithNoData, _customerFullyPaid);
        _context.TreatmentTypes.Add(_treatmentType);
        _context.PackageTypes.AddRange(_seriesPackageType, _timerPackageType);
        await _context.SaveChangesAsync();

        // Order 1: two items — one active (non-timer) series and one completed (non-timer) series.
        // Partially paid: DiscountedPrice 1000, AmountPaid 300 -> RemainingBalance 700.
        _order1 = new CustomerOrder
        {
            Id = Guid.NewGuid(),
            CustomerId = _customerWithData.Id,
            OrderDate = DateTime.UtcNow,
            OriginalPrice = 1000m,
            DiscountedPrice = 1000m,
            DiscountPercentage = 0m,
            MaxPaymentCount = 3,
            AmountPaid = 300m,
        };
        _context.CustomerOrders.Add(_order1);
        await _context.SaveChangesAsync();

        _activeSeriesItem = new OrderItem
        {
            Id = Guid.NewGuid(),
            OrderId = _order1.Id,
            PackageTypeId = _seriesPackageType.Id,
            UnitPrice = 500m,
            PackageNumber = 1,
        };
        _completedSeriesItem = new OrderItem
        {
            Id = Guid.NewGuid(),
            OrderId = _order1.Id,
            PackageTypeId = _seriesPackageType.Id,
            UnitPrice = 500m,
            PackageNumber = 2,
        };
        _context.OrderItems.AddRange(_activeSeriesItem, _completedSeriesItem);
        await _context.SaveChangesAsync();

        _activeSeries = new TreatmentSeries
        {
            Id = Guid.NewGuid(),
            OrderItemId = _activeSeriesItem.Id,
            CustomerId = _customerWithData.Id,
            TotalTreatments = 5,
            CompletedTreatments = 2, // active: 2 < 5
            TotalMinutes = 0,
            UsedMinutes = 0,
        };
        _completedSeries = new TreatmentSeries
        {
            Id = Guid.NewGuid(),
            OrderItemId = _completedSeriesItem.Id,
            CustomerId = _customerWithData.Id,
            TotalTreatments = 5,
            CompletedTreatments = 5, // completed: 5 == 5, not active
            TotalMinutes = 0,
            UsedMinutes = 0,
        };
        _context.TreatmentSeries.AddRange(_activeSeries, _completedSeries);
        await _context.SaveChangesAsync();

        // Order 2: one timer-based active series item. Fully paid -> RemainingBalance 0.
        _order2 = new CustomerOrder
        {
            Id = Guid.NewGuid(),
            CustomerId = _customerWithData.Id,
            OrderDate = DateTime.UtcNow,
            OriginalPrice = 300m,
            DiscountedPrice = 300m,
            DiscountPercentage = 0m,
            MaxPaymentCount = 1,
            AmountPaid = 300m,
        };
        _context.CustomerOrders.Add(_order2);
        await _context.SaveChangesAsync();

        _activeTimerItem = new OrderItem
        {
            Id = Guid.NewGuid(),
            OrderId = _order2.Id,
            PackageTypeId = _timerPackageType.Id,
            UnitPrice = 300m,
            PackageNumber = 1,
        };
        _context.OrderItems.Add(_activeTimerItem);
        await _context.SaveChangesAsync();

        _activeTimerSeries = new TreatmentSeries
        {
            Id = Guid.NewGuid(),
            OrderItemId = _activeTimerItem.Id,
            CustomerId = _customerWithData.Id,
            TotalTreatments = 0,
            CompletedTreatments = 0,
            TotalMinutes = 600,
            UsedMinutes = 100, // active: 100 < 600
        };
        _context.TreatmentSeries.Add(_activeTimerSeries);
        await _context.SaveChangesAsync();

        // Order 3: sole order for _customerFullyPaid — no series items, fully paid.
        // DiscountedPrice 200, AmountPaid 200 -> RemainingBalance 0m. Distinguishes "has orders,
        // fully paid" (0m) from "no orders at all" (_customerWithNoData, null).
        _order3 = new CustomerOrder
        {
            Id = Guid.NewGuid(),
            CustomerId = _customerFullyPaid.Id,
            OrderDate = DateTime.UtcNow,
            OriginalPrice = 200m,
            DiscountedPrice = 200m,
            DiscountPercentage = 0m,
            MaxPaymentCount = 1,
            AmountPaid = 200m,
        };
        _context.CustomerOrders.Add(_order3);
        await _context.SaveChangesAsync();
    }

    public async Task DisposeAsync()
    {
        _context.TreatmentSeries.RemoveRange(_activeSeries, _completedSeries, _activeTimerSeries);
        await _context.SaveChangesAsync();

        _context.CustomerOrders.RemoveRange(_order1, _order2, _order3);
        await _context.SaveChangesAsync();

        _context.PackageTypes.RemoveRange(_seriesPackageType, _timerPackageType);
        _context.TreatmentTypes.Remove(_treatmentType);
        _context.Customers.RemoveRange(_customerWithData, _customerWithNoData, _customerFullyPaid);
        await _context.SaveChangesAsync();
        await _context.DisposeAsync();
    }

    [Fact]
    public async Task GetAll_ReturnsCorrectAggregates_ForCustomerWithMixedSeriesAndPartialPayment()
    {
        var repository = new CustomerRepository(_context);
        var controller = new CustomersController(repository);

        var result = await controller.GetAll(search: null);
        var ok = Assert.IsType<OkObjectResult>(result);
        var dtos = Assert.IsAssignableFrom<IEnumerable<CustomerDto>>(ok.Value).ToList();

        var dto = dtos.Single(d => d.Id == _customerWithData.Id);

        // Active series: _activeSeries (2/5) + _activeTimerSeries (100/600) = 2. Completed series excluded.
        Assert.Equal(2, dto.ActiveSeriesCount);

        // Outstanding balance: order1 (1000 - 300 = 700) + order2 (300 - 300 = 0) = 700.
        Assert.Equal(700m, dto.OutstandingBalance);
    }

    [Fact]
    public async Task GetAll_ReturnsNullBalance_ForCustomerWithNoSeriesOrOrders()
    {
        var repository = new CustomerRepository(_context);
        var controller = new CustomersController(repository);

        var result = await controller.GetAll(search: null);
        var ok = Assert.IsType<OkObjectResult>(result);
        var dtos = Assert.IsAssignableFrom<IEnumerable<CustomerDto>>(ok.Value).ToList();

        var dto = dtos.Single(d => d.Id == _customerWithNoData.Id);

        Assert.Equal(0, dto.ActiveSeriesCount);
        Assert.Null(dto.OutstandingBalance);
    }

    [Fact]
    public async Task GetAll_ReturnsZeroBalance_ForCustomerWithFullyPaidOrders()
    {
        var repository = new CustomerRepository(_context);
        var controller = new CustomersController(repository);

        var result = await controller.GetAll(search: null);
        var ok = Assert.IsType<OkObjectResult>(result);
        var dtos = Assert.IsAssignableFrom<IEnumerable<CustomerDto>>(ok.Value).ToList();

        var dto = dtos.Single(d => d.Id == _customerFullyPaid.Id);

        // Has a real order (order3), fully paid -> 0m, not null.
        Assert.Equal(0, dto.ActiveSeriesCount);
        Assert.Equal(0m, dto.OutstandingBalance);
    }

    [Fact]
    public async Task GetById_ReturnsCorrectAggregates_ForCustomerWithMixedSeriesAndPartialPayment()
    {
        var repository = new CustomerRepository(_context);
        var controller = new CustomersController(repository);

        var result = await controller.GetById(_customerWithData.Id);
        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = Assert.IsType<CustomerDto>(ok.Value);

        Assert.Equal(2, dto.ActiveSeriesCount);
        Assert.Equal(700m, dto.OutstandingBalance);
    }

    [Fact]
    public async Task GetById_ReturnsNullBalance_ForCustomerWithNoSeriesOrOrders()
    {
        var repository = new CustomerRepository(_context);
        var controller = new CustomersController(repository);

        var result = await controller.GetById(_customerWithNoData.Id);
        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = Assert.IsType<CustomerDto>(ok.Value);

        Assert.Equal(0, dto.ActiveSeriesCount);
        Assert.Null(dto.OutstandingBalance);
    }

    [Fact]
    public async Task GetById_ReturnsZeroBalance_ForCustomerWithFullyPaidOrders()
    {
        var repository = new CustomerRepository(_context);
        var controller = new CustomersController(repository);

        var result = await controller.GetById(_customerFullyPaid.Id);
        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = Assert.IsType<CustomerDto>(ok.Value);

        Assert.Equal(0, dto.ActiveSeriesCount);
        Assert.Equal(0m, dto.OutstandingBalance);
    }
}
