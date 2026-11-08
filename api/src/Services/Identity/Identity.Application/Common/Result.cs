namespace MediPath.Identity.Application.Common;

public enum FailureKind
{
    Validation,
    Conflict,
    Unauthorized,
    /// <summary>Unauthorized, and the refresh token the client holds is no longer usable.</summary>
    SessionEnded,
    Locked,
}

public sealed record Failure(FailureKind Kind, string Title, string? Detail = null, IReadOnlyDictionary<string, string[]>? Errors = null)
{
    public static Failure Validation(IReadOnlyDictionary<string, string[]> errors) =>
        new(FailureKind.Validation, "Validation failed.", Errors: errors);

    public static readonly Failure EmailAlreadyRegistered = new(FailureKind.Conflict, "Email already registered.");
    public static readonly Failure InvalidCredentials = new(FailureKind.Unauthorized, "Invalid email or password.");
    public static readonly Failure RefreshTokenMissing = new(FailureKind.Unauthorized, "Refresh token missing.");
    public static readonly Failure SessionExpired = new(FailureKind.SessionEnded, "Session expired. Please sign in again.");
    public static readonly Failure AccountLocked = new(FailureKind.Locked, "Account temporarily locked.",
        "Too many failed sign-in attempts. Try again later.");
}

public sealed class Result<T>
{
    private Result(T? value, Failure? failure) => (Value, Failure) = (value, failure);

    public T? Value { get; }
    public Failure? Failure { get; }
    public bool IsSuccess => Failure is null;

    public static implicit operator Result<T>(T value) => new(value, null);
    public static implicit operator Result<T>(Failure failure) => new(default, failure);
}
