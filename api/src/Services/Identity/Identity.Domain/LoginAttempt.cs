namespace MediPath.Identity.Domain;

/// <summary>
/// Failed-login counter keyed by normalised email, not by user, so an unknown email is locked out
/// exactly like a real one and the 423 response cannot be used to enumerate accounts.
/// </summary>
public sealed class LoginAttempt
{
    public const int MaxFailedLogins = 5;
    public static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    private LoginAttempt() { } // EF Core

    public LoginAttempt(string normalizedEmail) => NormalizedEmail = normalizedEmail;

    public string NormalizedEmail { get; private set; } = "";
    public int FailedCount { get; private set; }
    public DateTimeOffset? LockedUntil { get; private set; }
    public DateTimeOffset LastFailedAt { get; private set; }

    public bool IsLockedAt(DateTimeOffset now) => LockedUntil is { } until && until > now;

    /// <summary>Counts a failure; an expired lock starts a fresh window. Locks after <see cref="MaxFailedLogins"/> failures.</summary>
    public void RecordFailure(DateTimeOffset now)
    {
        if (LockedUntil is not null)
        {
            FailedCount = 0;
            LockedUntil = null;
        }
        FailedCount++;
        LastFailedAt = now;
        if (FailedCount >= MaxFailedLogins)
            LockedUntil = now.Add(LockoutDuration);
    }
}
