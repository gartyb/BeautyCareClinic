namespace BeautyCareClinic.Domain.Entities;

public class PackageType
{
    public Guid Id { get; set; }
    public Guid TreatmentTypeId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public bool IsSeries { get; set; }
    public bool IsTimerBased { get; set; }
    public int? TreatmentCount { get; set; }
    public int? MinutesPerTreatment { get; set; }

    public TreatmentType TreatmentType { get; set; } = null!;
    public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
}
