using MediPath.Identity.Data;
using MediPath.Identity.Domain;
using MediPath.Identity.Security;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace MediPath.Identity.Seeding;

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

public static class AdminSeeder
{
    public static async Task SeedAsync(IServiceProvider sp, ILogger logger, CancellationToken ct = default)
    {
        var o = sp.GetRequiredService<IConfiguration>().GetSection(SeedAdminOptions.SectionName).Get<SeedAdminOptions>();
        if (string.IsNullOrWhiteSpace(o?.Email) || string.IsNullOrEmpty(o.Password))
        {
            logger.LogInformation("SeedAdmin not configured; no PlatformAdmin seeded.");
            return;
        }
        if (sp.GetRequiredService<PasswordPolicy>().Validate(o.Password) is { } error)
            throw new InvalidOperationException($"SeedAdmin:Password rejected by password policy: {error}");

        var db = sp.GetRequiredService<IdentityDbContext>();
        var normalized = User.Normalize(o.Email);
        if (await db.Users.AnyAsync(u => u.NormalizedEmail == normalized, ct))
            return;

        var clock = sp.GetRequiredService<TimeProvider>();
        var user = new User
        {
            Email = o.Email.Trim(),
            NormalizedEmail = normalized,
            FirstName = o.FirstName,
            LastName = o.LastName,
            OrganisationId = o.OrganisationId ?? Guid.Empty,
            Roles = [Roles.PlatformAdmin],
            CreatedAt = clock.GetUtcNow(),
        };
        user.PasswordHash = sp.GetRequiredService<IPasswordHasher<User>>().HashPassword(user, o.Password);
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seeded PlatformAdmin {UserId}.", user.Id);
    }
}
