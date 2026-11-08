using MediPath.Identity.Application.Abstractions;

namespace MediPath.Identity.Application.Validation;

/// <summary>Contract rule: minimum 12 characters, rejected if on the common/breached list. No complexity rules.</summary>
public sealed class PasswordPolicy(IBlockedPasswordList blocked)
{
    public const int MinLength = 12;
    public const int MaxLength = 128;

    /// <returns>An error message, or null when the password is acceptable.</returns>
    public string? Validate(string? password)
    {
        if (string.IsNullOrEmpty(password) || password.Length < MinLength)
            return $"Password must be at least {MinLength} characters.";
        if (password.Length > MaxLength)
            return $"Password must be at most {MaxLength} characters.";
        if (blocked.Contains(password) || password.Distinct().Count() <= 2)
            return "This password is too common. Choose a different one.";
        return null;
    }
}
