using BeautyCareClinic.Domain.Entities;

namespace BeautyCareClinic.Application.Interfaces;

public interface IPaymentRepository
{
    Task<List<Payment>> GetByOrderIdAsync(Guid orderId);
    Task<int> CountByOrderIdAsync(Guid orderId);
    Task<Payment> AddAsync(Payment payment);
}
