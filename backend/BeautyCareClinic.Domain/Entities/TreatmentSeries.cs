namespace BeautyCareClinic.Domain.Entities;

public class TreatmentSeries
{
    public Guid Id { get; set; }
    public Guid OrderItemId { get; set; }
    public Guid CustomerId { get; set; }
    public int TotalTreatments { get; set; }
    public int CompletedTreatments { get; set; }
    public int TotalMinutes { get; set; }
    public int UsedMinutes { get; set; }

    public OrderItem OrderItem { get; set; } = null!;
    public Customer Customer { get; set; } = null!;
    public ICollection<Treatment> Treatments { get; set; } = new List<Treatment>();
}
