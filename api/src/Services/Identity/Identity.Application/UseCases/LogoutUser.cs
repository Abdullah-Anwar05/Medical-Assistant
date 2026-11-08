using MediPath.Identity.Application.Abstractions;
using MediPath.Identity.Application.Common;
using MediPath.Identity.Domain;

namespace MediPath.Identity.Application.UseCases;

public sealed class LogoutUser(
    IRefreshTokenStore tokens,
    ITokenIssuer issuer,
    IAuditLog audit,
    IUnitOfWork unitOfWork,
    TimeProvider clock)
{
    public async Task<Result<Done>> ExecuteAsync(Guid userId, string? presentedToken, CancellationToken ct)
    {
        if (!string.IsNullOrEmpty(presentedToken))
        {
            var token = await tokens.FindByHashAsync(issuer.HashRefreshToken(presentedToken), ct);
            // Only the caller's own session is ended; a token belonging to someone else is ignored.
            if (token is not null && token.UserId == userId)
                await tokens.RevokeFamilyAsync(token.FamilyId, RevocationReasons.Logout, clock.GetUtcNow(), ct);
        }

        audit.Record(AuditEventTypes.Logout, userId, detail: string.IsNullOrEmpty(presentedToken) ? "no refresh token presented" : null);
        await unitOfWork.SaveChangesAsync(ct);
        return Done.Value;
    }
}
