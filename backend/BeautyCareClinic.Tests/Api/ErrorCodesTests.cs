using BeautyCareClinic.Api;
using Xunit;

namespace BeautyCareClinic.Tests.Api;

/// <summary>
/// Verifies ErrorCodes constants match the documented values.
/// </summary>
public class ErrorCodesTests
{
    [Fact]
    public void ValidationFailed_HasCorrectValue()
        => Assert.Equal("VALIDATION_FAILED", ErrorCodes.ValidationFailed);

    [Fact]
    public void NotFound_HasCorrectValue()
        => Assert.Equal("NOT_FOUND", ErrorCodes.NotFound);

    [Fact]
    public void Unauthorized_HasCorrectValue()
        => Assert.Equal("UNAUTHORIZED", ErrorCodes.Unauthorized);

    [Fact]
    public void Forbidden_HasCorrectValue()
        => Assert.Equal("FORBIDDEN", ErrorCodes.Forbidden);

    [Fact]
    public void Conflict_HasCorrectValue()
        => Assert.Equal("CONFLICT", ErrorCodes.Conflict);

    [Fact]
    public void InternalError_HasCorrectValue()
        => Assert.Equal("INTERNAL_ERROR", ErrorCodes.InternalError);

    [Fact]
    public void AccountLocked_HasCorrectValue()
        => Assert.Equal("ACCOUNT_LOCKED", ErrorCodes.AccountLocked);
}
