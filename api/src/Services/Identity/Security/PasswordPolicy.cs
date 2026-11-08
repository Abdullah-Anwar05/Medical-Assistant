namespace MediPath.Identity.Security;

/// <summary>Contract rule: minimum 12 characters, rejected if on the common/breached list. No complexity rules.</summary>
public sealed class PasswordPolicy
{
    public const int MinLength = 12;
    public const int MaxLength = 128;

    private readonly HashSet<string> _blocked;

    public PasswordPolicy()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Security", "common-passwords.txt");
        if (!File.Exists(path))
            throw new InvalidOperationException($"Common-password list not found at {path}.");
        _blocked = File.ReadLines(path)
            .Select(l => l.Trim())
            .Where(l => l.Length > 0 && !l.StartsWith('#'))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    /// <returns>An error message, or null when the password is acceptable.</returns>
    public string? Validate(string? password)
    {
        if (string.IsNullOrEmpty(password) || password.Length < MinLength)
            return $"Password must be at least {MinLength} characters.";
        if (password.Length > MaxLength)
            return $"Password must be at most {MaxLength} characters.";
        if (_blocked.Contains(password) || password.Distinct().Count() <= 2)
            return "This password is too common. Choose a different one.";
        return null;
    }
}
