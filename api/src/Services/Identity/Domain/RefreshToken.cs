namespace MediPath.Identity.Domain;

/// <summary>Opaque refresh token; only its SHA-256 hash is stored. Tokens rotated from one login share a FamilyId.</summary>
public sealed class RefreshToken
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid FamilyId { get; set; }
    public string TokenHash { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    /// <summary>rotated | logout | reuse_detected</summary>
    public string? RevokedReason { get; set; }
    public Guid? ReplacedByTokenId { get; set; }
}
