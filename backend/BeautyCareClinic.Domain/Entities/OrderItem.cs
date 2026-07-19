namespace BeautyCareClinic.Domain.Entities;

public class OrderItem
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid PackageTypeId { get; set; }
    public decimal UnitPrice { get; set; }

    /// <summary>
    /// Stable per-customer package number, assigned once at order-creation time in purchase
    /// order (1, 2, 3, ...). Never reassigned — gaps are expected when packages complete or
    /// orders are deleted. See CR-031 / ADR for this feature.
    /// </summary>
    public int PackageNumber { get; set; }

    public CustomerOrder Order { get; set; } = null!;
    public PackageType PackageType { get; set; } = null!;
    public TreatmentSeries? TreatmentSeries { get; set; }
}
