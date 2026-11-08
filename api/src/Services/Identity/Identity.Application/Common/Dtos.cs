using MediPath.Identity.Domain;

namespace MediPath.Identity.Application.Common;

public sealed record RegisterUserRequest(
    string? Email, string? Password, string? FirstName, string? LastName, string? DateOfBirth, string? AcceptedTermsVersion);

public sealed record LoginRequest(string? Email, string? Password);

public sealed record UserProfile(
    Guid Id, string Email, string FirstName, string LastName, IReadOnlyList<string> Roles, Guid? OrganisationId)
{
    public static UserProfile From(User u) => new(u.Id, u.Email, u.FirstName, u.LastName, u.Roles, u.OrganisationId);
}

/// <summary>Tokens for a signed-in user; the Api layer decides how the refresh token reaches the client.</summary>
public sealed record AuthSession(
    string AccessToken, DateTimeOffset AccessTokenExpiresAt, string RefreshToken, DateTimeOffset RefreshTokenExpiresAt, UserProfile User);

/// <summary>Success value for use cases that return nothing.</summary>
public sealed record Done
{
    public static readonly Done Value = new();
}
