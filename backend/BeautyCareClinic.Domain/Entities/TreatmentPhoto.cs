namespace BeautyCareClinic.Domain.Entities;

public class TreatmentPhoto
{
    public Guid Id { get; set; }
    public Guid TreatmentId { get; set; }
    public string ImageUrl { get; set; } = string.Empty;

    public Treatment Treatment { get; set; } = null!;
}
