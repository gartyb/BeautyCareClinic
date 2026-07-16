using BeautyCareClinic.Application.Services;
using Xunit;

namespace BeautyCareClinic.Tests.Application;

/// <summary>
/// Verifies that GlobalSettingsKeys contains the correct known keys.
/// Acceptance criterion: CR-001 resolved — single known key "default_max_payment_count".
/// </summary>
public class GlobalSettingsKeysTests
{
    [Fact]
    public void KnownKeys_ContainsDefaultMaxPaymentCount()
    {
        Assert.Contains("default_max_payment_count", GlobalSettingsKeys.KnownKeys);
    }

    [Fact]
    public void DefaultMaxPaymentCount_ConstantMatchesKnownKey()
    {
        Assert.Contains(GlobalSettingsKeys.DefaultMaxPaymentCount, GlobalSettingsKeys.KnownKeys);
    }

    [Fact]
    public void KnownKeys_IsNotEmpty()
    {
        Assert.NotEmpty(GlobalSettingsKeys.KnownKeys);
    }

    [Theory]
    [InlineData("unknown_key")]
    [InlineData("some_other_setting")]
    [InlineData("")]
    public void KnownKeys_DoesNotContainUnknownKeys(string key)
    {
        Assert.DoesNotContain(key, GlobalSettingsKeys.KnownKeys);
    }
}
