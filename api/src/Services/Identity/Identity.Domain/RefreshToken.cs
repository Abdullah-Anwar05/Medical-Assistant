namespace MediPath.Identity.Domain;

/// <summary>Opaque refresh token; only its SHA-256 hash is stored. Tokens rotated from one login share a FamilyId.</summary>
public sealed class RefreshToken
{
    private RefreshToken() { } // EF Core

    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public Guid FamilyId { get; private set; }
    public string TokenHash { get; private set; } = "";
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset ExpiresAt { get; private set; }
    public DateTimeOffset? RevokedAt { get; private set; }
    public string? RevokedReason { get; private set; }
    public Guid? ReplacedByTokenId { get; private set; }

    public bool IsRevoked => RevokedAt is not null;

    public bool IsExpiredAt(DateTimeOffset now) => ExpiresAt <= now;

    /// <summary>Starts a new token family (one per sign-in).</summary>
    public static RefreshToken StartFamily(Guid userId, string tokenHash, DateTimeOffset now, TimeSpan lifetime) =>
        Create(userId, Guid.NewGuid(), tokenHash, now, lifetime);

    /// <summary>Revokes this token as rotated and returns its successor in the same family.</summary>
    public RefreshToken Rotate(string nextTokenHash, DateTimeOffset now, TimeSpan lifetime)
    {
        if (IsRevoked)
            throw new InvalidOperationException("A revoked refresh token cannot be rotated.");
        var next = Create(UserId, FamilyId, nextTokenHash, now, lifetime);
        Revoke(RevocationReasons.Rotated, now);
        ReplacedByTokenId = next.Id;
        return next;
    }

    /// <summary>Marks the token revoked; a token that is already revoked keeps its original reason.</summary>
    public void Revoke(string reason, DateTimeOffset now)
    {
        if (IsRevoked)
            return;
        RevokedAt = now;
        RevokedReason = reason;
    }

    private static RefreshToken Create(Guid userId, Guid familyId, string tokenHash, DateTimeOffset now, TimeSpan lifetime) => new()
    {
        Id = Guid.NewGuid(),
        UserId = userId,
        FamilyId = familyId,
        TokenHash = tokenHash,
        CreatedAt = now,
        ExpiresAt = now.Add(lifetime),
    };
}

public static class RevocationReasons
{
    public const string Rotated = "rotated";
    public const string Logout = "logout";
    public const string ReuseDetected = "reuse_detected";
}
