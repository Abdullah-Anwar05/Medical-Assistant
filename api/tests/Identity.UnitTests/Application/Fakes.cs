using MediPath.Identity.Application.Abstractions;
using MediPath.Identity.Application.Common;
using MediPath.Identity.Application.UseCases;
using MediPath.Identity.Application.Validation;
using MediPath.Identity.Domain;
using Microsoft.Extensions.Time.Testing;

namespace Identity.UnitTests.Application;

/// <summary>In-memory implementations of the Application ports plus factories for the use cases. Synthetic data only.</summary>
internal sealed class Harness
{
    public FakeTimeProvider Clock { get; } = new(new DateTimeOffset(2026, 11, 9, 12, 0, 0, TimeSpan.Zero));
    public FakeUsers Users { get; } = new();
    public FakeTokens Tokens { get; } = new();
    public FakeAttempts Attempts { get; } = new();
    public FakeUnitOfWork UnitOfWork { get; } = new();
    public FakeIssuer Issuer { get; } = new();
    public FakeHasher Hasher { get; } = new();
    public FakeTimingEqualiser Equaliser { get; } = new();
    public FakeAudit Audit { get; } = new();

    public DateTimeOffset Now => Clock.GetUtcNow();

    private SessionFactory Sessions => new(Issuer, Tokens);

    public RegisterUser Register() => new(
        new RegisterUserRequestValidator(new PasswordPolicy(new NoBlockedPasswords()), Clock),
        Users, Hasher, Sessions, Audit, UnitOfWork, Clock);

    public LoginUser Login() => new(new LoginRequestValidator(), Users, Attempts, Hasher, Equaliser, Sessions, Audit, UnitOfWork, Clock);

    public RefreshSession Refresh() => new(Tokens, Users, Issuer, Sessions, Audit, UnitOfWork, Clock);

    public LogoutUser Logout() => new(Tokens, Issuer, Audit, UnitOfWork, Clock);

    public User AddPatient(string email = "synthetic.patient@example.test", string password = "correct-horse-battery-staple")
    {
        var user = User.RegisterPatient(email, "Synthetic", "Patient", new DateOnly(1980, 4, 1), "2026-11", Now);
        user.SetPasswordHash(Hasher.Hash(password));
        Users.Add(user);
        return user;
    }

    /// <summary>Stores an active token for the user and returns its plaintext.</summary>
    public (string Plaintext, RefreshToken Token) AddRefreshToken(User user)
    {
        var secret = Issuer.CreateRefreshSecret();
        var token = RefreshToken.StartFamily(user.Id, secret.Hash, Now, Issuer.RefreshTokenLifetime);
        Tokens.Add(token);
        return (secret.Plaintext, token);
    }
}

internal sealed class FakeUsers : IUserRepository
{
    public List<User> All { get; } = [];
    public Task<User?> FindByEmailAsync(string normalizedEmail, CancellationToken ct) =>
        Task.FromResult(All.FirstOrDefault(u => u.NormalizedEmail == normalizedEmail));
    public Task<User?> FindByIdAsync(Guid id, CancellationToken ct) => Task.FromResult(All.FirstOrDefault(u => u.Id == id));
    public Task<bool> EmailExistsAsync(string normalizedEmail, CancellationToken ct) =>
        Task.FromResult(All.Any(u => u.NormalizedEmail == normalizedEmail));
    public void Add(User user) => All.Add(user);
}

internal sealed class FakeTokens : IRefreshTokenStore
{
    public List<RefreshToken> All { get; } = [];
    public Task<RefreshToken?> FindByHashAsync(string tokenHash, CancellationToken ct) =>
        Task.FromResult(All.FirstOrDefault(t => t.TokenHash == tokenHash));
    public void Add(RefreshToken token) => All.Add(token);
    public Task RevokeFamilyAsync(Guid familyId, string reason, DateTimeOffset now, CancellationToken ct)
    {
        foreach (var token in All.Where(t => t.FamilyId == familyId))
            token.Revoke(reason, now);
        return Task.CompletedTask;
    }
}

internal sealed class FakeAttempts : ILoginAttemptStore
{
    public List<LoginAttempt> All { get; } = [];
    public Task<LoginAttempt?> FindAsync(string normalizedEmail, CancellationToken ct) =>
        Task.FromResult(All.FirstOrDefault(a => a.NormalizedEmail == normalizedEmail));
    public void Add(LoginAttempt attempt) => All.Add(attempt);
    public void Remove(LoginAttempt attempt) => All.Remove(attempt);
}

internal sealed class FakeUnitOfWork : IUnitOfWork
{
    public int Saves { get; private set; }
    public int Discards { get; private set; }
    /// <summary>Thrown by the next save only, then cleared.</summary>
    public Exception? FailNextSaveWith { get; set; }
    /// <summary>Runs before the failing save throws, e.g. to simulate the competing writer's row.</summary>
    public Action? BeforeFailing { get; set; }

    public Task SaveChangesAsync(CancellationToken ct)
    {
        if (FailNextSaveWith is { } ex)
        {
            FailNextSaveWith = null;
            BeforeFailing?.Invoke();
            throw ex;
        }
        Saves++;
        return Task.CompletedTask;
    }

    public void DiscardChanges() => Discards++;
}

internal sealed class FakeIssuer : ITokenIssuer
{
    private int _n;
    public TimeSpan RefreshTokenLifetime => TimeSpan.FromDays(14);
    public AccessToken CreateAccessToken(User user) => new($"access-{user.Id}", DateTimeOffset.UnixEpoch);
    public RefreshSecret CreateRefreshSecret()
    {
        var plaintext = $"refresh-{Interlocked.Increment(ref _n)}";
        return new RefreshSecret(plaintext, HashRefreshToken(plaintext));
    }
    public string HashRefreshToken(string plaintext) => $"hash({plaintext})";
}

internal sealed class FakeHasher : IPasswordHasher
{
    public PasswordCheck NextSuccessResult { get; set; } = PasswordCheck.Success;
    public string Hash(string password) => $"pw({password})";
    public PasswordCheck Verify(string passwordHash, string password) =>
        passwordHash == Hash(password) ? NextSuccessResult : PasswordCheck.Failed;
}

internal sealed class FakeTimingEqualiser : ILoginTimingEqualiser
{
    public int Calls { get; private set; }
    public void SpendEquivalentWork(string password) => Calls++;
}

internal sealed class FakeAudit : IAuditLog
{
    public List<(string Type, Guid? UserId, string? Subject, string? Detail)> Events { get; } = [];
    public void Record(string eventType, Guid? userId = null, string? subject = null, string? detail = null) =>
        Events.Add((eventType, userId, subject, detail));
    public IEnumerable<string> Types => Events.Select(e => e.Type);
}

internal sealed class NoBlockedPasswords : IBlockedPasswordList
{
    public bool Contains(string password) => false;
}

internal static class Requests
{
    public static RegisterUserRequest Register(string email = "synthetic.new@example.test") =>
        new(email, "correct-horse-battery-staple", "Synthetic", "Patient", "1980-04-01", "2026-11");
}

internal static class ResultAssert
{
    public static T Success<T>(Result<T> result)
    {
        Assert.True(result.IsSuccess, $"Expected success but got {result.Failure}");
        return result.Value!;
    }

    public static void Failed<T>(Result<T> result, Failure expected) => Assert.Equal(expected, result.Failure);
}
