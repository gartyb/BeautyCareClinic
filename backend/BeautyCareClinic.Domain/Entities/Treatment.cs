namespace BeautyCareClinic.Domain.Entities;

public class Treatment
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public Guid TreatmentTypeId { get; set; }
    public Guid UserId { get; set; }
    public Guid? TreatmentSeriesId { get; set; }
    public DateTime TreatmentDate { get; set; }
    public int DurationMinutes { get; set; }
    public string? Notes { get; set; }
    public string PerformedByFullName { get; set; } = string.Empty;

    public Customer Customer { get; set; } = null!;
    public TreatmentType TreatmentType { get; set; } = null!;
    public User User { get; set; } = null!;
    public TreatmentSeries? TreatmentSeries { get; set; }
    public ICollection<TreatmentPhoto> Photos { get; set; } = new List<TreatmentPhoto>();
}
