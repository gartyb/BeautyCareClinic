namespace BeautyCareClinic.Application.DTOs;

public record GlobalSettingDto(string Name, string Value);
public record UpdateGlobalSettingRequest(string Name, string Value);
