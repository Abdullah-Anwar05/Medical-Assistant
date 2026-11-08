using MediPath.Identity.Application.Abstractions;
using MediPath.Identity.Application.Common;
using MediPath.Identity.Domain;

namespace Identity.UnitTests.Application;

public sealed class RegisterUserTests
{
    [Fact]
    public async Task Registers_a_patient_with_a_new_session_and_audit_event()
    {
        var h = new Harness();

        var session = ResultAssert.Success(await h.Register().ExecuteAsync(Requests.Register(" Synthetic.New@Example.test "), default));

        var user = Assert.Single(h.Users.All);
        Assert.Equal("Synthetic.New@Example.test", user.Email);
        Assert.Equal([Roles.Patient], user.Roles);
        Assert.Equal(h.Hasher.Hash("correct-horse-battery-staple"), user.PasswordHash);
        Assert.Equal(user.Id, session.User.Id);
        Assert.Single(h.Tokens.All, t => t.UserId == user.Id && !t.IsRevoked);
        Assert.Equal([AuditEventTypes.Registered], h.Audit.Types);
        Assert.Equal(1, h.UnitOfWork.Saves);
    }

    [Fact]
    public async Task Invalid_request_returns_field_errors_and_writes_nothing()
    {
        var h = new Harness();

        var result = await h.Register().ExecuteAsync(Requests.Register() with { Password = "short", DateOfBirth = "01/04/1980" }, default);

        Assert.Equal(FailureKind.Validation, result.Failure!.Kind);
        Assert.Contains("password", result.Failure.Errors!.Keys);
        Assert.Contains("dateOfBirth", result.Failure.Errors!.Keys);
        Assert.Empty(h.Users.All);
        Assert.Equal(0, h.UnitOfWork.Saves);
    }

    [Fact]
    public async Task Existing_email_is_a_conflict()
    {
        var h = new Harness();
        h.AddPatient("synthetic.new@example.test");

        ResultAssert.Failed(await h.Register().ExecuteAsync(Requests.Register("SYNTHETIC.NEW@example.test"), default),
            Failure.EmailAlreadyRegistered);
    }

    [Fact]
    public async Task Losing_a_concurrent_registration_race_is_a_conflict()
    {
        var h = new Harness();
        h.UnitOfWork.FailNextSaveWith = new WriteConflictException(new Exception("unique violation"));
        // The competing request's row is what the re-check finds after the failed save.
        h.UnitOfWork.BeforeFailing = () => { h.Users.All.Clear(); h.AddPatient("synthetic.new@example.test"); };

        ResultAssert.Failed(await h.Register().ExecuteAsync(Requests.Register(), default), Failure.EmailAlreadyRegistered);
        Assert.Equal(1, h.UnitOfWork.Discards);
    }

    [Fact]
    public async Task A_write_failure_that_is_not_a_duplicate_is_rethrown()
    {
        var h = new Harness();
        var failure = new WriteConflictException(new Exception("other constraint"));
        h.UnitOfWork.FailNextSaveWith = failure;
        h.UnitOfWork.BeforeFailing = () => h.Users.All.Clear();

        Assert.Same(failure, await Assert.ThrowsAsync<WriteConflictException>(() => h.Register().ExecuteAsync(Requests.Register(), default)));
    }
}

public sealed class LoginUserTests
{
    private const string Password = "correct-horse-battery-staple";

    [Fact]
    public async Task Correct_password_starts_a_session_and_clears_failed_attempts()
    {
        var h = new Harness();
        var user = h.AddPatient();
        await h.Login().ExecuteAsync(new LoginRequest(user.Email, "wrong-password-0000"), default);
        Assert.Single(h.Attempts.All);

        var session = ResultAssert.Success(await h.Login().ExecuteAsync(new LoginRequest(user.Email, Password), default));

        Assert.Equal(user.Id, session.User.Id);
        Assert.Empty(h.Attempts.All);
        Assert.Equal(AuditEventTypes.LoginSucceeded, h.Audit.Types.Last());
    }

    [Fact]
    public async Task Unknown_email_spends_equivalent_hashing_work_and_counts_a_failure()
    {
        var h = new Harness();

        ResultAssert.Failed(await h.Login().ExecuteAsync(new LoginRequest("synthetic.nobody@example.test", Password), default),
            Failure.InvalidCredentials);

        Assert.Equal(1, h.Equaliser.Calls);
        var attempt = Assert.Single(h.Attempts.All);
        Assert.Equal(1, attempt.FailedCount);
        Assert.Equal((AuditEventTypes.LoginFailed, (Guid?)null, "SYNTHETIC.NOBODY@EXAMPLE.TEST", "failedCount=1"), h.Audit.Events.Single());
    }

    [Fact]
    public async Task Locked_email_returns_locked_without_checking_the_password()
    {
        var h = new Harness();
        var user = h.AddPatient();
        for (var i = 0; i < LoginAttempt.MaxFailedLogins; i++)
            await h.Login().ExecuteAsync(new LoginRequest(user.Email, "wrong-password-0000"), default);

        ResultAssert.Failed(await h.Login().ExecuteAsync(new LoginRequest(user.Email, Password), default), Failure.AccountLocked);
        Assert.Equal(AuditEventTypes.LoginLockedOut, h.Audit.Types.Last());

        h.Clock.Advance(LoginAttempt.LockoutDuration);
        ResultAssert.Success(await h.Login().ExecuteAsync(new LoginRequest(user.Email, Password), default));
    }

    [Fact]
    public async Task Outdated_hash_is_upgraded_on_successful_login()
    {
        var h = new Harness();
        var user = h.AddPatient();
        h.Hasher.NextSuccessResult = PasswordCheck.SuccessRehashNeeded;
        user.SetPasswordHash(h.Hasher.Hash(Password)); // same format; the fake reports it as needing a rehash

        ResultAssert.Success(await h.Login().ExecuteAsync(new LoginRequest(user.Email, Password), default));

        Assert.Equal(h.Hasher.Hash(Password), user.PasswordHash);
    }

    [Fact]
    public async Task Missing_fields_are_validation_errors()
    {
        var result = await new Harness().Login().ExecuteAsync(new LoginRequest(" ", ""), default);

        Assert.Equal(FailureKind.Validation, result.Failure!.Kind);
        Assert.Equal(["email", "password"], result.Failure.Errors!.Keys.Order());
    }
}

public sealed class RefreshSessionTests
{
    [Fact]
    public async Task Valid_token_is_rotated_within_its_family()
    {
        var h = new Harness();
        var user = h.AddPatient();
        var (plaintext, current) = h.AddRefreshToken(user);

        var session = ResultAssert.Success(await h.Refresh().ExecuteAsync(plaintext, default));

        Assert.Equal(RevocationReasons.Rotated, current.RevokedReason);
        var next = Assert.Single(h.Tokens.All, t => !t.IsRevoked);
        Assert.Equal(current.FamilyId, next.FamilyId);
        Assert.Equal(h.Issuer.HashRefreshToken(session.RefreshToken), next.TokenHash);
        Assert.Equal([AuditEventTypes.RefreshSucceeded], h.Audit.Types);
    }

    [Fact]
    public async Task Missing_token_is_unauthorized_without_ending_the_session()
    {
        ResultAssert.Failed(await new Harness().Refresh().ExecuteAsync(null, default), Failure.RefreshTokenMissing);
    }

    [Fact]
    public async Task Unknown_or_expired_token_ends_the_session()
    {
        var h = new Harness();
        var (plaintext, _) = h.AddRefreshToken(h.AddPatient());

        ResultAssert.Failed(await h.Refresh().ExecuteAsync("never-issued", default), Failure.SessionExpired);
        h.Clock.Advance(h.Issuer.RefreshTokenLifetime);
        ResultAssert.Failed(await h.Refresh().ExecuteAsync(plaintext, default), Failure.SessionExpired);

        Assert.Equal(["unknown token", "expired"], h.Audit.Events.Select(e => e.Detail));
    }

    [Fact]
    public async Task Reusing_a_rotated_token_revokes_the_whole_family()
    {
        var h = new Harness();
        var (first, _) = h.AddRefreshToken(h.AddPatient());
        ResultAssert.Success(await h.Refresh().ExecuteAsync(first, default));

        ResultAssert.Failed(await h.Refresh().ExecuteAsync(first, default), Failure.SessionExpired);

        Assert.All(h.Tokens.All, t => Assert.True(t.IsRevoked));
        Assert.Equal(RevocationReasons.ReuseDetected, h.Tokens.All.Last().RevokedReason);
        Assert.Equal(AuditEventTypes.RefreshReuseDetected, h.Audit.Types.Last());
    }

    [Fact]
    public async Task Losing_a_concurrent_rotation_is_treated_as_reuse()
    {
        var h = new Harness();
        var (plaintext, _) = h.AddRefreshToken(h.AddPatient());
        h.UnitOfWork.FailNextSaveWith = new ConcurrencyConflictException(new Exception("row changed"));

        ResultAssert.Failed(await h.Refresh().ExecuteAsync(plaintext, default), Failure.SessionExpired);

        Assert.Equal(1, h.UnitOfWork.Discards);
        Assert.Equal(AuditEventTypes.RefreshReuseDetected, h.Audit.Types.Last());
    }
}

public sealed class LogoutUserTests
{
    [Fact]
    public async Task Revokes_the_callers_own_family()
    {
        var h = new Harness();
        var user = h.AddPatient();
        var (plaintext, token) = h.AddRefreshToken(user);

        ResultAssert.Success(await h.Logout().ExecuteAsync(user.Id, plaintext, default));

        Assert.Equal(RevocationReasons.Logout, token.RevokedReason);
        Assert.Equal((AuditEventTypes.Logout, (Guid?)user.Id, (string?)null, (string?)null), h.Audit.Events.Single());
    }

    [Fact]
    public async Task Ignores_a_token_that_belongs_to_someone_else()
    {
        var h = new Harness();
        var victim = h.AddPatient("synthetic.victim@example.test");
        var attacker = h.AddPatient("synthetic.attacker@example.test");
        var (plaintext, token) = h.AddRefreshToken(victim);

        ResultAssert.Success(await h.Logout().ExecuteAsync(attacker.Id, plaintext, default));

        Assert.False(token.IsRevoked);
    }

    [Fact]
    public async Task Without_a_token_only_audits()
    {
        var h = new Harness();
        var user = h.AddPatient();

        ResultAssert.Success(await h.Logout().ExecuteAsync(user.Id, null, default));

        Assert.Equal("no refresh token presented", h.Audit.Events.Single().Detail);
        Assert.Equal(1, h.UnitOfWork.Saves);
    }
}
