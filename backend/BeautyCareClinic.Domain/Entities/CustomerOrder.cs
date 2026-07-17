using System.ComponentModel.DataAnnotations.Schema;

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

    /// <summary>
    /// Computed by PostgreSQL as: discounted_price - amount_paid (STORED).
    /// Never set this property in C# — always reload via Entry(order).ReloadAsync() after SaveChangesAsync.
    /// </summary>
    [DatabaseGenerated(DatabaseGeneratedOption.Computed)]
    public decimal RemainingBalance { get; set; }

    public Customer Customer { get; set; } = null!;
    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
}
