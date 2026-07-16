using BeautyCareClinic.Domain.Enums;

namespace BeautyCareClinic.Domain.Entities;

public class TherapistWorkingHours
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Weekday Weekday { get; set; }
    public string StartTime { get; set; } = string.Empty;  // "HH:mm"
    public string EndTime { get; set; } = string.Empty;    // "HH:mm"

    public User User { get; set; } = null!;
}
