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
/// Regression coverage for the "creating a treatment note always returns 500" bug
/// (fixed 2026-07-19).
///
/// Root cause: <c>Note.NoteDate</c> is mapped to a Postgres <c>timestamp with time zone</c>
/// column. <see cref="NotesController.Create"/> (and <see cref="NotesController.Update"/>) built
/// the value with <c>noteDate.ToDateTime(TimeOnly.MinValue)</c> — no <see cref="DateTimeKind"/>
/// argument — which produces a <see cref="DateTime"/> with <c>Kind=Unspecified</c>. Npgsql
/// refuses to write <c>Kind=Unspecified</c> values into a <c>timestamptz</c> column and throws
/// <see cref="ArgumentException"/> at SaveChanges time.
///
/// This class of bug is invisible to the EF InMemory provider (see Phase010Tests.cs). Only a
/// test that writes through a real Npgsql connection can reproduce it — same pattern as
/// <see cref="CustomerOrdersControllerPostgresTests"/> (FU-017).
///
/// Requires a reachable Postgres instance via the ConnectionStrings__DefaultConnection env var
/// (same variable used by the EF CLI tooling — see DesignTimeDbContextFactory.cs).
/// </summary>
public class NotesControllerPostgresTests : IAsyncLifetime
{
    private string _connectionString = null!;
    private AppDbContext _context = null!;
    private Customer _customer = null!;
    private User _user = null!;
    private Guid _createdNoteId;

    public async Task InitializeAsync()
    {
        _connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? throw new InvalidOperationException(
                "Set env var ConnectionStrings__DefaultConnection to a reachable Postgres instance " +
                "to run NotesControllerPostgresTests (same variable used by the EF CLI tooling — " +
                "see DesignTimeDbContextFactory.cs).");

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(_connectionString)
            .Options;
        _context = new AppDbContext(options);

        // Ensure the schema really reflects every committed migration.
        await _context.Database.MigrateAsync();

        // Self-contained seed data — created and torn down by this test only.
        _customer = new Customer { Id = Guid.NewGuid(), FullName = "בדיקת הערה", Phone = "050-5556666" };
        _user = new User
        {
            Id = Guid.NewGuid(),
            FullName = "מטפלת בדיקת הערה",
            Email = $"note-test-{Guid.NewGuid():N}@test.com",
            Role = UserRole.Therapist,
        };

        _context.Customers.Add(_customer);
        _context.Users.Add(_user);
        await _context.SaveChangesAsync();
    }

    public async Task DisposeAsync()
    {
        if (_createdNoteId != Guid.Empty)
        {
            var note = await _context.Notes.FindAsync(_createdNoteId);
            if (note != null)
                _context.Notes.Remove(note);
        }

        var user = await _context.Users.FindAsync(_user.Id);
        if (user != null)
            _context.Users.Remove(user);

        _context.Customers.Remove(_customer);
        await _context.SaveChangesAsync();
        await _context.DisposeAsync();
    }

    [Fact]
    public async Task Create_WritesNoteDateToRealPostgres_AndReturns201()
    {
        var customerRepository = new CustomerRepository(_context);
        var treatmentTypeRepository = new TreatmentTypeRepository(_context);
        var noteRepository = new NoteRepository(_context);
        var userRepository = new UserRepository(_context);

        var currentUserMock = new Mock<ICurrentUserService>();
        currentUserMock.Setup(s => s.GetCurrentUserId()).Returns(_user.Id);
        currentUserMock.Setup(s => s.IsManager()).Returns(false);

        var controller = new NotesController(
            customerRepository, treatmentTypeRepository, noteRepository, userRepository, currentUserMock.Object);

        var noteDate = DateOnly.FromDateTime(DateTime.UtcNow);
        var request = new CreateNoteRequest(
            TreatmentTypeId: null,
            NoteDate: noteDate,
            Content: "הערת בדיקה לרגרסיה");

        // Before the fix, this call throws System.ArgumentException ("Cannot write DateTime with
        // Kind=Unspecified to PostgreSQL type 'timestamp with time zone'") from inside
        // SaveChangesAsync — i.e. it never reaches CreatedAtActionResult.
        var result = await controller.Create(_customer.Id, request);

        var created = Assert.IsType<CreatedAtActionResult>(result);
        Assert.Equal(201, created.StatusCode);

        var dto = Assert.IsType<NoteDto>(created.Value);
        _createdNoteId = dto.Id;
        Assert.Equal("הערת בדיקה לרגרסיה", dto.Content);
        Assert.Equal(noteDate, dto.NoteDate);

        // Read back directly from Postgres, bypassing the change tracker, to prove the row (and
        // its timestamptz column) really persisted.
        var persisted = await _context.Notes
            .AsNoTracking()
            .SingleAsync(n => n.Id == dto.Id);

        Assert.Equal(_customer.Id, persisted.CustomerId);
        Assert.Equal(noteDate, DateOnly.FromDateTime(persisted.NoteDate));
    }

    [Fact]
    public async Task Update_WritesNoteDateToRealPostgres_AndReturns200()
    {
        var customerRepository = new CustomerRepository(_context);
        var treatmentTypeRepository = new TreatmentTypeRepository(_context);
        var noteRepository = new NoteRepository(_context);
        var userRepository = new UserRepository(_context);

        var currentUserMock = new Mock<ICurrentUserService>();
        currentUserMock.Setup(s => s.GetCurrentUserId()).Returns(_user.Id);
        currentUserMock.Setup(s => s.IsManager()).Returns(false);

        var controller = new NotesController(
            customerRepository, treatmentTypeRepository, noteRepository, userRepository, currentUserMock.Object);

        // Create the note first, via the same path exercised above.
        var originalNoteDate = DateOnly.FromDateTime(DateTime.UtcNow);
        var createRequest = new CreateNoteRequest(
            TreatmentTypeId: null,
            NoteDate: originalNoteDate,
            Content: "הערת בדיקה לפני עדכון");

        var createResult = await controller.Create(_customer.Id, createRequest);
        var created = Assert.IsType<CreatedAtActionResult>(createResult);
        var createdDto = Assert.IsType<NoteDto>(created.Value);
        _createdNoteId = createdDto.Id;

        // Before the fix, this call throws System.ArgumentException ("Cannot write DateTime with
        // Kind=Unspecified to PostgreSQL type 'timestamp with time zone'") from inside
        // SaveChangesAsync — i.e. it never reaches OkObjectResult.
        var updatedNoteDate = originalNoteDate.AddDays(-1);
        var updateRequest = new UpdateNoteRequest(
            TreatmentTypeId: null,
            NoteDate: updatedNoteDate,
            Content: "הערת בדיקה אחרי עדכון");

        var updateResult = await controller.Update(_createdNoteId, updateRequest);

        var ok = Assert.IsType<OkObjectResult>(updateResult);
        Assert.Equal(200, ok.StatusCode);

        var dto = Assert.IsType<NoteDto>(ok.Value);
        Assert.Equal("הערת בדיקה אחרי עדכון", dto.Content);
        Assert.Equal(updatedNoteDate, dto.NoteDate);

        // Read back directly from Postgres, bypassing the change tracker, to prove the row (and
        // its timestamptz column) really persisted.
        var persisted = await _context.Notes
            .AsNoTracking()
            .SingleAsync(n => n.Id == _createdNoteId);

        Assert.Equal(_customer.Id, persisted.CustomerId);
        Assert.Equal(updatedNoteDate, DateOnly.FromDateTime(persisted.NoteDate));
    }
}
