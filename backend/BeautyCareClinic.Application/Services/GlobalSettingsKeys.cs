namespace BeautyCareClinic.Application.Services;

public static class GlobalSettingsKeys
{
    public const string DefaultMaxPaymentCount = "default_max_payment_count";

    public static readonly HashSet<string> KnownKeys = new()
    {
        DefaultMaxPaymentCount
    };
}
