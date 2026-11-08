using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using MediPath.BuildingBlocks.Auth;
using MediPath.Identity.Application.Abstractions;
using MediPath.Identity.Domain;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace MediPath.Identity.Infrastructure.Security;

public sealed class JwtTokenIssuer(IOptions<JwtOptions> options, TimeProvider clock) : ITokenIssuer
{
    private readonly JwtOptions _options = options.Value;
    private readonly JsonWebTokenHandler _handler = new();

    public TimeSpan RefreshTokenLifetime => TimeSpan.FromDays(_options.RefreshTokenDays);

    public AccessToken CreateAccessToken(User user)
    {
        var now = clock.GetUtcNow();
        var expires = now.AddMinutes(_options.AccessTokenMinutes);
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
            Issuer = _options.Issuer,
            Audience = _options.Audience,
            IssuedAt = now.UtcDateTime,
            NotBefore = now.UtcDateTime,
            Expires = expires.UtcDateTime,
            SigningCredentials = new SigningCredentials(JwtServiceCollectionExtensions.CreateKey(_options), SecurityAlgorithms.HmacSha256),
        });
        return new AccessToken(token, expires);
    }

    public RefreshSecret CreateRefreshSecret()
    {
        var plaintext = Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(48));
        return new RefreshSecret(plaintext, HashRefreshToken(plaintext));
    }

    public string HashRefreshToken(string plaintext) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(plaintext))).ToLowerInvariant();
}
