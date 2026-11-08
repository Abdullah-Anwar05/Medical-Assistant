using MediPath.Identity.Domain;

namespace Identity.UnitTests.Domain;

public sealed class LoginAttemptTests
{
    private static readonly DateTimeOffset T0 = new(2026, 11, 9, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Locks_on_the_fifth_failure_and_not_before()
    {
        var attempt = new LoginAttempt("SYNTHETIC@EXAMPLE.TEST");
        for (var i = 1; i < LoginAttempt.MaxFailedLogins; i++)
        {
            attempt.RecordFailure(T0);
            Assert.False(attempt.IsLockedAt(T0));
        }

        attempt.RecordFailure(T0);

        Assert.Equal(LoginAttempt.MaxFailedLogins, attempt.FailedCount);
        Assert.Equal(T0 + LoginAttempt.LockoutDuration, attempt.LockedUntil);
        Assert.True(attempt.IsLockedAt(T0));
    }

    [Fact]
    public void Lock_expires_after_the_lockout_duration()
    {
        var attempt = LockedAt(T0);

        Assert.True(attempt.IsLockedAt(T0 + LoginAttempt.LockoutDuration - TimeSpan.FromSeconds(1)));
        Assert.False(attempt.IsLockedAt(T0 + LoginAttempt.LockoutDuration));
    }

    [Fact]
    public void Failure_after_an_expired_lock_starts_a_fresh_window()
    {
        var attempt = LockedAt(T0);
        var later = T0 + LoginAttempt.LockoutDuration + TimeSpan.FromMinutes(1);

        attempt.RecordFailure(later);

        Assert.Equal(1, attempt.FailedCount);
        Assert.Null(attempt.LockedUntil);
        Assert.Equal(later, attempt.LastFailedAt);
    }

    private static LoginAttempt LockedAt(DateTimeOffset at)
    {
        var attempt = new LoginAttempt("SYNTHETIC@EXAMPLE.TEST");
        for (var i = 0; i < LoginAttempt.MaxFailedLogins; i++)
            attempt.RecordFailure(at);
        return attempt;
    }
}
