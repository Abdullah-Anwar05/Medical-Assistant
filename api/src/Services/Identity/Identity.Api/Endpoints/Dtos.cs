using System.Text.Json.Serialization;
using MediPath.Identity.Application.Common;

namespace MediPath.Identity.Api.Endpoints;

public sealed record RefreshRequest(string? RefreshToken);

/// <summary>Wire shape from contracts/identity-v1.md. The refresh token is omitted for web clients (it goes in a cookie).</summary>
public sealed record AuthResponse(
    string AccessToken,
    DateTimeOffset AccessTokenExpiresAt,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? RefreshToken,
    UserProfile User);
