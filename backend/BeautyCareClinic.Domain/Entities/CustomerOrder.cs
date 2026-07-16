namespace BeautyCareClinic.Domain.Entities;

public class CustomerOrder
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public DateTime OrderDate { get; set; }
    public decimal OriginalPrice { get; set; }
    public decimal DiscountedPrice { get; set; }
    public decimal DiscountPercentage { get; set; }
    public int MaxPaymentCount { get; set; }
    public decimal AmountPaid { get; set; }
    public decimal RemainingBalance { get; set; }

    public Customer Customer { get; set; } = null!;
    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
}
