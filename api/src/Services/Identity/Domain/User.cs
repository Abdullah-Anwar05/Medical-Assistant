namespace MediPath.Identity.Domain;

public sealed class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = "";
    /// <summary>Trimmed, upper-invariant email; unique.</summary>
    public string NormalizedEmail { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    /// <summary>Patients only; null for staff.</summary>
    public DateOnly? DateOfBirth { get; set; }
    public string? AcceptedTermsVersion { get; set; }
    public DateTimeOffset? AcceptedTermsAt { get; set; }
    /// <summary>Tenancy for staff; null for patients and carers.</summary>
    public Guid? OrganisationId { get; set; }
    public List<string> Roles { get; set; } = [];
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }

    public static string Normalize(string email) => email.Trim().ToUpperInvariant();
}
