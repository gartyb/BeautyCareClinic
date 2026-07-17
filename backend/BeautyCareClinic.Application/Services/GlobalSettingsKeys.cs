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
}
