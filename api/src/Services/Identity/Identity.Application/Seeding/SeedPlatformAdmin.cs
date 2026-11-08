using MediPath.Identity.Application.Abstractions;
using MediPath.Identity.Application.Validation;
using MediPath.Identity.Domain;

namespace MediPath.Identity.Application.Seeding;

/// <summary>Synthetic first PlatformAdmin. Values come from user-secrets / env vars (SeedAdmin__*), never from the repo.</summary>
public sealed class SeedAdminOptions
{
    public const string SectionName = "SeedAdmin";
    public string? Email { get; set; }
    public string? Password { get; set; }
    public string FirstName { get; set; } = "Synthetic";
    public string LastName { get; set; } = "Admin";
    public Guid? OrganisationId { get; set; }
}

public enum SeedOutcome { NotConfigured, AlreadyExists, Seeded }

public sealed record SeedResult(SeedOutcome Outcome, Guid? UserId = null);

public sealed class SeedPlatformAdmin(
    PasswordPolicy passwordPolicy,
    IUserRepository users,
    IPasswordHasher hasher,
    IUnitOfWork unitOfWork,
    TimeProvider clock)
{
    public async Task<SeedResult> ExecuteAsync(SeedAdminOptions? options, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(options?.Email) || string.IsNullOrEmpty(options.Password))
            return new SeedResult(SeedOutcome.NotConfigured);
        if (passwordPolicy.Validate(options.Password) is { } error)
            throw new InvalidOperationException($"SeedAdmin:Password rejected by password policy: {error}");
        if (await users.EmailExistsAsync(User.Normalize(options.Email), ct))
            return new SeedResult(SeedOutcome.AlreadyExists);

        var user = User.CreatePlatformAdmin(options.Email, options.FirstName, options.LastName,
            options.OrganisationId ?? Guid.Empty, clock.GetUtcNow());
        user.SetPasswordHash(hasher.Hash(options.Password));
        users.Add(user);
        await unitOfWork.SaveChangesAsync(ct);
        return new SeedResult(SeedOutcome.Seeded, user.Id);
    }
}
