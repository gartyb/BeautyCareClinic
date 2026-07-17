using BeautyCareClinic.Domain.Enums;

namespace BeautyCareClinic.Domain.Entities;

public class User
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public string? Phone { get; set; }

    // Navigation
    public ICollection<Appointment> Appointments { get; set; } = new List<Appointment>();
    public ICollection<Treatment> Treatments { get; set; } = new List<Treatment>();
    public ICollection<Note> Notes { get; set; } = new List<Note>();
    public ICollection<TherapistWorkingHours> WorkingHours { get; set; } = new List<TherapistWorkingHours>();
    public ICollection<TherapistUnavailableDate> UnavailableDates { get; set; } = new List<TherapistUnavailableDate>();
    public ICollection<TherapistCapability> Capabilities { get; set; } = new List<TherapistCapability>();
}
