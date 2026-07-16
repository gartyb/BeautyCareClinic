using BeautyCareClinic.Domain.Enums;

namespace BeautyCareClinic.Domain.Entities;

public class Appointment
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public Guid TreatmentTypeId { get; set; }
    public Guid UserId { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public AppointmentStatus Status { get; set; } = AppointmentStatus.Scheduled;
    public DateTime CreatedAt { get; set; }

    public Customer Customer { get; set; } = null!;
    public TreatmentType TreatmentType { get; set; } = null!;
    public User User { get; set; } = null!;
}
