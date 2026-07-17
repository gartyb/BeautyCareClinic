namespace BeautyCareClinic.Domain.Entities;

public class OrderItem
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid PackageTypeId { get; set; }
    public decimal UnitPrice { get; set; }

    public CustomerOrder Order { get; set; } = null!;
    public PackageType PackageType { get; set; } = null!;
    public TreatmentSeries? TreatmentSeries { get; set; }
}
