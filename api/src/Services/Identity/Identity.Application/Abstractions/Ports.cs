using MediPath.Identity.Domain;

namespace MediPath.Identity.Application.Abstractions;

public interface IUserRepository
{
    Task<User?> FindByEmailAsync(string normalizedEmail, CancellationToken ct);
    Task<User?> FindByIdAsync(Guid id, CancellationToken ct);
    Task<bool> EmailExistsAsync(string normalizedEmail, CancellationToken ct);
    void Add(User user);
}

public interface IRefreshTokenStore
{
    Task<RefreshToken?> FindByHashAsync(string tokenHash, CancellationToken ct);
    void Add(RefreshToken token);
    /// <summary>Revokes every still-active token in the family immediately (not deferred to SaveChanges).</summary>
    Task RevokeFamilyAsync(Guid familyId, string reason, DateTimeOffset now, CancellationToken ct);
}

public interface ILoginAttemptStore
{
    Task<LoginAttempt?> FindAsync(string normalizedEmail, CancellationToken ct);
    void Add(LoginAttempt attempt);
    void Remove(LoginAttempt attempt);
}

public interface IUnitOfWork
{
    /// <exception cref="ConcurrencyConflictException">A row changed since it was read (e.g. a token rotated concurrently).</exception>
    /// <exception cref="WriteConflictException">Any other rejected write, e.g. a unique-constraint violation.</exception>
    Task SaveChangesAsync(CancellationToken ct);

    /// <summary>Forgets all pending changes so the caller can continue after a failed save.</summary>
    void DiscardChanges();
}

public sealed record AccessToken(string Token, DateTimeOffset ExpiresAt);

/// <summary>A newly generated refresh token: the plaintext goes to the client once, only the hash is stored.</summary>
public sealed record RefreshSecret(string Plaintext, string Hash);

public interface ITokenIssuer
{
    TimeSpan RefreshTokenLifetime { get; }
    AccessToken CreateAccessToken(User user);
    RefreshSecret CreateRefreshSecret();
    string HashRefreshToken(string plaintext);
}

public enum PasswordCheck { Failed, Success, SuccessRehashNeeded }

public interface IPasswordHasher
{
    string Hash(string password);
    PasswordCheck Verify(string passwordHash, string password);
}

/// <summary>Spends the same hashing work for an unknown email as for a real one, so response time does not reveal accounts.</summary>
public interface ILoginTimingEqualiser
{
    void SpendEquivalentWork(string password);
}

public interface IBlockedPasswordList
{
    bool Contains(string password);
}

public interface IAuditLog
{
    /// <summary>Stages an audit event; it is persisted by the next <see cref="IUnitOfWork.SaveChangesAsync"/>.</summary>
    void Record(string eventType, Guid? userId = null, string? subject = null, string? detail = null);
}

public sealed class ConcurrencyConflictException(Exception inner) : Exception("The data changed since it was read.", inner);

public sealed class WriteConflictException(Exception inner) : Exception("The write was rejected by the database.", inner);
