namespace MediPath.Identity.Domain;

/// <summary>
/// Failed-login counter keyed by normalised email, not by user, so an unknown email is locked out
/// exactly like a real one and the 423 response cannot be used to enumerate accounts.
/// </summary>
public sealed class LoginAttempt
{
    public string NormalizedEmail { get; set; } = "";
    public int FailedCount { get; set; }
    public DateTimeOffset? LockedUntil { get; set; }
    public DateTimeOffset LastFailedAt { get; set; }
}
