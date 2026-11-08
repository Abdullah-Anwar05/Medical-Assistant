using MediPath.Identity.Application.Abstractions;
using MediPath.Identity.Data;
using MediPath.Identity.Domain;
using Microsoft.EntityFrameworkCore;

namespace MediPath.Identity.Infrastructure.Persistence;

public sealed class EfUserRepository(IdentityDbContext db) : IUserRepository
{
    public Task<User?> FindByEmailAsync(string normalizedEmail, CancellationToken ct) =>
        db.Users.FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, ct);

    public Task<User?> FindByIdAsync(Guid id, CancellationToken ct) =>
        db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);

    public Task<bool> EmailExistsAsync(string normalizedEmail, CancellationToken ct) =>
        db.Users.AsNoTracking().AnyAsync(u => u.NormalizedEmail == normalizedEmail, ct);

    public void Add(User user) => db.Users.Add(user);
}

public sealed class EfRefreshTokenStore(IdentityDbContext db) : IRefreshTokenStore
{
    public Task<RefreshToken?> FindByHashAsync(string tokenHash, CancellationToken ct) =>
        db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == tokenHash, ct);

    public void Add(RefreshToken token) => db.RefreshTokens.Add(token);

    public Task RevokeFamilyAsync(Guid familyId, string reason, DateTimeOffset now, CancellationToken ct) =>
        db.RefreshTokens
            .Where(t => t.FamilyId == familyId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now).SetProperty(t => t.RevokedReason, reason), ct);
}

public sealed class EfLoginAttemptStore(IdentityDbContext db) : ILoginAttemptStore
{
    public async Task<LoginAttempt?> FindAsync(string normalizedEmail, CancellationToken ct) =>
        await db.LoginAttempts.FindAsync([normalizedEmail], ct);

    public void Add(LoginAttempt attempt) => db.LoginAttempts.Add(attempt);

    public void Remove(LoginAttempt attempt) => db.LoginAttempts.Remove(attempt);
}

public sealed class EfUnitOfWork(IdentityDbContext db) : IUnitOfWork
{
    public async Task SaveChangesAsync(CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException ex)
        {
            throw new ConcurrencyConflictException(ex);
        }
        catch (DbUpdateException ex)
        {
            throw new WriteConflictException(ex);
        }
    }

    public void DiscardChanges() => db.ChangeTracker.Clear();
}
