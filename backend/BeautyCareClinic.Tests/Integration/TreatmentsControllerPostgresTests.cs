using BeautyCareClinic.Api.Controllers;
using BeautyCareClinic.Application.DTOs;
using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Domain.Enums;
using BeautyCareClinic.Domain.Exceptions;
using BeautyCareClinic.Infrastructure.Data;
using BeautyCareClinic.Infrastructure.Repositories;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace BeautyCareClinic.Tests.Integration;

/// <summary>
/// Real-controller coverage for <see cref="TreatmentsController.Update"/> (PUT
/// /api/v1/treatments/{id}), added during code review of the "edit treatment note" feature.
///
/// The unit tests in Phase010Tests.cs re-implemented the controller's authorization/length-check
/// logic locally as plain booleans/strings and never actually called the controller action — they
/// would not catch a missing [Authorize] attribute, a wrong route template, an inverted
/// &amp;&amp;/|| in the ownership check, or a broken guard in the real code. These tests invoke
/// <see cref="TreatmentsController.Update"/> directly against a real Npgsql-backed
/// <see cref="AppDbContext"/>, the same pattern already used by
/// <see cref="NotesControllerPostgresTests"/> and <see cref="PaymentsControllerPostgresTests"/>.
///
/// Requires a reachable Postgres instance via the ConnectionStrings__DefaultConnection env var
/// (same variable used by the EF CLI tooling — see DesignTimeDbContextFactory.cs).
/// </summary>
public class TreatmentsControllerPostgresTests : IAsyncLifetime
{
    private string _connectionString = null!;
    private AppDbContext _context = null!;
    private Customer _customer = null!;
    private TreatmentType _treatmentType = null!;
    private User _author = null!;
    private User _otherTherapist = null!;
    private User _manager = null!;
    private readonly List<Guid> _createdTreatmentIds = new();

    public async Task InitializeAsync()
    {
        _connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? throw new InvalidOperationException(
                "Set env var ConnectionStrings__DefaultConnection to a reachable Postgres instance " +
                "to run TreatmentsControllerPostgresTests (same variable used by the EF CLI tooling — " +
                "see DesignTimeDbContextFactory.cs).");

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(_connectionString)
            .Options;
        _context = new AppDbContext(options);

        // Ensure the schema really reflects every committed migration.
        await _context.Database.MigrateAsync();

        // Self-contained seed data — created and torn down by this test class only.
        _customer = new Customer { Id = Guid.NewGuid(), FullName = "בדיקת עדכון טיפול", Phone = "050-7778888" };
        _treatmentType = new TreatmentType { Id = Guid.NewGuid(), Name = "טיפול בדיקת עדכון" };
        _author = new User
        {
            Id = Guid.NewGuid(),
            FullName = "מטפלת מחברת הטיפול",
            Email = $"treatment-author-{Guid.NewGuid():N}@test.com",
            Role = UserRole.Therapist,
        };
        _otherTherapist = new User
        {
            Id = Guid.NewGuid(),
            FullName = "מטפלת אחרת",
            Email = $"treatment-other-{Guid.NewGuid():N}@test.com",
            Role = UserRole.Therapist,
        };
        _manager = new User
        {
            Id = Guid.NewGuid(),
            FullName = "מנהלת בדיקה",
            Email = $"treatment-manager-{Guid.NewGuid():N}@test.com",
            Role = UserRole.Manager,
        };

        _context.Customers.Add(_customer);
        _context.TreatmentTypes.Add(_treatmentType);
        _context.Users.AddRange(_author, _otherTherapist, _manager);
        await _context.SaveChangesAsync();
    }

    public async Task DisposeAsync()
    {
        foreach (var id in _createdTreatmentIds)
        {
            var treatment = await _context.Treatments.FindAsync(id);
            if (treatment != null)
                _context.Treatments.Remove(treatment);
        }
        await _context.SaveChangesAsync();

        foreach (var user in new[] { _author, _otherTherapist, _manager })
        {
            var tracked = await _context.Users.FindAsync(user.Id);
            if (tracked != null)
                _context.Users.Remove(tracked);
        }

        _context.TreatmentTypes.Remove(_treatmentType);
        _context.Customers.Remove(_customer);
        await _context.SaveChangesAsync();
        await _context.DisposeAsync();
    }

    private TreatmentsController BuildController(Guid currentUserId, bool isManager)
    {
        var customerRepository = new CustomerRepository(_context);
        var treatmentTypeRepository = new TreatmentTypeRepository(_context);
        var treatmentRepository = new TreatmentRepository(_context);
        var userRepository = new UserRepository(_context);

        var currentUserMock = new Mock<ICurrentUserService>();
        currentUserMock.Setup(s => s.GetCurrentUserId()).Returns(currentUserId);
        currentUserMock.Setup(s => s.IsManager()).Returns(isManager);

        var controller = new TreatmentsController(
            customerRepository, treatmentTypeRepository, treatmentRepository, userRepository,
            currentUserMock.Object, _context);

        // The controller's NotFound/Forbid branches read HttpContext.TraceIdentifier for the
        // ErrorResponse payload — a real HttpContext must be attached, same as ASP.NET Core would
        // do for an incoming request, otherwise ControllerBase.HttpContext is null.
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext(),
        };

        return controller;
    }

    private async Task<Treatment> CreateTreatmentAsAuthor(string? notes = "הערה מקורית")
    {
        var controller = BuildController(_author.Id, isManager: false);
        var request = new CreateTreatmentRequest(
            TreatmentTypeId: _treatmentType.Id,
            TreatmentSeriesId: null,
            TreatmentDate: DateOnly.FromDateTime(DateTime.UtcNow),
            DurationMinutes: 30,
            Notes: notes);

        var result = await controller.Create(_customer.Id, request);
        var created = Assert.IsType<CreatedAtActionResult>(result);
        var dto = Assert.IsType<TreatmentDto>(created.Value);
        _createdTreatmentIds.Add(dto.Id);

        return (await _context.Treatments.AsNoTracking().SingleAsync(t => t.Id == dto.Id));
    }

    [Fact]
    public async Task Update_ByAuthor_UpdatesNotes_AndPersists()
    {
        var treatment = await CreateTreatmentAsAuthor();

        var controller = BuildController(_author.Id, isManager: false);
        var updateRequest = new UpdateTreatmentRequest("הערה מעודכנת ע\"י המחברת");

        var result = await controller.Update(treatment.Id, updateRequest);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(200, ok.StatusCode);
        var dto = Assert.IsType<TreatmentDto>(ok.Value);
        Assert.Equal("הערה מעודכנת ע\"י המחברת", dto.Notes);

        var persisted = await _context.Treatments.AsNoTracking().SingleAsync(t => t.Id == treatment.Id);
        Assert.Equal("הערה מעודכנת ע\"י המחברת", persisted.Notes);
    }

    [Fact]
    public async Task Update_ByManager_ForAnotherTherapistsTreatment_UpdatesNotes_AndPersists()
    {
        var treatment = await CreateTreatmentAsAuthor();

        var controller = BuildController(_manager.Id, isManager: true);
        var updateRequest = new UpdateTreatmentRequest("הערה מעודכנת ע\"י מנהלת");

        var result = await controller.Update(treatment.Id, updateRequest);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(200, ok.StatusCode);
        var dto = Assert.IsType<TreatmentDto>(ok.Value);
        Assert.Equal("הערה מעודכנת ע\"י מנהלת", dto.Notes);

        var persisted = await _context.Treatments.AsNoTracking().SingleAsync(t => t.Id == treatment.Id);
        Assert.Equal("הערה מעודכנת ע\"י מנהלת", persisted.Notes);
    }

    [Fact]
    public async Task Update_ByDifferentNonManagerTherapist_Returns403_AndDoesNotPersist()
    {
        var treatment = await CreateTreatmentAsAuthor();

        var controller = BuildController(_otherTherapist.Id, isManager: false);
        var updateRequest = new UpdateTreatmentRequest("ניסיון עדכון לא מורשה");

        var result = await controller.Update(treatment.Id, updateRequest);

        var forbidden = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, forbidden.StatusCode);

        var persisted = await _context.Treatments.AsNoTracking().SingleAsync(t => t.Id == treatment.Id);
        Assert.Equal("הערה מקורית", persisted.Notes);
    }

    [Fact]
    public async Task Update_NotesExceeds5000Chars_ThrowsDomainValidationException_AndDoesNotPersist()
    {
        var treatment = await CreateTreatmentAsAuthor();

        var controller = BuildController(_author.Id, isManager: false);
        var longNotes = new string('א', 5001);
        var updateRequest = new UpdateTreatmentRequest(longNotes);

        await Assert.ThrowsAsync<DomainValidationException>(() => controller.Update(treatment.Id, updateRequest));

        var persisted = await _context.Treatments.AsNoTracking().SingleAsync(t => t.Id == treatment.Id);
        Assert.Equal("הערה מקורית", persisted.Notes);
    }

    [Fact]
    public async Task Update_NullNotes_ClearsExistingNote_AndPersists()
    {
        var treatment = await CreateTreatmentAsAuthor(notes: "הערה שתימחק");

        var controller = BuildController(_author.Id, isManager: false);
        var updateRequest = new UpdateTreatmentRequest(null);

        var result = await controller.Update(treatment.Id, updateRequest);

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = Assert.IsType<TreatmentDto>(ok.Value);
        Assert.Null(dto.Notes);

        var persisted = await _context.Treatments.AsNoTracking().SingleAsync(t => t.Id == treatment.Id);
        Assert.Null(persisted.Notes);
    }

    [Fact]
    public async Task Update_NonExistentTreatment_Returns404()
    {
        var controller = BuildController(_author.Id, isManager: false);
        var updateRequest = new UpdateTreatmentRequest("לא רלוונטי");

        var result = await controller.Update(Guid.NewGuid(), updateRequest);

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal(404, notFound.StatusCode);
    }
}
