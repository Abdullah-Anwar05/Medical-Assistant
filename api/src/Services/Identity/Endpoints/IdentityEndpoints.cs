using System.Globalization;
using System.Net.Mail;
using MediPath.BuildingBlocks.Audit;
using MediPath.BuildingBlocks.Auth;
using MediPath.Identity.Data;
using MediPath.Identity.Domain;
using MediPath.Identity.Security;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace MediPath.Identity.Endpoints;

public static class IdentityEndpoints
{
    public const string BasePath = "/api/v1/identity";
    public const string RefreshCookie = "mp_refresh";
    public const string AuthRateLimitPolicy = "auth";
    public const int MaxFailedLogins = 5;
    public static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    private const string InvalidCredentials = "Invalid email or password.";

    public static class AuditTypes
    {
        public const string Registered = "identity.register";
        public const string LoginSucceeded = "identity.login.succeeded";
        public const string LoginFailed = "identity.login.failed";
        public const string LoginLockedOut = "identity.login.locked_out";
        public const string RefreshSucceeded = "identity.refresh.succeeded";
        public const string RefreshFailed = "identity.refresh.failed";
        public const string RefreshReuseDetected = "identity.refresh.reuse_detected";
        public const string Logout = "identity.logout";
    }

    public static IEndpointRouteBuilder MapIdentityEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup(BasePath);
        g.MapPost("/register", Register).RequireRateLimiting(AuthRateLimitPolicy);
        g.MapPost("/login", Login).RequireRateLimiting(AuthRateLimitPolicy);
        g.MapPost("/refresh", Refresh).RequireRateLimiting(AuthRateLimitPolicy);
        g.MapPost("/logout", Logout).RequireAuthorization();
        g.MapGet("/me", Me).RequireAuthorization();
        return app;
    }

    private static bool IsMobile(HttpContext ctx) =>
        string.Equals(ctx.Request.Headers["X-Client"], "mobile", StringComparison.OrdinalIgnoreCase);

    // ---------- register ----------

    private static async Task<IResult> Register(
        RegisterRequest? req, HttpContext ctx, IdentityDbContext db, PasswordPolicy policy,
        IPasswordHasher<User> hasher, TokenService tokens, IAuditWriter audit, TimeProvider clock, CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var email = req?.Email?.Trim();
        if (string.IsNullOrEmpty(email) || email.Length > 320 || !IsValidEmail(email))
            errors["email"] = ["A valid email address is required."];
        if (policy.Validate(req?.Password) is { } pwError)
            errors["password"] = [pwError];
        RequireName(errors, "firstName", req?.FirstName);
        RequireName(errors, "lastName", req?.LastName);
        DateOnly dob = default;
        if (string.IsNullOrWhiteSpace(req?.DateOfBirth) ||
            !DateOnly.TryParseExact(req.DateOfBirth, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out dob))
            errors["dateOfBirth"] = ["Date of birth is required in yyyy-mm-dd format."];
        else if (dob > DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime) || dob.Year < 1900)
            errors["dateOfBirth"] = ["Date of birth must be a real past date."];
        if (string.IsNullOrWhiteSpace(req?.AcceptedTermsVersion) || req.AcceptedTermsVersion.Length > 32)
            errors["acceptedTermsVersion"] = ["The accepted terms version is required."];
        if (errors.Count > 0)
            return Results.ValidationProblem(errors);

        var normalized = User.Normalize(email!);
        if (await db.Users.AnyAsync(u => u.NormalizedEmail == normalized, ct))
            return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Email already registered.");

        var now = clock.GetUtcNow();
        var user = new User
        {
            Email = email!,
            NormalizedEmail = normalized,
            FirstName = req!.FirstName!.Trim(),
            LastName = req.LastName!.Trim(),
            DateOfBirth = dob,
            AcceptedTermsVersion = req.AcceptedTermsVersion!.Trim(),
            AcceptedTermsAt = now,
            Roles = [Roles.Patient],
            CreatedAt = now,
        };
        user.PasswordHash = hasher.HashPassword(user, req.Password!);
        db.Users.Add(user);
        audit.Add(AuditTypes.Registered, user.Id);
        var response = IssueTokens(ctx, db, tokens, user, Guid.NewGuid());

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Lost a race with a concurrent registration of the same email; anything else is rethrown.
            db.ChangeTracker.Clear();
            if (await db.Users.AsNoTracking().AnyAsync(u => u.NormalizedEmail == normalized, ct))
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Email already registered.");
            throw;
        }
        return Results.Created($"{BasePath}/me", response);
    }

    // ---------- login ----------

    private static async Task<IResult> Login(
        LoginRequest? req, HttpContext ctx, IdentityDbContext db, IPasswordHasher<User> hasher,
        TokenService tokens, IAuditWriter audit, TimeProvider clock, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req?.Email) || string.IsNullOrEmpty(req.Password))
        {
            var errors = new Dictionary<string, string[]>();
            if (string.IsNullOrWhiteSpace(req?.Email)) errors["email"] = ["Email is required."];
            if (string.IsNullOrEmpty(req?.Password)) errors["password"] = ["Password is required."];
            return Results.ValidationProblem(errors);
        }

        var now = clock.GetUtcNow();
        var normalized = User.Normalize(req.Email);
        if (normalized.Length > 320)
            return Unauthorized();

        var attempt = await db.LoginAttempts.FindAsync([normalized], ct);
        if (attempt?.LockedUntil is { } until && until > now)
        {
            audit.Add(AuditTypes.LoginLockedOut, subject: normalized);
            await db.SaveChangesAsync(ct);
            return Results.Problem(statusCode: StatusCodes.Status423Locked, title: "Account temporarily locked.",
                detail: "Too many failed sign-in attempts. Try again later.");
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.NormalizedEmail == normalized, ct);
        var result = user is null
            ? VerifyAgainstDummy(hasher, req.Password)
            : hasher.VerifyHashedPassword(user, user.PasswordHash, req.Password);

        if (user is null || !user.IsActive || result == PasswordVerificationResult.Failed)
        {
            if (attempt is null)
            {
                attempt = new LoginAttempt { NormalizedEmail = normalized };
                db.LoginAttempts.Add(attempt);
            }
            if (attempt.LockedUntil is not null) // previous lock has expired: start a fresh window
            {
                attempt.FailedCount = 0;
                attempt.LockedUntil = null;
            }
            attempt.FailedCount++;
            attempt.LastFailedAt = now;
            if (attempt.FailedCount >= MaxFailedLogins)
                attempt.LockedUntil = now.Add(LockoutDuration);
            audit.Add(AuditTypes.LoginFailed, user?.Id, normalized, $"failedCount={attempt.FailedCount}");
            await db.SaveChangesAsync(ct);
            return Unauthorized();
        }

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
            user.PasswordHash = hasher.HashPassword(user, req.Password);
        if (attempt is not null)
            db.LoginAttempts.Remove(attempt);
        audit.Add(AuditTypes.LoginSucceeded, user.Id);
        var response = IssueTokens(ctx, db, tokens, user, Guid.NewGuid());
        await db.SaveChangesAsync(ct);
        return Results.Ok(response);
    }

    // ---------- refresh ----------

    private static async Task<IResult> Refresh(
        HttpContext ctx, IdentityDbContext db, TokenService tokens, IAuditWriter audit, TimeProvider clock, CancellationToken ct)
    {
        var presented = await ReadRefreshToken(ctx, ct);
        if (string.IsNullOrEmpty(presented))
            return Unauthorized("Refresh token missing.");

        var now = clock.GetUtcNow();
        var hash = TokenService.Hash(presented);
        var current = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (current is null)
        {
            audit.Add(AuditTypes.RefreshFailed, detail: "unknown token");
            await db.SaveChangesAsync(ct);
            return RefreshRejected(ctx);
        }

        if (current.RevokedAt is not null)
            return await RevokeFamilyForReuse(ctx, db, audit, current, now, ct);

        if (current.ExpiresAt <= now)
        {
            audit.Add(AuditTypes.RefreshFailed, current.UserId, detail: "expired");
            await db.SaveChangesAsync(ct);
            return RefreshRejected(ctx);
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == current.UserId, ct);
        if (user is null || !user.IsActive)
        {
            audit.Add(AuditTypes.RefreshFailed, current.UserId, detail: "user inactive");
            await db.SaveChangesAsync(ct);
            return RefreshRejected(ctx);
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var (plaintext, next) = tokens.CreateRefreshToken(user.Id, current.FamilyId);
        // Conditional update: if a concurrent request already rotated this token, nothing is updated
        // and this request is treated as reuse.
        var rotated = await db.RefreshTokens
            .Where(t => t.Id == current.Id && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.RevokedAt, now)
                .SetProperty(t => t.RevokedReason, "rotated")
                .SetProperty(t => t.ReplacedByTokenId, next.Id), ct);
        if (rotated == 0)
        {
            await tx.RollbackAsync(ct);
            db.ChangeTracker.Clear();
            return await RevokeFamilyForReuse(ctx, db, audit, current, now, ct);
        }

        db.RefreshTokens.Add(next);
        audit.Add(AuditTypes.RefreshSucceeded, user.Id);
        var response = BuildResponse(ctx, tokens, user, plaintext, next.ExpiresAt);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(response);
    }

    private static async Task<IResult> RevokeFamilyForReuse(
        HttpContext ctx, IdentityDbContext db, IAuditWriter audit, RefreshToken token, DateTimeOffset now, CancellationToken ct)
    {
        await db.RefreshTokens
            .Where(t => t.FamilyId == token.FamilyId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now).SetProperty(t => t.RevokedReason, "reuse_detected"), ct);
        audit.Add(AuditTypes.RefreshReuseDetected, token.UserId, detail: $"family={token.FamilyId}");
        await db.SaveChangesAsync(ct);
        return RefreshRejected(ctx);
    }

    // ---------- logout ----------

    private static async Task<IResult> Logout(
        HttpContext ctx, IdentityDbContext db, IAuditWriter audit, TimeProvider clock, CancellationToken ct)
    {
        var userId = CurrentUserId(ctx);
        if (userId is null)
            return Unauthorized();

        var presented = await ReadRefreshToken(ctx, ct);
        if (!string.IsNullOrEmpty(presented))
        {
            var hash = TokenService.Hash(presented);
            var token = await db.RefreshTokens.AsNoTracking().FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
            // Only the owner's own session is ended; a token belonging to someone else is ignored.
            if (token is not null && token.UserId == userId)
            {
                var now = clock.GetUtcNow();
                await db.RefreshTokens
                    .Where(t => t.FamilyId == token.FamilyId && t.RevokedAt == null)
                    .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now).SetProperty(t => t.RevokedReason, "logout"), ct);
            }
        }

        audit.Add(AuditTypes.Logout, userId, detail: string.IsNullOrEmpty(presented) ? "no refresh token presented" : null);
        await db.SaveChangesAsync(ct);
        if (!IsMobile(ctx))
            ClearRefreshCookie(ctx);
        return Results.NoContent();
    }

    // ---------- me ----------

    private static async Task<IResult> Me(HttpContext ctx, IdentityDbContext db, CancellationToken ct)
    {
        var userId = CurrentUserId(ctx);
        var user = userId is null ? null : await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        return user is null || !user.IsActive ? Unauthorized() : Results.Ok(ToProfile(user));
    }

    // ---------- helpers ----------

    private static AuthResponse IssueTokens(HttpContext ctx, IdentityDbContext db, TokenService tokens, User user, Guid familyId)
    {
        var (plaintext, entity) = tokens.CreateRefreshToken(user.Id, familyId);
        db.RefreshTokens.Add(entity);
        return BuildResponse(ctx, tokens, user, plaintext, entity.ExpiresAt);
    }

    private static AuthResponse BuildResponse(HttpContext ctx, TokenService tokens, User user, string refreshPlaintext, DateTimeOffset refreshExpires)
    {
        var (access, accessExpires) = tokens.CreateAccessToken(user);
        if (IsMobile(ctx))
            return new AuthResponse(access, accessExpires, refreshPlaintext, ToProfile(user));

        ctx.Response.Cookies.Append(RefreshCookie, refreshPlaintext, CookieOptions(refreshExpires));
        return new AuthResponse(access, accessExpires, null, ToProfile(user));
    }

    private static CookieOptions CookieOptions(DateTimeOffset? expires) => new()
    {
        HttpOnly = true,
        Secure = true,
        SameSite = SameSiteMode.Strict,
        Path = BasePath,
        Expires = expires,
        IsEssential = true,
    };

    private static void ClearRefreshCookie(HttpContext ctx) =>
        ctx.Response.Cookies.Delete(RefreshCookie, CookieOptions(null));

    private static async Task<string?> ReadRefreshToken(HttpContext ctx, CancellationToken ct)
    {
        if (!IsMobile(ctx))
            return ctx.Request.Cookies[RefreshCookie];
        if (ctx.Request.ContentLength is 0 || !ctx.Request.HasJsonContentType())
            return null;
        try
        {
            var body = await ctx.Request.ReadFromJsonAsync<RefreshRequest>(ct);
            return body?.RefreshToken;
        }
        catch (System.Text.Json.JsonException)
        {
            return null;
        }
    }

    private static IResult RefreshRejected(HttpContext ctx)
    {
        if (!IsMobile(ctx))
            ClearRefreshCookie(ctx);
        return Unauthorized("Session expired. Please sign in again.");
    }

    private static Guid? CurrentUserId(HttpContext ctx) =>
        Guid.TryParse(ctx.User.FindFirst("sub")?.Value, out var id) ? id : null;

    private static UserProfile ToProfile(User u) =>
        new(u.Id, u.Email, u.FirstName, u.LastName, u.Roles, u.OrganisationId);

    private static IResult Unauthorized(string title = InvalidCredentials) =>
        Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: title);

    private static void RequireName(Dictionary<string, string[]> errors, string field, string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Trim().Length > 100)
            errors[field] = ["Required, at most 100 characters."];
    }

    private static bool IsValidEmail(string email) =>
        MailAddress.TryCreate(email, out var addr) && addr.Address == email && email.Contains('.', StringComparison.Ordinal);

    // Hashing against a fixed dummy keeps the response time for unknown emails close to that for real ones.
    private static readonly User DummyUser = new();
    private static string? _dummyHash;
    private static PasswordVerificationResult VerifyAgainstDummy(IPasswordHasher<User> hasher, string password)
    {
        _dummyHash ??= hasher.HashPassword(DummyUser, Guid.NewGuid().ToString());
        hasher.VerifyHashedPassword(DummyUser, _dummyHash, password);
        return PasswordVerificationResult.Failed;
    }
}
