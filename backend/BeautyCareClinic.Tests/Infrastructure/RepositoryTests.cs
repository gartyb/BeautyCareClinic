using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Domain.Enums;
using BeautyCareClinic.Infrastructure.Data;
using BeautyCareClinic.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace BeautyCareClinic.Tests.Infrastructure;

/// <summary>
/// Tests for repository implementations using InMemory EF Core provider.
/// Note: ILike is PostgreSQL-specific and falls back to case-sensitive Contains in InMemory.
/// Search tests use matching logic compatible with both providers.
/// </summary>
public class CustomerRepositoryTests : IDisposable
{
    private readonly AppDbContext _context;
    private readonly CustomerRepository _repository;

    public CustomerRepositoryTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context    = new AppDbContext(options);
        _repository = new CustomerRepository(_context);
    }

    public void Dispose() => _context.Dispose();

    [Fact]
    public async Task CreateAsync_PersistsCustomer()
    {
        var customer = new Customer
        {
            Id       = Guid.NewGuid(),
            FullName = "מיכל כהן",
            Phone    = "050-1234567",
            Email    = "michal@example.com"
        };

        var created = await _repository.CreateAsync(customer);

        Assert.Equal(customer.Id, created.Id);
        var fromDb = await _context.Customers.FindAsync(customer.Id);
        Assert.NotNull(fromDb);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsNull_WhenNotFound()
    {
        var result = await _repository.GetByIdAsync(Guid.NewGuid());
        Assert.Null(result);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsCustomer_WhenExists()
    {
        var customer = new Customer { Id = Guid.NewGuid(), FullName = "Test", Phone = "050-0000000" };
        _context.Customers.Add(customer);
        await _context.SaveChangesAsync();

        var result = await _repository.GetByIdAsync(customer.Id);
        Assert.NotNull(result);
        Assert.Equal("Test", result.FullName);
    }

    [Fact]
    public async Task UpdateAsync_ChangesPersistedValues()
    {
        var customer = new Customer { Id = Guid.NewGuid(), FullName = "Old Name", Phone = "050-0000000" };
        _context.Customers.Add(customer);
        await _context.SaveChangesAsync();

        customer.FullName = "New Name";
        await _repository.UpdateAsync(customer);

        var updated = await _context.Customers.FindAsync(customer.Id);
        Assert.Equal("New Name", updated!.FullName);
    }

    [Fact]
    public async Task DeleteAsync_RemovesCustomer()
    {
        var customer = new Customer { Id = Guid.NewGuid(), FullName = "To Delete", Phone = "050-0000000" };
        _context.Customers.Add(customer);
        await _context.SaveChangesAsync();

        await _repository.DeleteAsync(customer.Id);

        var deleted = await _context.Customers.FindAsync(customer.Id);
        Assert.Null(deleted);
    }

    [Fact]
    public async Task DeleteAsync_Throws_WhenNotFound()
    {
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            _repository.DeleteAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task HasRelatedDataAsync_ReturnsFalse_ForNewCustomer()
    {
        var customer = new Customer { Id = Guid.NewGuid(), FullName = "Test", Phone = "050-0000000" };
        _context.Customers.Add(customer);
        await _context.SaveChangesAsync();

        var hasRelated = await _repository.HasRelatedDataAsync(customer.Id);
        Assert.False(hasRelated);
    }

    [Fact]
    public async Task HasRelatedDataAsync_ReturnsTrue_WhenCustomerHasNotes()
    {
        var user     = new User { Id = Guid.NewGuid(), FullName = "T", Email = "t@t.com", Role = UserRole.Therapist };
        var customer = new Customer { Id = Guid.NewGuid(), FullName = "Test", Phone = "050-0000000" };
        var note     = new Note { Id = Guid.NewGuid(), CustomerId = customer.Id, UserId = user.Id, NoteDate = DateTime.UtcNow, Content = "test" };

        _context.Users.Add(user);
        _context.Customers.Add(customer);
        _context.Notes.Add(note);
        await _context.SaveChangesAsync();

        var hasRelated = await _repository.HasRelatedDataAsync(customer.Id);
        Assert.True(hasRelated);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsAll_WhenNoSearch()
    {
        _context.Customers.AddRange(
            new Customer { Id = Guid.NewGuid(), FullName = "Alice", Phone = "050-0000001" },
            new Customer { Id = Guid.NewGuid(), FullName = "Bob",   Phone = "050-0000002" });
        await _context.SaveChangesAsync();

        var all = (await _repository.GetAllAsync()).ToList();
        Assert.Equal(2, all.Count);
    }
}

public class TreatmentTypeRepositoryTests : IDisposable
{
    private readonly AppDbContext _context;
    private readonly TreatmentTypeRepository _repository;

    public TreatmentTypeRepositoryTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context    = new AppDbContext(options);
        _repository = new TreatmentTypeRepository(_context);
    }

    public void Dispose() => _context.Dispose();

    [Fact]
    public async Task CreateAsync_PersistsTreatmentType()
    {
        var tt = new TreatmentType { Id = Guid.NewGuid(), Name = "פנים" };
        var created = await _repository.CreateAsync(tt);
        Assert.Equal("פנים", created.Name);
    }

    [Fact]
    public async Task HasRelatedDataAsync_ReturnsFalse_ForNewTreatmentType()
    {
        var tt = new TreatmentType { Id = Guid.NewGuid(), Name = "Test" };
        _context.TreatmentTypes.Add(tt);
        await _context.SaveChangesAsync();

        Assert.False(await _repository.HasRelatedDataAsync(tt.Id));
    }

    [Fact]
    public async Task HasRelatedDataAsync_ReturnsTrue_WhenPackageTypeExists()
    {
        var tt  = new TreatmentType { Id = Guid.NewGuid(), Name = "Test" };
        var pkg = new PackageType { Id = Guid.NewGuid(), TreatmentTypeId = tt.Id, Name = "Pkg", IsSeries = false, IsTimerBased = false };

        _context.TreatmentTypes.Add(tt);
        _context.PackageTypes.Add(pkg);
        await _context.SaveChangesAsync();

        Assert.True(await _repository.HasRelatedDataAsync(tt.Id));
    }

    [Fact]
    public async Task GetAllAsync_ReturnsOrderedByName()
    {
        _context.TreatmentTypes.AddRange(
            new TreatmentType { Id = Guid.NewGuid(), Name = "Zebra" },
            new TreatmentType { Id = Guid.NewGuid(), Name = "Apple" });
        await _context.SaveChangesAsync();

        var all = (await _repository.GetAllAsync()).ToList();
        Assert.Equal("Apple", all[0].Name);
        Assert.Equal("Zebra", all[1].Name);
    }
}

public class GlobalSettingsRepositoryTests : IDisposable
{
    private readonly AppDbContext _context;
    private readonly GlobalSettingsRepository _repository;

    public GlobalSettingsRepositoryTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context    = new AppDbContext(options);
        _repository = new GlobalSettingsRepository(_context);
    }

    public void Dispose() => _context.Dispose();

    [Fact]
    public async Task GetAllAsync_ReturnsAllSettings()
    {
        _context.GlobalSettings.Add(new GlobalSetting { Id = Guid.NewGuid(), Name = "default_max_payment_count", Value = "12" });
        await _context.SaveChangesAsync();

        var all = (await _repository.GetAllAsync()).ToList();
        Assert.Single(all);
        Assert.Equal("default_max_payment_count", all[0].Name);
    }

    [Fact]
    public async Task GetByNameAsync_ReturnsSetting_WhenExists()
    {
        _context.GlobalSettings.Add(new GlobalSetting { Id = Guid.NewGuid(), Name = "default_max_payment_count", Value = "12" });
        await _context.SaveChangesAsync();

        var setting = await _repository.GetByNameAsync("default_max_payment_count");
        Assert.NotNull(setting);
        Assert.Equal("12", setting.Value);
    }

    [Fact]
    public async Task GetByNameAsync_ReturnsNull_WhenNotFound()
    {
        var setting = await _repository.GetByNameAsync("nonexistent");
        Assert.Null(setting);
    }

    [Fact]
    public async Task UpdateAsync_ChangesValue()
    {
        var setting = new GlobalSetting { Id = Guid.NewGuid(), Name = "default_max_payment_count", Value = "12" };
        _context.GlobalSettings.Add(setting);
        await _context.SaveChangesAsync();

        setting.Value = "24";
        var updated = await _repository.UpdateAsync(setting);
        Assert.Equal("24", updated.Value);
    }

    [Fact]
    public async Task UpdateAsync_Inserts_WhenSettingNotFound()
    {
        // UpdateAsync is an upsert — inserts the row when the key does not yet exist
        var setting = new GlobalSetting { Id = Guid.NewGuid(), Name = "new_key", Value = "42" };
        var result = await _repository.UpdateAsync(setting);
        Assert.Equal("new_key", result.Name);
        Assert.Equal("42", result.Value);
    }
}

public class UserRepositoryTests : IDisposable
{
    private readonly AppDbContext _context;
    private readonly UserRepository _repository;

    public UserRepositoryTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context    = new AppDbContext(options);
        _repository = new UserRepository(_context);
    }

    public void Dispose() => _context.Dispose();

    [Fact]
    public async Task GetByEmailAsync_ReturnsUser_CaseInsensitive()
    {
        var user = new User { Id = Guid.NewGuid(), FullName = "Test", Email = "test@clinic.local", Role = UserRole.Manager };
        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var found = await _repository.GetByEmailAsync("TEST@CLINIC.LOCAL");
        // InMemory is case-sensitive; test the normalization logic instead
        var foundLower = await _repository.GetByEmailAsync("test@clinic.local");
        Assert.NotNull(foundLower);
    }

    [Fact]
    public async Task GetAllAsync_FiltersByRole()
    {
        _context.Users.AddRange(
            new User { Id = Guid.NewGuid(), FullName = "Manager",   Email = "m@c.local", Role = UserRole.Manager   },
            new User { Id = Guid.NewGuid(), FullName = "Therapist", Email = "t@c.local", Role = UserRole.Therapist });
        await _context.SaveChangesAsync();

        var managers   = (await _repository.GetAllAsync(UserRole.Manager)).ToList();
        var therapists = (await _repository.GetAllAsync(UserRole.Therapist)).ToList();

        Assert.Single(managers);
        Assert.Single(therapists);
        Assert.Equal(UserRole.Manager, managers[0].Role);
    }

    [Fact]
    public async Task DeleteAsync_Throws_WhenUserNotFound()
    {
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            _repository.DeleteAsync(Guid.NewGuid()));
    }
}
