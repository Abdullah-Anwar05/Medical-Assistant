using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using MediPath.BuildingBlocks.Auth;
using MediPath.Identity.Domain;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace MediPath.Identity.Security;

public sealed class TokenService(IOptions<JwtOptions> options, TimeProvider clock)
{
    private readonly JwtOptions _o = options.Value;
    private readonly JsonWebTokenHandler _handler = new();

    public (string Token, DateTimeOffset ExpiresAt) CreateAccessToken(User user)
    {
        var now = clock.GetUtcNow();
        var expires = now.AddMinutes(_o.AccessTokenMinutes);
        var identity = new ClaimsIdentity();
        identity.AddClaim(new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()));
        identity.AddClaim(new Claim(JwtRegisteredClaimNames.Email, user.Email));
        identity.AddClaim(new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()));
        foreach (var role in user.Roles)
            identity.AddClaim(new Claim(JwtServiceCollectionExtensions.RoleClaim, role));
        if (user.OrganisationId is { } org)
            identity.AddClaim(new Claim(JwtServiceCollectionExtensions.OrganisationClaim, org.ToString()));

        var token = _handler.CreateToken(new SecurityTokenDescriptor
        {
            Subject = identity,
            Issuer = _o.Issuer,
            Audience = _o.Audience,
            IssuedAt = now.UtcDateTime,
            NotBefore = now.UtcDateTime,
            Expires = expires.UtcDateTime,
            SigningCredentials = new SigningCredentials(JwtServiceCollectionExtensions.CreateKey(_o), SecurityAlgorithms.HmacSha256),
        });
        return (token, expires);
    }

    /// <summary>Creates a new opaque refresh token. The plaintext is returned once; only the hash is persisted.</summary>
    public (string Plaintext, RefreshToken Entity) CreateRefreshToken(Guid userId, Guid familyId)
    {
        var plaintext = Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(48));
        var now = clock.GetUtcNow();
        return (plaintext, new RefreshToken
        {
            UserId = userId,
            FamilyId = familyId,
            TokenHash = Hash(plaintext),
            CreatedAt = now,
            ExpiresAt = now.AddDays(_o.RefreshTokenDays),
        });
    }

    public static string Hash(string plaintext) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(plaintext))).ToLowerInvariant();
}
