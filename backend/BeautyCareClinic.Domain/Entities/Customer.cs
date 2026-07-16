namespace BeautyCareClinic.Domain.Entities;

public class Customer
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }

    public ICollection<CustomerOrder> Orders { get; set; } = new List<CustomerOrder>();
    public ICollection<Appointment> Appointments { get; set; } = new List<Appointment>();
    public ICollection<Treatment> Treatments { get; set; } = new List<Treatment>();
    public ICollection<Note> Notes { get; set; } = new List<Note>();
}
