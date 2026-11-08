using MediPath.BuildingBlocks.Audit;
using MediPath.Identity.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace MediPath.Identity.Data;

public sealed class IdentityDbContext(DbContextOptions<IdentityDbContext> options) : DbContext(options)
{
    public const string Schema = "identity";

    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<LoginAttempt> LoginAttempts => Set<LoginAttempt>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.HasDefaultSchema(Schema);

        b.Entity<User>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Email).HasMaxLength(320).IsRequired();
            e.Property(x => x.NormalizedEmail).HasMaxLength(320).IsRequired();
            e.HasIndex(x => x.NormalizedEmail).IsUnique();
            e.Property(x => x.PasswordHash).IsRequired();
            e.Property(x => x.FirstName).HasMaxLength(100).IsRequired();
            e.Property(x => x.LastName).HasMaxLength(100).IsRequired();
            e.Property(x => x.AcceptedTermsVersion).HasMaxLength(32);
            // Comma-separated so the same model runs on PostgreSQL and the SQLite test database.
            e.Property(x => x.Roles)
                .HasMaxLength(256)
                .HasConversion(
                    v => string.Join(',', v),
                    v => v.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList(),
                    new ValueComparer<List<string>>(
                        (a, c) => a!.SequenceEqual(c!),
                        v => v.Aggregate(0, (h, s) => HashCode.Combine(h, s)),
                        v => v.ToList()));
        });

        b.Entity<RefreshToken>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.TokenHash).HasMaxLength(64).IsRequired();
            e.HasIndex(x => x.TokenHash).IsUnique();
            e.HasIndex(x => x.FamilyId);
            e.Property(x => x.RevokedReason).HasMaxLength(32);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<LoginAttempt>(e =>
        {
            e.HasKey(x => x.NormalizedEmail);
            e.Property(x => x.NormalizedEmail).HasMaxLength(320);
        });

        b.MapAuditEvents();
    }
}
