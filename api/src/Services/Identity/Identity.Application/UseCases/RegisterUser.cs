using MediPath.Identity.Application.Abstractions;
using MediPath.Identity.Application.Common;
using MediPath.Identity.Application.Validation;
using MediPath.Identity.Domain;

namespace MediPath.Identity.Application.UseCases;

public sealed class RegisterUser(
    IRequestValidator<RegisterUserRequest> validator,
    IUserRepository users,
    IPasswordHasher hasher,
    SessionFactory sessions,
    IAuditLog audit,
    IUnitOfWork unitOfWork,
    TimeProvider clock)
{
    public async Task<Result<AuthSession>> ExecuteAsync(RegisterUserRequest? request, CancellationToken ct)
    {
        var errors = validator.Validate(request);
        if (errors.Count > 0)
            return Failure.Validation(errors);

        var valid = request!;
        var normalized = User.Normalize(valid.Email!);
        if (await users.EmailExistsAsync(normalized, ct))
            return Failure.EmailAlreadyRegistered;

        var now = clock.GetUtcNow();
        var user = User.RegisterPatient(valid.Email!, valid.FirstName!, valid.LastName!,
            RegisterUserRequestValidator.ParseDateOfBirth(valid.DateOfBirth!), valid.AcceptedTermsVersion!, now);
        user.SetPasswordHash(hasher.Hash(valid.Password!));
        users.Add(user);
        audit.Record(AuditEventTypes.Registered, user.Id);
        var session = sessions.StartNew(user, now);

        try
        {
            await unitOfWork.SaveChangesAsync(ct);
        }
        catch (WriteConflictException)
        {
            // Lost a race with a concurrent registration of the same email; anything else is rethrown.
            unitOfWork.DiscardChanges();
            if (await users.EmailExistsAsync(normalized, ct))
                return Failure.EmailAlreadyRegistered;
            throw;
        }
        return session;
    }
}
