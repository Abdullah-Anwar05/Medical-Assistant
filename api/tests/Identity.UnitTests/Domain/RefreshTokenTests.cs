using MediPath.Identity.Domain;

namespace Identity.UnitTests.Domain;

public sealed class RefreshTokenTests
{
    private static readonly DateTimeOffset T0 = new(2026, 11, 9, 12, 0, 0, TimeSpan.Zero);
    private static readonly TimeSpan Lifetime = TimeSpan.FromDays(14);
    private static readonly Guid UserId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    [Fact]
    public void StartFamily_creates_an_active_token_in_a_new_family()
    {
        var a = RefreshToken.StartFamily(UserId, "hash-a", T0, Lifetime);
        var b = RefreshToken.StartFamily(UserId, "hash-b", T0, Lifetime);

        Assert.NotEqual(a.FamilyId, b.FamilyId);
        Assert.Equal(T0 + Lifetime, a.ExpiresAt);
        Assert.False(a.IsRevoked);
    }

    [Fact]
    public void Expiry_is_inclusive_of_the_expiry_instant()
    {
        var token = RefreshToken.StartFamily(UserId, "hash", T0, Lifetime);

        Assert.False(token.IsExpiredAt(T0 + Lifetime - TimeSpan.FromSeconds(1)));
        Assert.True(token.IsExpiredAt(T0 + Lifetime));
    }

    [Fact]
    public void Rotate_revokes_the_current_token_and_links_a_successor_in_the_same_family()
    {
        var current = RefreshToken.StartFamily(UserId, "hash-1", T0, Lifetime);
        var later = T0.AddMinutes(5);

        var next = current.Rotate("hash-2", later, Lifetime);

        Assert.Equal(later, current.RevokedAt);
        Assert.Equal(RevocationReasons.Rotated, current.RevokedReason);
        Assert.Equal(next.Id, current.ReplacedByTokenId);
        Assert.Equal(current.FamilyId, next.FamilyId);
        Assert.Equal(UserId, next.UserId);
        Assert.Equal("hash-2", next.TokenHash);
        Assert.Equal(later + Lifetime, next.ExpiresAt);
        Assert.False(next.IsRevoked);
    }

    [Fact]
    public void A_revoked_token_cannot_be_rotated()
    {
        var token = RefreshToken.StartFamily(UserId, "hash", T0, Lifetime);
        token.Revoke(RevocationReasons.Logout, T0);

        Assert.Throws<InvalidOperationException>(() => token.Rotate("hash-2", T0, Lifetime));
    }

    [Fact]
    public void Revoke_keeps_the_first_reason_and_time()
    {
        var token = RefreshToken.StartFamily(UserId, "hash", T0, Lifetime);

        token.Revoke(RevocationReasons.Logout, T0);
        token.Revoke(RevocationReasons.ReuseDetected, T0.AddMinutes(1));

        Assert.Equal(RevocationReasons.Logout, token.RevokedReason);
        Assert.Equal(T0, token.RevokedAt);
    }
}
