using BeautyCareClinic.Api.Controllers;
using BeautyCareClinic.Application.DTOs;
using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Domain.Enums;
using BeautyCareClinic.Domain.Exceptions;
using BeautyCareClinic.Infrastructure.Data;
using BeautyCareClinic.Infrastructure.Identity;
using BeautyCareClinic.Infrastructure.Repositories;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;

namespace BeautyCareClinic.Tests.Integration;

/// <summary>
/// Phase 012 — real-controller coverage for <see cref="UsersController"/> against a real
/// Npgsql-backed <see cref="AppDbContext"/>, the same pattern used by
/// <see cref="AppointmentsControllerPostgresTests"/> / <see cref="NotesControllerPostgresTests"/>.
///
/// Covers: PUT /users/{id}/deactivate (Manager-only, targets-Therapist-only, already-inactive
/// rejection), GET /users?includeInactive= filtering, and the DELETE /users/{id} FK-restrict path
/// (Architecture Review remaining risk — must return a clean Hebrew 409, not a raw 500).
///
/// Requires a reachable Postgres instance via the ConnectionStrings__DefaultConnection env var
/// (same variable used by the EF CLI tooling — see DesignTimeDbContextFactory.cs).
/// </summary>
public class UsersControllerPostgresTests : IAsyncLifetime
{
    private ServiceProvider _provider = null!;
    private AppDbContext _context = null!;
    private UserManager<AppUser> _userManager = null!;
    private User _therapist = null!;
    private User _manager = null!;
    private readonly List<Guid> _createdUserIds = new();

    public async Task InitializeAsync()
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? throw new InvalidOperationException(
                "Set env var ConnectionStrings__DefaultConnection to a reachable Postgres instance " +
                "to run UsersControllerPostgresTests (same variable used by the EF CLI tooling — " +
                "see DesignTimeDbContextFactory.cs).");

        var services = new ServiceCollection();
        services.AddDbContext<AppDbContext>(o => o.UseNpgsql(connectionString));
        services.AddLogging();
        services.AddIdentity<AppUser, IdentityRole<Guid>>(options =>
            {
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireNonAlphanumeric = true;
                options.Password.RequiredLength = 8;
            })
            .AddEntityFrameworkStores<AppDbContext>()
            .AddDefaultTokenProviders();

        _provider = services.BuildServiceProvider();
        var scope = _provider.CreateScope();
        _context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        _userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();

        await _context.Database.MigrateAsync();

        _therapist = await CreateUserAsync("users-ctrl-therapist", UserRole.Therapist);
        _manager = await CreateUserAsync("users-ctrl-manager", UserRole.Manager);
    }

    public async Task DisposeAsync()
    {
        foreach (var userId in _createdUserIds)
        {
            var appUser = await _userManager.FindByIdAsync(userId.ToString());
            if (appUser != null) await _userManager.DeleteAsync(appUser);

            var domainUser = await _context.Users.FindAsync(userId);
            if (domainUser != null) _context.Users.Remove(domainUser);
        }
        await _context.SaveChangesAsync();
        await _context.DisposeAsync();
        await _provider.DisposeAsync();
    }

    private async Task<User> CreateUserAsync(string tag, UserRole role, bool isActive = true)
    {
        var id = Guid.NewGuid();
        var email = $"{tag}-{Guid.NewGuid():N}@test.com";
        var domainUser = new User { Id = id, FullName = "בדיקת משתמשים " + tag, Email = email, Role = role, IsActive = isActive };
        _context.Users.Add(domainUser);

        var appUser = new AppUser
        {
            Id = id, UserName = email, Email = email,
            NormalizedUserName = email.ToUpperInvariant(), NormalizedEmail = email.ToUpperInvariant(),
            EmailConfirmed = true,
        };
        var result = await _userManager.CreateAsync(appUser, "TestPass@2026");
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join(", ", result.Errors.Select(e => e.Description)));

        await _context.SaveChangesAsync();
        _createdUserIds.Add(id);
        return domainUser;
    }

    private UsersController BuildController(Guid currentUserId)
    {
        var userRepository = new UserRepository(_context);
        var currentUserMock = new Mock<ICurrentUserService>();
        currentUserMock.Setup(s => s.GetCurrentUserId()).Returns(currentUserId);

        var controller = new UsersController(userRepository, _userManager, _context, currentUserMock.Object);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        return controller;
    }

    // =========================================================================
    // Deactivate
    // =========================================================================

    [Fact]
    public async Task Deactivate_ExistingTherapist_SetsIsActiveFalse_AndPersists()
    {
        var target = await CreateUserAsync("deactivate-target", UserRole.Therapist);
        var controller = BuildController(_manager.Id);

        var result = await controller.Deactivate(target.Id);

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = Assert.IsType<UserDto>(ok.Value);
        Assert.False(dto.IsActive);

        var persisted = await _context.Users.AsNoTracking().SingleAsync(u => u.Id == target.Id);
        Assert.False(persisted.IsActive);
    }

    [Fact]
    public async Task Deactivate_AlreadyInactiveTherapist_ThrowsDomainValidationException()
    {
        var target = await CreateUserAsync("deactivate-twice", UserRole.Therapist, isActive: false);
        var controller = BuildController(_manager.Id);

        await Assert.ThrowsAsync<DomainValidationException>(() => controller.Deactivate(target.Id));
    }

    [Fact]
    public async Task Deactivate_TargetIsManager_ThrowsDomainValidationException()
    {
        var controller = BuildController(_manager.Id);

        await Assert.ThrowsAsync<DomainValidationException>(() => controller.Deactivate(_manager.Id));
    }

    [Fact]
    public async Task Deactivate_NonExistentUser_Returns404()
    {
        var controller = BuildController(_manager.Id);

        var result = await controller.Deactivate(Guid.NewGuid());

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal(404, notFound.StatusCode);
    }

    // =========================================================================
    // GET /users?includeInactive=
    // =========================================================================

    [Fact]
    public async Task GetAll_DefaultExcludesInactiveUsers_IncludeInactiveIncludesThem()
    {
        var inactiveUser = await CreateUserAsync("getall-inactive", UserRole.Therapist, isActive: false);
        var controller = BuildController(_manager.Id);

        var defaultResult = await controller.GetAll(role: "Therapist", includeInactive: false);
        var defaultOk = Assert.IsType<OkObjectResult>(defaultResult);
        var defaultDtos = Assert.IsAssignableFrom<IEnumerable<UserDto>>(defaultOk.Value);
        Assert.DoesNotContain(defaultDtos, d => d.Id == inactiveUser.Id);

        var includeResult = await controller.GetAll(role: "Therapist", includeInactive: true);
        var includeOk = Assert.IsType<OkObjectResult>(includeResult);
        var includeDtos = Assert.IsAssignableFrom<IEnumerable<UserDto>>(includeOk.Value);
        Assert.Contains(includeDtos, d => d.Id == inactiveUser.Id);
    }

    // =========================================================================
    // DELETE — FK-restrict path (Architecture Review remaining risk)
    // =========================================================================

    [Fact]
    public async Task Delete_UserWithAppointmentHistory_Returns409_NotRawServerError()
    {
        var target = await CreateUserAsync("delete-with-history", UserRole.Therapist);
        var customer = new Customer { Id = Guid.NewGuid(), FullName = "בדיקת מחיקת משתמש", Phone = "050-1112223" };
        var treatmentType = new TreatmentType { Id = Guid.NewGuid(), Name = "טיפול מחיקת משתמש " + Guid.NewGuid() };
        _context.Customers.Add(customer);
        _context.TreatmentTypes.Add(treatmentType);
        await _context.SaveChangesAsync();

        var appointment = new Appointment
        {
            Id = Guid.NewGuid(), CustomerId = customer.Id, TreatmentTypeId = treatmentType.Id, UserId = target.Id,
            StartTime = DateTime.SpecifyKind(DateTime.UtcNow.AddDays(5), DateTimeKind.Unspecified),
            EndTime = DateTime.SpecifyKind(DateTime.UtcNow.AddDays(5).AddHours(1), DateTimeKind.Unspecified),
            Status = AppointmentStatus.Scheduled, CreatedAt = DateTime.UtcNow, UserFullName = target.FullName,
        };
        _context.Appointments.Add(appointment);
        await _context.SaveChangesAsync();

        try
        {
            var controller = BuildController(_manager.Id);

            // Must throw DomainConflictException (middleware maps this to a clean 409 Hebrew
            // response) — NOT let a raw Npgsql FK-violation DbUpdateException propagate as a 500.
            await Assert.ThrowsAsync<DomainConflictException>(() => controller.Delete(target.Id));

            var stillExists = await _context.Users.AsNoTracking().AnyAsync(u => u.Id == target.Id);
            Assert.True(stillExists);
        }
        finally
        {
            _context.Appointments.Remove(appointment);
            await _context.SaveChangesAsync();
            _context.TreatmentTypes.Remove(treatmentType);
            _context.Customers.Remove(customer);
            await _context.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task Delete_UserWithNoRelatedData_Succeeds()
    {
        var target = await CreateUserAsync("delete-clean", UserRole.Therapist);
        var controller = BuildController(_manager.Id);

        var result = await controller.Delete(target.Id);

        Assert.IsType<NoContentResult>(result);
        _createdUserIds.Remove(target.Id); // already deleted — avoid double-cleanup in DisposeAsync

        var stillExists = await _context.Users.AsNoTracking().AnyAsync(u => u.Id == target.Id);
        Assert.False(stillExists);
    }

    [Fact]
    public async Task Delete_SelfDelete_ReturnsBadRequest()
    {
        var controller = BuildController(_manager.Id);

        var result = await controller.Delete(_manager.Id);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(400, badRequest.StatusCode);
    }
}
