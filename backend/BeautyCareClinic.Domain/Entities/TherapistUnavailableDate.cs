namespace BeautyCareClinic.Domain.Entities;

public class TherapistUnavailableDate
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public DateTime UnavailableDate { get; set; }

    public User User { get; set; } = null!;
}
