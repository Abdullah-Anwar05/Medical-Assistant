using MediPath.Identity.Application.Abstractions;
using AspNetHasher = Microsoft.AspNetCore.Identity.PasswordHasher<object>;
using AspNetResult = Microsoft.AspNetCore.Identity.PasswordVerificationResult;

namespace MediPath.Identity.Infrastructure.Security;

/// <summary>ASP.NET Core Identity's PBKDF2 hasher. Its user argument is unused, so a fixed placeholder is passed.</summary>
public sealed class AspNetPasswordHasher : IPasswordHasher
{
    private static readonly object UnusedUser = new();
    private readonly AspNetHasher _inner = new();

    public string Hash(string password) => _inner.HashPassword(UnusedUser, password);

    public PasswordCheck Verify(string passwordHash, string password) =>
        _inner.VerifyHashedPassword(UnusedUser, passwordHash, password) switch
        {
            AspNetResult.Success => PasswordCheck.Success,
            AspNetResult.SuccessRehashNeeded => PasswordCheck.SuccessRehashNeeded,
            _ => PasswordCheck.Failed,
        };
}

/// <summary>Verifies against one fixed dummy hash, created once (thread-safe), so unknown emails cost the same as real ones.</summary>
public sealed class PasswordHashTimingEqualiser : ILoginTimingEqualiser
{
    private readonly IPasswordHasher _hasher;
    private readonly Lazy<string> _dummyHash;

    public PasswordHashTimingEqualiser(IPasswordHasher hasher)
    {
        _hasher = hasher;
        _dummyHash = new Lazy<string>(() => hasher.Hash(Guid.NewGuid().ToString()), LazyThreadSafetyMode.ExecutionAndPublication);
    }

    public void SpendEquivalentWork(string password) => _hasher.Verify(_dummyHash.Value, password);
}

/// <summary>Loads the common/breached password list shipped next to the binaries.</summary>
public sealed class FileBlockedPasswordList : IBlockedPasswordList
{
    private readonly HashSet<string> _blocked;

    public FileBlockedPasswordList()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Security", "common-passwords.txt");
        if (!File.Exists(path))
            throw new InvalidOperationException($"Common-password list not found at {path}.");
        _blocked = File.ReadLines(path)
            .Select(l => l.Trim())
            .Where(l => l.Length > 0 && !l.StartsWith('#'))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    public bool Contains(string password) => _blocked.Contains(password);
}
