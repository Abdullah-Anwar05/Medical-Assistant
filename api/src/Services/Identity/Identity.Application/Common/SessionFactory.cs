using MediPath.Identity.Application.Abstractions;
using MediPath.Identity.Domain;

namespace MediPath.Identity.Application.Common;

/// <summary>Creates refresh tokens and builds the <see cref="AuthSession"/> returned by register, login and refresh.</summary>
public sealed class SessionFactory(ITokenIssuer tokens, IRefreshTokenStore store)
{
    public AuthSession StartNew(User user, DateTimeOffset now)
    {
        var secret = tokens.CreateRefreshSecret();
        var token = RefreshToken.StartFamily(user.Id, secret.Hash, now, tokens.RefreshTokenLifetime);
        store.Add(token);
        return Build(user, secret.Plaintext, token);
    }

    public AuthSession Rotate(User user, RefreshToken current, DateTimeOffset now)
    {
        var secret = tokens.CreateRefreshSecret();
        var next = current.Rotate(secret.Hash, now, tokens.RefreshTokenLifetime);
        store.Add(next);
        return Build(user, secret.Plaintext, next);
    }

    private AuthSession Build(User user, string refreshPlaintext, RefreshToken refresh)
    {
        var access = tokens.CreateAccessToken(user);
        return new AuthSession(access.Token, access.ExpiresAt, refreshPlaintext, refresh.ExpiresAt, UserProfile.From(user));
    }
}
