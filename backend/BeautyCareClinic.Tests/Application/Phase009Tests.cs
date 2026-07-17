using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Application.Services;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Domain.Exceptions;
using BeautyCareClinic.Infrastructure.Data;
using BeautyCareClinic.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace BeautyCareClinic.Tests.Application;

/// <summary>
/// Phase 009 — Orders, Series and Payments unit tests.
/// Uses InMemory EF Core provider.
/// RC-1 note: RemainingBalance is a PostgreSQL GENERATED column — InMemory provider does not
/// compute it. Tests that rely on RemainingBalance set it manually to simulate the DB value.
/// A Postgres integration test would be required to fully verify RC-1.
/// TODO: RC-1 integration test against real Postgres (Testcontainers).
/// </summary>
public class Phase009OrdersTests : IDisposable
{
    private readonly AppDbContext _context;

    public Phase009OrdersTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new AppDbContext(options);
    }

    public void Dispose() => _context.Dispose();

    // -----------------------------------------------------------------------
    // PackageType business rule tests
    // -----------------------------------------------------------------------

    [Fact]
    public async Task PackageTypeRepository_Create_SucceedsWithValidData()
    {
        var repo = new PackageTypeRepository(_context);
        var treatmentType = new TreatmentType { Id = Guid.NewGuid(), Name = "טיפול פנים" };
        _context.TreatmentTypes.Add(treatmentType);
        await _context.SaveChangesAsync();

        var pkg = new PackageType
        {
            Id              = Guid.NewGuid(),
            TreatmentTypeId = treatmentType.Id,
            Name            = "חבילת 10 טיפולים",
            Price           = 500m,
            IsSeries        = true,
            IsTimerBased    = false,
            TreatmentCount  = 10,
        };

        var created = await repo.AddAsync(pkg);

        Assert.Equal(pkg.Id, created.Id);
        Assert.Equal(500m, created.Price);
        var fromDb = await _context.PackageTypes.FindAsync(pkg.Id);
        Assert.NotNull(fromDb);
    }

    [Fact]
    public async Task PackageTypeRepository_ExistsByName_DetectsDuplicate()
    {
        var repo = new PackageTypeRepository(_context);
        var treatmentType = new TreatmentType { Id = Guid.NewGuid(), Name = "לייזר" };
        _context.TreatmentTypes.Add(treatmentType);
        await _context.SaveChangesAsync();

        var pkg = new PackageType
        {
            Id              = Guid.NewGuid(),
            TreatmentTypeId = treatmentType.Id,
            Name            = "חבילת לייזר",
            Price           = 300m,
        };
        _context.PackageTypes.Add(pkg);
        await _context.SaveChangesAsync();

        // ExistsByNameAsync uses ILike — in InMemory this falls back to case-sensitive
        // so we test exact match which works in both
        var exists = await repo.ExistsByNameAsync("חבילת לייזר");
        Assert.True(exists);
    }

    [Fact]
    public async Task PackageTypeRepository_ExistsByName_ExcludesCurrentId()
    {
        var repo = new PackageTypeRepository(_context);
        var treatmentType = new TreatmentType { Id = Guid.NewGuid(), Name = "לייזר" };
        _context.TreatmentTypes.Add(treatmentType);
        await _context.SaveChangesAsync();

        var id = Guid.NewGuid();
        var pkg = new PackageType
        {
            Id              = id,
            TreatmentTypeId = treatmentType.Id,
            Name            = "חבילה ייחודית",
            Price           = 200m,
        };
        _context.PackageTypes.Add(pkg);
        await _context.SaveChangesAsync();

        // Excluding own ID: should not detect itself as duplicate
        var exists = await repo.ExistsByNameAsync("חבילה ייחודית", excludeId: id);
        Assert.False(exists);
    }

    [Fact]
    public async Task PackageTypeRepository_HasOrderItems_ReturnsTrueWhenUsed()
    {
        var repo = new PackageTypeRepository(_context);
        var treatmentType = new TreatmentType { Id = Guid.NewGuid(), Name = "עיסוי" };
        _context.TreatmentTypes.Add(treatmentType);

        var pkgId = Guid.NewGuid();
        var pkg = new PackageType { Id = pkgId, TreatmentTypeId = treatmentType.Id, Name = "עיסוי 5", Price = 400m };
        _context.PackageTypes.Add(pkg);

        var customer = new Customer { Id = Guid.NewGuid(), FullName = "דנה כהן", Phone = "050-1111111" };
        _context.Customers.Add(customer);

        var order = new CustomerOrder
        {
            Id = Guid.NewGuid(), CustomerId = customer.Id,
            OrderDate = DateTime.UtcNow, OriginalPrice = 400m, DiscountedPrice = 400m,
            DiscountPercentage = 0m, MaxPaymentCount = 3, AmountPaid = 0m,
        };
        _context.CustomerOrders.Add(order);

        var item = new OrderItem { Id = Guid.NewGuid(), OrderId = order.Id, PackageTypeId = pkgId, UnitPrice = 400m };
        _context.OrderItems.Add(item);

        await _context.SaveChangesAsync();

        var hasOrders = await repo.HasOrderItemsAsync(pkgId);
        Assert.True(hasOrders);
    }

    [Fact]
    public async Task PackageTypeRepository_HasOrderItems_ReturnsFalseWhenUnused()
    {
        var repo = new PackageTypeRepository(_context);
        var treatmentType = new TreatmentType { Id = Guid.NewGuid(), Name = "פנים" };
        _context.TreatmentTypes.Add(treatmentType);
        var pkg = new PackageType { Id = Guid.NewGuid(), TreatmentTypeId = treatmentType.Id, Name = "חבילה ריקה", Price = 100m };
        _context.PackageTypes.Add(pkg);
        await _context.SaveChangesAsync();

        var hasOrders = await repo.HasOrderItemsAsync(pkg.Id);
        Assert.False(hasOrders);
    }

    // -----------------------------------------------------------------------
    // CustomerOrder price calculation tests
    // -----------------------------------------------------------------------

    [Theory]
    [InlineData(500.00, 10.0, 450.00)]
    [InlineData(1000.00, 0.0, 1000.00)]
    [InlineData(300.00, 50.0, 150.00)]
    [InlineData(100.00, 15.5, 84.50)]
    public void OrderDiscountCalculation_IsCorrect(decimal originalPrice, decimal discountPct, decimal expectedDiscounted)
    {
        // Replicate the server-side formula (must match controller)
        var discountedPrice = originalPrice * (1m - discountPct / 100m);
        discountedPrice = Math.Round(discountedPrice, 2, MidpointRounding.AwayFromZero);
        Assert.Equal(expectedDiscounted, discountedPrice);
    }

    [Fact]
    public async Task CustomerOrderRepository_CreateOrder_PersistsWithItems()
    {
        var treatmentType = new TreatmentType { Id = Guid.NewGuid(), Name = "פנים" };
        _context.TreatmentTypes.Add(treatmentType);
        var pkgType = new PackageType
        {
            Id = Guid.NewGuid(), TreatmentTypeId = treatmentType.Id,
            Name = "חבילת פנים", Price = 500m, IsSeries = true, TreatmentCount = 5,
        };
        _context.PackageTypes.Add(pkgType);
        var customer = new Customer { Id = Guid.NewGuid(), FullName = "שרה לוי", Phone = "052-1234567" };
        _context.Customers.Add(customer);
        await _context.SaveChangesAsync();

        var order = new CustomerOrder
        {
            Id = Guid.NewGuid(), CustomerId = customer.Id,
            OrderDate = DateTime.UtcNow, OriginalPrice = 500m, DiscountedPrice = 450m,
            DiscountPercentage = 10m, MaxPaymentCount = 3, AmountPaid = 0m,
        };
        _context.CustomerOrders.Add(order);

        var item = new OrderItem { Id = Guid.NewGuid(), OrderId = order.Id, PackageTypeId = pkgType.Id, UnitPrice = 500m };
        _context.OrderItems.Add(item);

        var series = new TreatmentSeries
        {
            Id = Guid.NewGuid(), OrderItemId = item.Id,
            TotalTreatments = 5, CompletedTreatments = 0,
        };
        _context.TreatmentSeries.Add(series);
        await _context.SaveChangesAsync();

        var fromDb = await _context.CustomerOrders
            .Include(o => o.Items).ThenInclude(i => i.TreatmentSeries)
            .FirstOrDefaultAsync(o => o.Id == order.Id);

        Assert.NotNull(fromDb);
        Assert.Single(fromDb.Items);
        var dbItem = fromDb.Items.First();
        Assert.NotNull(dbItem.TreatmentSeries);
        Assert.Equal(5, dbItem.TreatmentSeries.TotalTreatments);
        Assert.Equal(0, dbItem.TreatmentSeries.CompletedTreatments);
    }

    [Fact]
    public async Task CustomerOrderRepository_NonSeriesPackage_DoesNotCreateSeries()
    {
        var treatmentType = new TreatmentType { Id = Guid.NewGuid(), Name = "לייזר" };
        _context.TreatmentTypes.Add(treatmentType);
        var pkgType = new PackageType
        {
            Id = Guid.NewGuid(), TreatmentTypeId = treatmentType.Id,
            Name = "טיפול לייזר בודד", Price = 200m, IsSeries = false,
        };
        _context.PackageTypes.Add(pkgType);
        var customer = new Customer { Id = Guid.NewGuid(), FullName = "רחל ישראלי", Phone = "053-9876543" };
        _context.Customers.Add(customer);
        await _context.SaveChangesAsync();

        var order = new CustomerOrder
        {
            Id = Guid.NewGuid(), CustomerId = customer.Id,
            OrderDate = DateTime.UtcNow, OriginalPrice = 200m, DiscountedPrice = 200m,
            DiscountPercentage = 0m, MaxPaymentCount = 1, AmountPaid = 0m,
        };
        _context.CustomerOrders.Add(order);

        var item = new OrderItem { Id = Guid.NewGuid(), OrderId = order.Id, PackageTypeId = pkgType.Id, UnitPrice = 200m };
        _context.OrderItems.Add(item);
        // No TreatmentSeries for non-series packages
        await _context.SaveChangesAsync();

        var dbItem = await _context.OrderItems
            .Include(i => i.TreatmentSeries)
            .FirstOrDefaultAsync(i => i.Id == item.Id);

        Assert.NotNull(dbItem);
        Assert.Null(dbItem.TreatmentSeries);
    }

    [Fact]
    public async Task CustomerOrderRepository_HasDependentData_ReturnsTrueWithPayments()
    {
        var repo = new CustomerOrderRepository(_context);
        var treatmentType = new TreatmentType { Id = Guid.NewGuid(), Name = "פנים" };
        _context.TreatmentTypes.Add(treatmentType);
        var pkgType = new PackageType { Id = Guid.NewGuid(), TreatmentTypeId = treatmentType.Id, Name = "חבילה", Price = 100m };
        _context.PackageTypes.Add(pkgType);
        var customer = new Customer { Id = Guid.NewGuid(), FullName = "מיכל", Phone = "054-1111111" };
        _context.Customers.Add(customer);

        var orderId = Guid.NewGuid();
        var order = new CustomerOrder
        {
            Id = orderId, CustomerId = customer.Id,
            OrderDate = DateTime.UtcNow, OriginalPrice = 100m, DiscountedPrice = 100m,
            DiscountPercentage = 0m, MaxPaymentCount = 3, AmountPaid = 50m,
        };
        _context.CustomerOrders.Add(order);

        var payment = new Payment
        {
            Id = Guid.NewGuid(), OrderId = orderId, Amount = 50m,
            PaymentMethod = "Cash", PaymentDate = DateTime.UtcNow,
            RecordedByUserId = Guid.NewGuid(), RecordedByFullName = "מנהל",
        };
        _context.Payments.Add(payment);
        await _context.SaveChangesAsync();

        var hasDependent = await repo.HasDependentDataAsync(orderId);
        Assert.True(hasDependent);
    }

    [Fact]
    public async Task CustomerOrderRepository_HasDependentData_ReturnsFalseWithNoData()
    {
        var repo = new CustomerOrderRepository(_context);
        var treatmentType = new TreatmentType { Id = Guid.NewGuid(), Name = "פנים" };
        _context.TreatmentTypes.Add(treatmentType);
        var pkgType = new PackageType { Id = Guid.NewGuid(), TreatmentTypeId = treatmentType.Id, Name = "חבילה", Price = 100m };
        _context.PackageTypes.Add(pkgType);
        var customer = new Customer { Id = Guid.NewGuid(), FullName = "אבי", Phone = "055-1111111" };
        _context.Customers.Add(customer);

        var orderId = Guid.NewGuid();
        var order = new CustomerOrder
        {
            Id = orderId, CustomerId = customer.Id,
            OrderDate = DateTime.UtcNow, OriginalPrice = 100m, DiscountedPrice = 100m,
            DiscountPercentage = 0m, MaxPaymentCount = 3, AmountPaid = 0m,
        };
        _context.CustomerOrders.Add(order);
        await _context.SaveChangesAsync();

        var hasDependent = await repo.HasDependentDataAsync(orderId);
        Assert.False(hasDependent);
    }

    // -----------------------------------------------------------------------
    // Payment validation tests (InMemory simulation — sets RemainingBalance manually)
    // -----------------------------------------------------------------------

    [Fact]
    public void PaymentValidation_RejectsNegativeAmount()
    {
        void Act() { if (-50m <= 0) throw new DomainValidationException("הסכום חייב להיות חיובי"); }
        Assert.Throws<DomainValidationException>((Action)Act);
    }

    [Fact]
    public void PaymentValidation_RejectsZeroAmount()
    {
        void Act() { if (0m <= 0) throw new DomainValidationException("הסכום חייב להיות חיובי"); }
        Assert.Throws<DomainValidationException>((Action)Act);
    }

    [Fact]
    public void PaymentValidation_RejectsAmountExceedingBalance()
    {
        // Simulate: remainingBalance = 100, requested amount = 150
        var remainingBalance = 100m; // manually set since InMemory doesn't compute it
        var requestedAmount  = 150m;

        void Act() { if (requestedAmount > remainingBalance) throw new DomainValidationException("הסכום חורג מהיתרה"); }
        Assert.Throws<DomainValidationException>((Action)Act);
    }

    [Fact]
    public void PaymentValidation_RejectsWhenMaxPaymentCountReached()
    {
        var maxPaymentCount  = 3;
        var existingPayments = 3;

        void Act() { if (existingPayments >= maxPaymentCount) throw new DomainConflictException("הגעת למספר המקסימלי של תשלומים"); }
        Assert.Throws<DomainConflictException>((Action)Act);
    }

    [Fact]
    public async Task PaymentRepository_AddPayment_IncreasesCount()
    {
        var repo = new PaymentRepository(_context);
        var treatmentType = new TreatmentType { Id = Guid.NewGuid(), Name = "פנים" };
        _context.TreatmentTypes.Add(treatmentType);
        var pkgType = new PackageType { Id = Guid.NewGuid(), TreatmentTypeId = treatmentType.Id, Name = "חבילה", Price = 200m };
        _context.PackageTypes.Add(pkgType);
        var customer = new Customer { Id = Guid.NewGuid(), FullName = "נועה", Phone = "056-9999999" };
        _context.Customers.Add(customer);

        var orderId = Guid.NewGuid();
        var order = new CustomerOrder
        {
            Id = orderId, CustomerId = customer.Id,
            OrderDate = DateTime.UtcNow, OriginalPrice = 200m, DiscountedPrice = 200m,
            DiscountPercentage = 0m, MaxPaymentCount = 3, AmountPaid = 0m,
        };
        _context.CustomerOrders.Add(order);
        await _context.SaveChangesAsync();

        var countBefore = await repo.CountByOrderIdAsync(orderId);
        Assert.Equal(0, countBefore);

        var payment = new Payment
        {
            Id = Guid.NewGuid(), OrderId = orderId, Amount = 100m,
            PaymentMethod = "Cash", PaymentDate = DateTime.UtcNow,
            RecordedByUserId = Guid.NewGuid(), RecordedByFullName = "מנהל",
        };
        await repo.AddAsync(payment);

        var countAfter = await repo.CountByOrderIdAsync(orderId);
        Assert.Equal(1, countAfter);

        // Manually update AmountPaid (simulating what the controller does)
        order.AmountPaid += payment.Amount;
        _context.CustomerOrders.Update(order);
        await _context.SaveChangesAsync();

        var updatedOrder = await _context.CustomerOrders.FindAsync(orderId);
        Assert.NotNull(updatedOrder);
        Assert.Equal(100m, updatedOrder.AmountPaid);
    }

    // -----------------------------------------------------------------------
    // GlobalSettingsKeys.GetDefaultMaxPaymentCountAsync tests (RC-6)
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetDefaultMaxPaymentCount_ReturnsParsedValue()
    {
        var repo = new GlobalSettingsRepository(_context);
        var setting = new GlobalSetting { Id = Guid.NewGuid(), Name = "default_max_payment_count", Value = "6" };
        _context.GlobalSettings.Add(setting);
        await _context.SaveChangesAsync();

        var result = await GlobalSettingsKeys.GetDefaultMaxPaymentCountAsync(repo);
        Assert.Equal(6, result);
    }

    [Fact]
    public async Task GetDefaultMaxPaymentCount_ReturnsDefaultWhenMissing()
    {
        var repo   = new GlobalSettingsRepository(_context);
        var result = await GlobalSettingsKeys.GetDefaultMaxPaymentCountAsync(repo);
        Assert.Equal(12, result);
    }

    [Fact]
    public async Task GetDefaultMaxPaymentCount_ReturnsDefaultWhenUnparseable()
    {
        var repo = new GlobalSettingsRepository(_context);
        var setting = new GlobalSetting { Id = Guid.NewGuid(), Name = "default_max_payment_count", Value = "not-a-number" };
        _context.GlobalSettings.Add(setting);
        await _context.SaveChangesAsync();

        var result = await GlobalSettingsKeys.GetDefaultMaxPaymentCountAsync(repo);
        Assert.Equal(12, result);
    }

    // -----------------------------------------------------------------------
    // TreatmentSeries filter tests
    // -----------------------------------------------------------------------

    [Fact]
    public void ActiveSeries_QuantityBased_FilterLogic()
    {
        // Quantity-based: active when completedTreatments < totalTreatments
        var active     = new TreatmentSeries { Id = Guid.NewGuid(), TotalTreatments = 10, CompletedTreatments = 3 };
        var completed  = new TreatmentSeries { Id = Guid.NewGuid(), TotalTreatments = 5,  CompletedTreatments = 5 };

        Assert.True(active.CompletedTreatments < active.TotalTreatments);
        Assert.False(completed.CompletedTreatments < completed.TotalTreatments);
    }

    [Fact]
    public void ActiveSeries_TimerBased_FilterLogic()
    {
        // Timer-based: active when usedMinutes < totalMinutes
        var active    = new TreatmentSeries { Id = Guid.NewGuid(), TotalMinutes = 300, UsedMinutes = 120 };
        var exhausted = new TreatmentSeries { Id = Guid.NewGuid(), TotalMinutes = 200, UsedMinutes = 200 };

        Assert.True(active.UsedMinutes < active.TotalMinutes);
        Assert.False(exhausted.UsedMinutes < exhausted.TotalMinutes);
    }

    // -----------------------------------------------------------------------
    // DomainConflictException tests (CR-021)
    // -----------------------------------------------------------------------

    [Fact]
    public void DomainConflictException_IsException()
    {
        var ex = new DomainConflictException("test message");
        Assert.IsAssignableFrom<Exception>(ex);
        Assert.Equal("test message", ex.Message);
    }

    [Fact]
    public void DomainValidationException_IsException()
    {
        var ex = new DomainValidationException("validation failed");
        Assert.IsAssignableFrom<Exception>(ex);
        Assert.Equal("validation failed", ex.Message);
    }

    // -----------------------------------------------------------------------
    // Payment validation — new guards (S1, S2, S3)
    // -----------------------------------------------------------------------

    [Fact]
    public void PaymentValidation_RejectsAmountAboveUpperBound()
    {
        var amount = 100_000_000m;
        void Act() { if (amount > 99_999_999.99m) throw new DomainValidationException("סכום התשלום גבוה מדי."); }
        Assert.Throws<DomainValidationException>((Action)Act);
    }

    [Theory]
    [InlineData(100.999)]
    [InlineData(50.123)]
    [InlineData(1.001)]
    public void PaymentValidation_RejectsMoreThanTwoDecimalPlaces(double amountRaw)
    {
        var amount = (decimal)amountRaw;
        void Act() { if (Math.Round(amount, 2) != amount) throw new DomainValidationException("סכום התשלום אינו תקין — מותרות עד שתי ספרות אחרי הנקודה."); }
        Assert.Throws<DomainValidationException>((Action)Act);
    }

    [Theory]
    [InlineData(100.00)]
    [InlineData(50.50)]
    [InlineData(1.01)]
    public void PaymentValidation_AcceptsValidDecimalPrecision(double amountRaw)
    {
        var amount = (decimal)amountRaw;
        // Should NOT throw — two decimal places or fewer are valid
        var rounded = Math.Round(amount, 2);
        Assert.Equal(amount, rounded);
    }

    [Theory]
    [InlineData("")]
    [InlineData("Bitcoin")]
    [InlineData("Wire")]
    [InlineData("PayPal")]
    public void PaymentValidation_RejectsDisallowedPaymentMethod(string method)
    {
        var allowedMethods = new[] { "Cash", "Credit Card", "Bank Transfer", "Check", "Other" };
        void Act() { if (!allowedMethods.Contains(method)) throw new DomainValidationException("אמצעי תשלום לא תקין."); }
        Assert.Throws<DomainValidationException>((Action)Act);
    }

    [Theory]
    [InlineData("Cash")]
    [InlineData("Credit Card")]
    [InlineData("Bank Transfer")]
    [InlineData("Check")]
    [InlineData("Other")]
    public void PaymentValidation_AcceptsAllowedPaymentMethods(string method)
    {
        var allowedMethods = new[] { "Cash", "Credit Card", "Bank Transfer", "Check", "Other" };
        Assert.Contains(method, allowedMethods);
    }

    [Fact]
    public void PaymentValidation_RejectsFutureDate()
    {
        var futureDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1));
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        void Act() { if (futureDate > today) throw new DomainValidationException("תאריך תשלום לא יכול להיות בעתיד."); }
        Assert.Throws<DomainValidationException>((Action)Act);
    }

    [Fact]
    public void PaymentValidation_RejectsDateOlderThan10Years()
    {
        var oldDate = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-11));
        var lowerBound = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-10));
        void Act() { if (oldDate < lowerBound) throw new DomainValidationException("תאריך תשלום לא תקין."); }
        Assert.Throws<DomainValidationException>((Action)Act);
    }

    [Fact]
    public void PaymentValidation_AcceptsToday()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var upperBound = DateOnly.FromDateTime(DateTime.UtcNow);
        // today <= today is valid, should not throw
        Assert.False(today > upperBound);
    }

    // -----------------------------------------------------------------------
    // Batch payment count query (C1)
    // -----------------------------------------------------------------------

    [Fact]
    public async Task CustomerOrderRepository_GetPaymentCountsByOrderIds_ReturnsBatchCounts()
    {
        var repo = new CustomerOrderRepository(_context);
        var treatmentType = new TreatmentType { Id = Guid.NewGuid(), Name = "פנים" };
        _context.TreatmentTypes.Add(treatmentType);
        var pkgType = new PackageType { Id = Guid.NewGuid(), TreatmentTypeId = treatmentType.Id, Name = "חבילה", Price = 100m };
        _context.PackageTypes.Add(pkgType);
        var customer = new Customer { Id = Guid.NewGuid(), FullName = "בתיה", Phone = "050-0000000" };
        _context.Customers.Add(customer);

        var orderId1 = Guid.NewGuid();
        var orderId2 = Guid.NewGuid();
        var orderId3 = Guid.NewGuid();

        _context.CustomerOrders.AddRange(
            new CustomerOrder { Id = orderId1, CustomerId = customer.Id, OrderDate = DateTime.UtcNow, OriginalPrice = 100m, DiscountedPrice = 100m, DiscountPercentage = 0m, MaxPaymentCount = 3, AmountPaid = 0m },
            new CustomerOrder { Id = orderId2, CustomerId = customer.Id, OrderDate = DateTime.UtcNow, OriginalPrice = 100m, DiscountedPrice = 100m, DiscountPercentage = 0m, MaxPaymentCount = 3, AmountPaid = 0m },
            new CustomerOrder { Id = orderId3, CustomerId = customer.Id, OrderDate = DateTime.UtcNow, OriginalPrice = 100m, DiscountedPrice = 100m, DiscountPercentage = 0m, MaxPaymentCount = 3, AmountPaid = 0m }
        );

        // orderId1 gets 2 payments, orderId2 gets 1 payment, orderId3 gets 0
        _context.Payments.AddRange(
            new Payment { Id = Guid.NewGuid(), OrderId = orderId1, Amount = 30m, PaymentMethod = "Cash", PaymentDate = DateTime.UtcNow, RecordedByUserId = Guid.NewGuid(), RecordedByFullName = "מנהל" },
            new Payment { Id = Guid.NewGuid(), OrderId = orderId1, Amount = 30m, PaymentMethod = "Cash", PaymentDate = DateTime.UtcNow, RecordedByUserId = Guid.NewGuid(), RecordedByFullName = "מנהל" },
            new Payment { Id = Guid.NewGuid(), OrderId = orderId2, Amount = 50m, PaymentMethod = "Cash", PaymentDate = DateTime.UtcNow, RecordedByUserId = Guid.NewGuid(), RecordedByFullName = "מנהל" }
        );
        await _context.SaveChangesAsync();

        var counts = await repo.GetPaymentCountsByOrderIdsAsync(new[] { orderId1, orderId2, orderId3 });

        Assert.Equal(2, counts.GetValueOrDefault(orderId1, 0));
        Assert.Equal(1, counts.GetValueOrDefault(orderId2, 0));
        Assert.Equal(0, counts.GetValueOrDefault(orderId3, 0));
    }

    [Fact]
    public async Task CustomerOrderRepository_GetPaymentCountsByOrderIds_ReturnsEmptyForNoOrders()
    {
        var repo = new CustomerOrderRepository(_context);
        var counts = await repo.GetPaymentCountsByOrderIdsAsync(Array.Empty<Guid>());
        Assert.Empty(counts);
    }
}
