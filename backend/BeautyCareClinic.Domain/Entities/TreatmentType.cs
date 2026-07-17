namespace BeautyCareClinic.Domain.Entities;

public class TreatmentType
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int? DefaultDurationMinutes { get; set; }

    public ICollection<PackageType> PackageTypes { get; set; } = new List<PackageType>();
    public ICollection<Appointment> Appointments { get; set; } = new List<Appointment>();
    public ICollection<Treatment> Treatments { get; set; } = new List<Treatment>();
    public ICollection<Note> Notes { get; set; } = new List<Note>();
    public ICollection<TherapistCapability> TherapistCapabilities { get; set; } = new List<TherapistCapability>();
}
