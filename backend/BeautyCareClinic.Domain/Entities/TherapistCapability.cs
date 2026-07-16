namespace BeautyCareClinic.Domain.Entities;

public class TherapistCapability
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid TreatmentTypeId { get; set; }

    public User User { get; set; } = null!;
    public TreatmentType TreatmentType { get; set; } = null!;
}
