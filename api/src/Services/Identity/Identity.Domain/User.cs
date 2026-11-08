namespace MediPath.Identity.Domain;

public sealed class User
{
    private User() { } // EF Core

    public Guid Id { get; private set; }
    public string Email { get; private set; } = "";
    /// <summary>Trimmed, upper-invariant email; unique.</summary>
    public string NormalizedEmail { get; private set; } = "";
    public string PasswordHash { get; private set; } = "";
    public string FirstName { get; private set; } = "";
    public string LastName { get; private set; } = "";
    /// <summary>Patients only; null for staff.</summary>
    public DateOnly? DateOfBirth { get; private set; }
    public string? AcceptedTermsVersion { get; private set; }
    public DateTimeOffset? AcceptedTermsAt { get; private set; }
    /// <summary>Tenancy for staff; null for patients and carers.</summary>
    public Guid? OrganisationId { get; private set; }
    public List<string> Roles { get; private set; } = [];
    public bool IsActive { get; private set; } = true;
    public DateTimeOffset CreatedAt { get; private set; }

    public static string Normalize(string email) => email.Trim().ToUpperInvariant();

    public static User RegisterPatient(
        string email, string firstName, string lastName, DateOnly dateOfBirth, string acceptedTermsVersion, DateTimeOffset now) => new()
    {
        Id = Guid.NewGuid(),
        Email = email.Trim(),
        NormalizedEmail = Normalize(email),
        FirstName = firstName.Trim(),
        LastName = lastName.Trim(),
        DateOfBirth = dateOfBirth,
        AcceptedTermsVersion = acceptedTermsVersion.Trim(),
        AcceptedTermsAt = now,
        Roles = [Domain.Roles.Patient],
        CreatedAt = now,
    };

    public static User CreatePlatformAdmin(string email, string firstName, string lastName, Guid organisationId, DateTimeOffset now) => new()
    {
        Id = Guid.NewGuid(),
        Email = email.Trim(),
        NormalizedEmail = Normalize(email),
        FirstName = firstName,
        LastName = lastName,
        OrganisationId = organisationId,
        Roles = [Domain.Roles.PlatformAdmin],
        CreatedAt = now,
    };

    public void SetPasswordHash(string passwordHash) => PasswordHash = passwordHash;
}
