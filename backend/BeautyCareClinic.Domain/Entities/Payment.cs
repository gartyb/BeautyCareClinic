namespace BeautyCareClinic.Domain.Entities;

public class Payment
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public decimal Amount { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
    public DateTime PaymentDate { get; set; }
    public Guid RecordedByUserId { get; set; }
    public string RecordedByFullName { get; set; } = string.Empty;

    public CustomerOrder Order { get; set; } = null!;
}
