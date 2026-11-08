using MediPath.Identity.Application.Abstractions;
using MediPath.Identity.Application.Common;
using MediPath.Identity.Application.Validation;
using MediPath.Identity.Domain;

namespace MediPath.Identity.Application.UseCases;

public sealed class LoginUser(
    IRequestValidator<LoginRequest> validator,
    IUserRepository users,
    ILoginAttemptStore attempts,
    IPasswordHasher hasher,
    ILoginTimingEqualiser timingEqualiser,
    SessionFactory sessions,
    IAuditLog audit,
    IUnitOfWork unitOfWork,
    TimeProvider clock)
{
    public async Task<Result<AuthSession>> ExecuteAsync(LoginRequest? request, CancellationToken ct)
    {
        var errors = validator.Validate(request);
        if (errors.Count > 0)
            return Failure.Validation(errors);

        var password = request!.Password!;
        var normalized = User.Normalize(request.Email!);
        if (normalized.Length > RegisterUserRequestValidator.MaxEmailLength)
            return Failure.InvalidCredentials;

        var now = clock.GetUtcNow();
        var attempt = await attempts.FindAsync(normalized, ct);
        if (attempt is not null && attempt.IsLockedAt(now))
        {
            audit.Record(AuditEventTypes.LoginLockedOut, subject: normalized);
            await unitOfWork.SaveChangesAsync(ct);
            return Failure.AccountLocked;
        }

        var user = await users.FindByEmailAsync(normalized, ct);
        var check = CheckPassword(user, password);
        if (user is null || !user.IsActive || check == PasswordCheck.Failed)
            return await RecordFailureAsync(attempt, normalized, user, now, ct);

        if (check == PasswordCheck.SuccessRehashNeeded)
            user.SetPasswordHash(hasher.Hash(password));
        if (attempt is not null)
            attempts.Remove(attempt);
        audit.Record(AuditEventTypes.LoginSucceeded, user.Id);
        var session = sessions.StartNew(user, now);
        await unitOfWork.SaveChangesAsync(ct);
        return session;
    }

    private PasswordCheck CheckPassword(User? user, string password)
    {
        if (user is not null)
            return hasher.Verify(user.PasswordHash, password);
        timingEqualiser.SpendEquivalentWork(password);
        return PasswordCheck.Failed;
    }

    private async Task<Result<AuthSession>> RecordFailureAsync(
        LoginAttempt? attempt, string normalizedEmail, User? user, DateTimeOffset now, CancellationToken ct)
    {
        if (attempt is null)
        {
            attempt = new LoginAttempt(normalizedEmail);
            attempts.Add(attempt);
        }
        attempt.RecordFailure(now);
        audit.Record(AuditEventTypes.LoginFailed, user?.Id, normalizedEmail, $"failedCount={attempt.FailedCount}");
        await unitOfWork.SaveChangesAsync(ct);
        return Failure.InvalidCredentials;
    }
}
