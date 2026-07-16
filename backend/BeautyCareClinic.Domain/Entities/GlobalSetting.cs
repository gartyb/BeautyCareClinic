namespace BeautyCareClinic.Domain.Entities;

public class GlobalSetting
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
}
