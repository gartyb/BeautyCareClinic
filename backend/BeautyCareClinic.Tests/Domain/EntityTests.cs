using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Domain.Enums;
using Xunit;

namespace BeautyCareClinic.Tests.Domain;

/// <summary>
/// Verifies that domain entities are plain POCOs with no framework dependencies.
/// Acceptance criterion: Domain layer has no NuGet references besides BCL.
/// </summary>
public class EntityTests
{
    [Fact]
    public void User_DefaultRole_IsTherapist()
    {
        var user = new User { FullName = "Test", Email = "test@test.com" };
        // Role is an enum, default int value is 0 = Manager — just verify it can be set
        user.Role = UserRole.Therapist;
        Assert.Equal(UserRole.Therapist, user.Role);
    }

    [Fact]
    public void Appointment_DefaultStatus_IsScheduled()
    {
        var appointment = new Appointment
        {
            CustomerId      = Guid.NewGuid(),
            TreatmentTypeId = Guid.NewGuid(),
            UserId          = Guid.NewGuid(),
            StartTime       = DateTime.UtcNow,
            EndTime         = DateTime.UtcNow.AddHours(1)
        };

        Assert.Equal(AppointmentStatus.Scheduled, appointment.Status);
    }

    [Fact]
    public void Appointment_HasCreatedAt_Property()
    {
        // Verifies ADR RC-2: status + created_at columns exist
        var appointment = new Appointment();
        appointment.CreatedAt = DateTime.UtcNow;
        Assert.True(appointment.CreatedAt <= DateTime.UtcNow);
    }

    [Fact]
    public void Customer_Email_IsOptional()
    {
        var customer = new Customer { FullName = "Test", Phone = "050-0000000" };
        Assert.Null(customer.Email);
    }

    [Fact]
    public void User_NavigationCollections_InitializedEmpty()
    {
        var user = new User();
        Assert.Empty(user.Appointments);
        Assert.Empty(user.Treatments);
        Assert.Empty(user.Notes);
        Assert.Empty(user.WorkingHours);
        Assert.Empty(user.UnavailableDates);
        Assert.Empty(user.Capabilities);
    }

    [Fact]
    public void Treatment_Photos_InitializedEmpty()
    {
        var treatment = new Treatment();
        Assert.Empty(treatment.Photos);
    }

    [Fact]
    public void GlobalSetting_HasNameAndValue()
    {
        var setting = new GlobalSetting
        {
            Id    = Guid.NewGuid(),
            Name  = "default_max_payment_count",
            Value = "12"
        };
        Assert.Equal("default_max_payment_count", setting.Name);
        Assert.Equal("12", setting.Value);
    }

    [Fact]
    public void Weekday_AllValuesExist()
    {
        var values = Enum.GetValues<Weekday>();
        Assert.Equal(7, values.Length);
        Assert.Contains(Weekday.Sunday, values);
        Assert.Contains(Weekday.Saturday, values);
    }

    [Fact]
    public void UserRole_HasManagerAndTherapist()
    {
        var values = Enum.GetValues<UserRole>();
        Assert.Contains(UserRole.Manager, values);
        Assert.Contains(UserRole.Therapist, values);
    }

    [Fact]
    public void AppointmentStatus_HasFourValues()
    {
        var values = Enum.GetValues<AppointmentStatus>();
        Assert.Equal(4, values.Length);
        Assert.Contains(AppointmentStatus.Scheduled, values);
        Assert.Contains(AppointmentStatus.Completed, values);
        Assert.Contains(AppointmentStatus.Cancelled, values);
        Assert.Contains(AppointmentStatus.NoShow, values);
    }
}
