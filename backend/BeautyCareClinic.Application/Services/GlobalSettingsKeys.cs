using BeautyCareClinic.Application.Interfaces;

namespace BeautyCareClinic.Application.Services;

public static class GlobalSettingsKeys
{
    public const string DefaultMaxPaymentCount = "default_max_payment_count";
    public const string CalendarStartHour      = "calendar_start_hour";
    public const string CalendarEndHour        = "calendar_end_hour";

    public static readonly HashSet<string> KnownKeys = new()
    {
        DefaultMaxPaymentCount,
        CalendarStartHour,
        CalendarEndHour,
    };

    /// <summary>
    /// Reads the default_max_payment_count setting and parses it as int.
    /// Returns 12 if the setting is missing or cannot be parsed (RC-6).
    /// </summary>
    public static async Task<int> GetDefaultMaxPaymentCountAsync(IGlobalSettingsRepository repo)
    {
        var setting = await repo.GetByNameAsync(DefaultMaxPaymentCount);
        if (setting == null || !int.TryParse(setting.Value, out var val) || val < 1)
            return 12;
        return val;
    }
}
