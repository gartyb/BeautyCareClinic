namespace BeautyCareClinic.Domain.Entities;

public class Note
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public Guid UserId { get; set; }
    public Guid? TreatmentTypeId { get; set; }
    public DateTime NoteDate { get; set; }
    public string Content { get; set; } = string.Empty;
    public string WrittenByFullName { get; set; } = string.Empty;

    public Customer Customer { get; set; } = null!;
    public User User { get; set; } = null!;
    public TreatmentType? TreatmentType { get; set; }
}
