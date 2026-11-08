using MediPath.Identity.Application.Abstractions;
using MediPath.Identity.Application.Common;
using MediPath.Identity.Domain;

namespace MediPath.Identity.Application.UseCases;

/// <summary>Rotates a refresh token. Presenting a revoked token (reuse) revokes the whole family.</summary>
public sealed class RefreshSession(
    IRefreshTokenStore tokens,
    IUserRepository users,
    ITokenIssuer issuer,
    SessionFactory sessions,
    IAuditLog audit,
    IUnitOfWork unitOfWork,
    TimeProvider clock)
{
    public async Task<Result<AuthSession>> ExecuteAsync(string? presentedToken, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(presentedToken))
            return Failure.RefreshTokenMissing;

        var now = clock.GetUtcNow();
        var current = await tokens.FindByHashAsync(issuer.HashRefreshToken(presentedToken), ct);
        if (current is null)
            return await RejectAsync(null, "unknown token", ct);
        if (current.IsRevoked)
            return await RejectReuseAsync(current, now, ct);
        if (current.IsExpiredAt(now))
            return await RejectAsync(current.UserId, "expired", ct);

        var user = await users.FindByIdAsync(current.UserId, ct);
        if (user is null || !user.IsActive)
            return await RejectAsync(current.UserId, "user inactive", ct);

        var session = sessions.Rotate(user, current, now);
        audit.Record(AuditEventTypes.RefreshSucceeded, user.Id);
        try
        {
            await unitOfWork.SaveChangesAsync(ct);
        }
        catch (ConcurrencyConflictException)
        {
            // A concurrent request rotated this token first, so this presentation counts as reuse.
            unitOfWork.DiscardChanges();
            return await RejectReuseAsync(current, now, ct);
        }
        return session;
    }

    private async Task<Result<AuthSession>> RejectAsync(Guid? userId, string reason, CancellationToken ct)
    {
        audit.Record(AuditEventTypes.RefreshFailed, userId, detail: reason);
        await unitOfWork.SaveChangesAsync(ct);
        return Failure.SessionExpired;
    }

    private async Task<Result<AuthSession>> RejectReuseAsync(RefreshToken token, DateTimeOffset now, CancellationToken ct)
    {
        await tokens.RevokeFamilyAsync(token.FamilyId, RevocationReasons.ReuseDetected, now, ct);
        audit.Record(AuditEventTypes.RefreshReuseDetected, token.UserId, detail: $"family={token.FamilyId}");
        await unitOfWork.SaveChangesAsync(ct);
        return Failure.SessionExpired;
    }
}
