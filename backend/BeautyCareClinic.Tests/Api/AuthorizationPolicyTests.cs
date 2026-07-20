using BeautyCareClinic.Api.Controllers;
using Microsoft.AspNetCore.Authorization;
using Xunit;

namespace BeautyCareClinic.Tests.Api;

/// <summary>
/// Bugfix regression coverage: the appointment-booking therapist picker (frontend) was calling
/// GET /api/v1/users?role=Therapist, which 403'd for a Therapist-role caller because
/// UsersController is [Authorize(Policy = "Manager")] at the class level for ALL actions. The fix
/// adds a narrow, name+id-only GET /api/v1/therapists endpoint on TherapistAvailabilityController
/// that is NOT Manager-gated, instead of relaxing UsersController (whose UserDto carries PII).
///
/// This suite asserts the class-level [Authorize] attributes directly via reflection — this
/// codebase's controller tests (see e.g. TherapistAvailabilityControllerPostgresTests.cs)
/// instantiate controllers directly rather than through a full WebApplicationFactory/JWT pipeline,
/// so attribute-level assertions are the equivalent "does this endpoint require the Manager
/// policy" check at this test tier. End-to-end proof that a real Therapist JWT gets 200 is done
/// via live verification against the running dev backend (see PROGRESS.txt).
/// </summary>
public class AuthorizationPolicyTests
{
    [Fact]
    public void TherapistAvailabilityController_IsAuthorizeOnly_NotManagerGated()
    {
        // Proves the new GET /api/v1/therapists (and existing /availability) endpoints are
        // reachable by any authenticated user — Manager or Therapist — not just Managers.
        var attr = Assert.Single(
            typeof(TherapistAvailabilityController).GetCustomAttributes(typeof(AuthorizeAttribute), inherit: false));
        var authorize = Assert.IsType<AuthorizeAttribute>(attr);
        Assert.Null(authorize.Policy);
        Assert.Null(authorize.Roles);
    }

    [Fact]
    public void UsersController_StaysManagerGated_Unaffected()
    {
        // Regression check: this bugfix must not relax UsersController's existing Manager-only
        // authorization (its UserDto carries email/phone — real PII — for every user).
        var attr = Assert.Single(
            typeof(UsersController).GetCustomAttributes(typeof(AuthorizeAttribute), inherit: false));
        var authorize = Assert.IsType<AuthorizeAttribute>(attr);
        Assert.Equal("Manager", authorize.Policy);
    }
}
