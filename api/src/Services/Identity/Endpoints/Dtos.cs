using System.Text.Json.Serialization;

namespace MediPath.Identity.Endpoints;

public sealed record RegisterRequest(
    string? Email, string? Password, string? FirstName, string? LastName, string? DateOfBirth, string? AcceptedTermsVersion);

public sealed record LoginRequest(string? Email, string? Password);

public sealed record RefreshRequest(string? RefreshToken);

public sealed record UserProfile(
    Guid Id, string Email, string FirstName, string LastName, IReadOnlyList<string> Roles, Guid? OrganisationId);

public sealed record AuthResponse(
    string AccessToken,
    DateTimeOffset AccessTokenExpiresAt,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? RefreshToken,
    UserProfile User);
