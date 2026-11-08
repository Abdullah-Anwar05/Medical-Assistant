using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MediPath.Identity.Endpoints;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;
using static Identity.Tests.TestData;

namespace Identity.Tests;

public sealed class IdentityEndpointsTests(IdentityApiFactory factory) : IClassFixture<IdentityApiFactory>
{
    private const string Base = "/api/v1/identity";

    // ---------- register ----------

    [Fact]
    public async Task Register_mobile_returns_201_with_refresh_token_in_body_and_patient_role()
    {
        var email = NewEmail();
        var r = await factory.Mobile().PostAsJsonAsync($"{Base}/register", Register(email));

        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var body = (await r.Content.ReadFromJsonAsync<AuthResponse>())!;
        Assert.False(string.IsNullOrEmpty(body.RefreshToken));
        Assert.Equal(email, body.User.Email);
        Assert.Equal(["Patient"], body.User.Roles);
        Assert.Null(body.User.OrganisationId);
        Assert.Null(RefreshCookie(r));
        Assert.Equal(factory.Clock.GetUtcNow().AddMinutes(15), body.AccessTokenExpiresAt);
    }

    [Fact]
    public async Task Register_web_sets_httponly_strict_cookie_and_omits_refresh_token_from_body()
    {
        var r = await factory.Web().PostAsJsonAsync($"{Base}/register", Register(NewEmail()));

        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var json = await r.Content.ReadAsStringAsync();
        Assert.DoesNotContain("refreshToken", json);
        var cookie = RefreshCookie(r)!.ToLowerInvariant();
        Assert.Contains("httponly", cookie);
        Assert.Contains("secure", cookie);
        Assert.Contains("samesite=strict", cookie);
        Assert.Contains("path=/api/v1/identity", cookie);
    }

    [Fact]
    public async Task Register_duplicate_email_case_insensitive_returns_409()
    {
        var email = NewEmail();
        await RegisterOk(factory.Mobile(), email);
        var r = await factory.Mobile().PostAsJsonAsync($"{Base}/register", Register(email.ToUpperInvariant()));
        Assert.Equal(HttpStatusCode.Conflict, r.StatusCode);
        Assert.Equal("application/problem+json", r.Content.Headers.ContentType?.MediaType);
    }

    [Theory]
    [InlineData("short-pass1", "password")]           // 11 chars
    [InlineData("password1234", "password")]          // on the common list
    [InlineData("aaaaaaaaaaaaaa", "password")]        // trivially repetitive
    public async Task Register_rejects_weak_passwords_with_400_errors_map(string password, string field)
    {
        var r = await factory.Mobile().PostAsJsonAsync($"{Base}/register", Register(NewEmail(), password));
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        var problem = (await r.Content.ReadFromJsonAsync<ValidationProblemDetails>())!;
        Assert.True(problem.Errors.ContainsKey(field));
    }

    [Fact]
    public async Task Register_accepts_long_password_without_complexity_rules()
    {
        var r = await factory.Mobile().PostAsJsonAsync($"{Base}/register", Register(NewEmail(), "just lowercase words here"));
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
    }

    [Fact]
    public async Task Register_validates_every_field()
    {
        var r = await factory.Mobile().PostAsJsonAsync($"{Base}/register", new
        {
            email = "not-an-email", password = "", firstName = "", lastName = "", dateOfBirth = "01/04/1980", acceptedTermsVersion = "",
        });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        var problem = (await r.Content.ReadFromJsonAsync<ValidationProblemDetails>())!;
        Assert.Equal(
            ["acceptedTermsVersion", "dateOfBirth", "email", "firstName", "lastName", "password"],
            problem.Errors.Keys.Order().ToArray());
    }

    [Fact]
    public async Task Register_rejects_future_date_of_birth()
    {
        var body = new { email = NewEmail(), password = GoodPassword, firstName = "S", lastName = "P", dateOfBirth = "2030-01-01", acceptedTermsVersion = "2026-11" };
        var r = await factory.Mobile().PostAsJsonAsync($"{Base}/register", body);
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
    }

    // ---------- login ----------

    [Fact]
    public async Task Login_success_returns_tokens_and_jwt_claims()
    {
        var email = NewEmail();
        await RegisterOk(factory.Mobile(), email);

        var r = await factory.Mobile().PostAsJsonAsync($"{Base}/login", new { email, password = GoodPassword });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var body = (await r.Content.ReadFromJsonAsync<AuthResponse>())!;
        var jwt = new JsonWebToken(body.AccessToken);
        Assert.Equal(body.User.Id.ToString(), jwt.Subject);
        Assert.Equal(email, jwt.GetClaim("email").Value);
        Assert.Equal("Patient", jwt.GetClaim("role").Value);
        Assert.False(jwt.TryGetClaim("org", out _));
    }

    [Fact]
    public async Task Login_wrong_password_and_unknown_email_are_indistinguishable()
    {
        var email = NewEmail();
        await RegisterOk(factory.Mobile(), email);

        var wrong = await factory.Mobile().PostAsJsonAsync($"{Base}/login", new { email, password = "wrong-password-123" });
        var unknown = await factory.Mobile().PostAsJsonAsync($"{Base}/login", new { email = NewEmail(), password = "wrong-password-123" });

        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknown.StatusCode);
        var a = (await wrong.Content.ReadFromJsonAsync<ProblemDetails>())!;
        var b = (await unknown.Content.ReadFromJsonAsync<ProblemDetails>())!;
        Assert.Equal(a.Title, b.Title);
        Assert.Equal(a.Detail, b.Detail);
    }

    [Fact]
    public async Task Login_locks_out_after_5_failures_for_15_minutes()
    {
        // Own factory: this test moves the clock, which would expire other tests' access tokens.
        using var f = new IdentityApiFactory();
        var email = NewEmail();
        await RegisterOk(f.Mobile(), email);
        var c = f.Mobile();

        for (var i = 0; i < 5; i++)
            Assert.Equal(HttpStatusCode.Unauthorized,
                (await c.PostAsJsonAsync($"{Base}/login", new { email, password = "wrong-password-123" })).StatusCode);

        // Correct password is refused while locked.
        Assert.Equal((HttpStatusCode)423, (await c.PostAsJsonAsync($"{Base}/login", new { email, password = GoodPassword })).StatusCode);

        f.Clock.Advance(TimeSpan.FromMinutes(14));
        Assert.Equal((HttpStatusCode)423, (await c.PostAsJsonAsync($"{Base}/login", new { email, password = GoodPassword })).StatusCode);

        f.Clock.Advance(TimeSpan.FromMinutes(2));
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsJsonAsync($"{Base}/login", new { email, password = GoodPassword })).StatusCode);
    }

    [Fact]
    public async Task Lockout_applies_to_unknown_emails_too_so_423_does_not_reveal_accounts()
    {
        var email = NewEmail(); // never registered
        var c = factory.Mobile();
        for (var i = 0; i < 5; i++)
            await c.PostAsJsonAsync($"{Base}/login", new { email, password = "wrong-password-123" });
        Assert.Equal((HttpStatusCode)423, (await c.PostAsJsonAsync($"{Base}/login", new { email, password = "x" })).StatusCode);
    }

    [Fact]
    public async Task Successful_login_resets_failure_count()
    {
        var email = NewEmail();
        await RegisterOk(factory.Mobile(), email);
        var c = factory.Mobile();
        for (var i = 0; i < 4; i++)
            await c.PostAsJsonAsync($"{Base}/login", new { email, password = "wrong-password-123" });
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsJsonAsync($"{Base}/login", new { email, password = GoodPassword })).StatusCode);
        for (var i = 0; i < 4; i++)
            await c.PostAsJsonAsync($"{Base}/login", new { email, password = "wrong-password-123" });
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsJsonAsync($"{Base}/login", new { email, password = GoodPassword })).StatusCode);
    }

    [Fact]
    public async Task Seeded_platform_admin_can_log_in_with_org_claim()
    {
        var r = await factory.Mobile().PostAsJsonAsync($"{Base}/login",
            new { email = IdentityApiFactory.AdminEmail, password = IdentityApiFactory.AdminPassword });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var body = (await r.Content.ReadFromJsonAsync<AuthResponse>())!;
        Assert.Equal(["PlatformAdmin"], body.User.Roles);
        Assert.Equal(IdentityApiFactory.AdminOrg, body.User.OrganisationId);
        Assert.Equal(IdentityApiFactory.AdminOrg.ToString(), new JsonWebToken(body.AccessToken).GetClaim("org").Value);
    }

    // ---------- refresh ----------

    [Fact]
    public async Task Refresh_mobile_rotates_token()
    {
        var auth = await RegisterOk(factory.Mobile(), NewEmail());
        var r = await factory.Mobile().PostAsJsonAsync($"{Base}/refresh", new { refreshToken = auth.RefreshToken });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var next = (await r.Content.ReadFromJsonAsync<AuthResponse>())!;
        Assert.NotEqual(auth.RefreshToken, next.RefreshToken);
        Assert.Equal(auth.User.Id, next.User.Id);
    }

    [Fact]
    public async Task Refresh_reuse_of_rotated_token_revokes_whole_family()
    {
        var auth = await RegisterOk(factory.Mobile(), NewEmail());
        var c = factory.Mobile();
        var rotated = (await (await c.PostAsJsonAsync($"{Base}/refresh", new { refreshToken = auth.RefreshToken }))
            .Content.ReadFromJsonAsync<AuthResponse>())!;

        // Attacker replays the old token.
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await c.PostAsJsonAsync($"{Base}/refresh", new { refreshToken = auth.RefreshToken })).StatusCode);
        // The legitimate newer token is now revoked too.
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await c.PostAsJsonAsync($"{Base}/refresh", new { refreshToken = rotated.RefreshToken })).StatusCode);

        Assert.True(factory.WithDb(db => db.AuditEvents.Any(e =>
            e.UserId == auth.User.Id && e.EventType == IdentityEndpoints.AuditTypes.RefreshReuseDetected)));
    }

    [Fact]
    public async Task Refresh_web_uses_cookie_and_sets_new_cookie()
    {
        var reg = await factory.Web().PostAsJsonAsync($"{Base}/register", Register(NewEmail()));
        var cookie = CookieValue(RefreshCookie(reg)!);

        var req = new HttpRequestMessage(HttpMethod.Post, $"{Base}/refresh");
        req.Headers.Add("Cookie", $"{IdentityEndpoints.RefreshCookie}={cookie}");
        var r = await factory.Web().SendAsync(req);

        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.DoesNotContain("refreshToken", await r.Content.ReadAsStringAsync());
        Assert.NotEqual(cookie, CookieValue(RefreshCookie(r)!));
    }

    [Fact]
    public async Task Refresh_web_ignores_body_token()
    {
        var auth = await RegisterOk(factory.Mobile(), NewEmail());
        var r = await factory.Web().PostAsJsonAsync($"{Base}/refresh", new { refreshToken = auth.RefreshToken });
        Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode);
    }

    [Fact]
    public async Task Refresh_expired_token_returns_401()
    {
        using var f = new IdentityApiFactory();
        var auth = await RegisterOk(f.Mobile(), NewEmail());
        f.Clock.Advance(TimeSpan.FromDays(14) + TimeSpan.FromSeconds(1));
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await f.Mobile().PostAsJsonAsync($"{Base}/refresh", new { refreshToken = auth.RefreshToken })).StatusCode);
    }

    [Fact]
    public async Task Refresh_missing_or_unknown_token_returns_401()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.Mobile().PostAsync($"{Base}/refresh", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await factory.Mobile().PostAsJsonAsync($"{Base}/refresh", new { refreshToken = "nope" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.Web().PostAsync($"{Base}/refresh", null)).StatusCode);
    }

    // ---------- logout / me ----------

    [Fact]
    public async Task Me_requires_bearer_and_returns_profile()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.Mobile().GetAsync($"{Base}/me")).StatusCode);

        var auth = await RegisterOk(factory.Mobile(), NewEmail());
        var r = await factory.Mobile().SendAsync(Bearer(HttpMethod.Get, $"{Base}/me", auth.AccessToken));
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var me = (await r.Content.ReadFromJsonAsync<UserProfile>())!;
        Assert.Equal(auth.User, me with { Roles = auth.User.Roles });
    }

    [Fact]
    public async Task Me_rejects_expired_access_token()
    {
        using var f = new IdentityApiFactory();
        var auth = await RegisterOk(f.Mobile(), NewEmail());
        // JwtBearer validates lifetime against the real clock, so check the token's own expiry instead of advancing time.
        Assert.Equal(15, (new JsonWebToken(auth.AccessToken).ValidTo - new JsonWebToken(auth.AccessToken).IssuedAt).TotalMinutes);
        var r = await f.Mobile().SendAsync(Bearer(HttpMethod.Get, $"{Base}/me", auth.AccessToken + "x"));
        Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode);
    }

    [Fact]
    public async Task Logout_mobile_revokes_refresh_family()
    {
        var auth = await RegisterOk(factory.Mobile(), NewEmail());
        var r = await factory.Mobile().SendAsync(
            Bearer(HttpMethod.Post, $"{Base}/logout", auth.AccessToken, new { refreshToken = auth.RefreshToken }));
        Assert.Equal(HttpStatusCode.NoContent, r.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await factory.Mobile().PostAsJsonAsync($"{Base}/refresh", new { refreshToken = auth.RefreshToken })).StatusCode);
    }

    [Fact]
    public async Task Logout_web_revokes_cookie_token_and_clears_cookie()
    {
        var reg = await factory.Web().PostAsJsonAsync($"{Base}/register", Register(NewEmail()));
        var auth = (await reg.Content.ReadFromJsonAsync<AuthResponse>())!;
        var cookie = CookieValue(RefreshCookie(reg)!);

        var req = Bearer(HttpMethod.Post, $"{Base}/logout", auth.AccessToken);
        req.Headers.Add("Cookie", $"{IdentityEndpoints.RefreshCookie}={cookie}");
        var r = await factory.Web().SendAsync(req);
        Assert.Equal(HttpStatusCode.NoContent, r.StatusCode);
        Assert.Contains("expires=Thu, 01 Jan 1970", RefreshCookie(r)!);

        var again = new HttpRequestMessage(HttpMethod.Post, $"{Base}/refresh");
        again.Headers.Add("Cookie", $"{IdentityEndpoints.RefreshCookie}={cookie}");
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.Web().SendAsync(again)).StatusCode);
    }

    [Fact]
    public async Task Logout_cannot_revoke_another_users_session()
    {
        var victim = await RegisterOk(factory.Mobile(), NewEmail());
        var attacker = await RegisterOk(factory.Mobile(), NewEmail());
        await factory.Mobile().SendAsync(
            Bearer(HttpMethod.Post, $"{Base}/logout", attacker.AccessToken, new { refreshToken = victim.RefreshToken }));
        Assert.Equal(HttpStatusCode.OK,
            (await factory.Mobile().PostAsJsonAsync($"{Base}/refresh", new { refreshToken = victim.RefreshToken })).StatusCode);
    }

    [Fact]
    public async Task Logout_requires_bearer()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.Mobile().PostAsync($"{Base}/logout", null)).StatusCode);
    }

    // ---------- audit / storage ----------

    [Fact]
    public async Task Every_auth_action_writes_an_audit_event()
    {
        var email = NewEmail();
        var c = factory.Mobile();
        var auth = await RegisterOk(c, email);
        await c.PostAsJsonAsync($"{Base}/login", new { email, password = "wrong-password-123" });
        var login = (await (await c.PostAsJsonAsync($"{Base}/login", new { email, password = GoodPassword })).Content.ReadFromJsonAsync<AuthResponse>())!;
        var refreshed = (await (await c.PostAsJsonAsync($"{Base}/refresh", new { refreshToken = login.RefreshToken })).Content.ReadFromJsonAsync<AuthResponse>())!;
        await c.SendAsync(Bearer(HttpMethod.Post, $"{Base}/logout", refreshed.AccessToken, new { refreshToken = refreshed.RefreshToken }));

        var types = factory.WithDb(db => db.AuditEvents.Where(e => e.UserId == auth.User.Id)
            .Select(e => e.EventType).ToList());
        Assert.Equal(
            new[]
            {
                IdentityEndpoints.AuditTypes.Registered, IdentityEndpoints.AuditTypes.LoginFailed,
                IdentityEndpoints.AuditTypes.LoginSucceeded, IdentityEndpoints.AuditTypes.RefreshSucceeded,
                IdentityEndpoints.AuditTypes.Logout,
            }.Order(),
            types.Order());
        Assert.All(factory.WithDb(db => db.AuditEvents.Where(e => e.UserId == auth.User.Id).ToList()),
            e => Assert.Equal("mobile", e.ClientType));
    }

    [Fact]
    public async Task Passwords_and_refresh_tokens_are_not_stored_in_plaintext()
    {
        var auth = await RegisterOk(factory.Mobile(), NewEmail());
        var (hash, tokenHashes) = factory.WithDb(db => (
            db.Users.Single(u => u.Id == auth.User.Id).PasswordHash,
            db.RefreshTokens.Where(t => t.UserId == auth.User.Id).Select(t => t.TokenHash).ToList()));
        Assert.DoesNotContain(GoodPassword, hash);
        Assert.DoesNotContain(auth.RefreshToken!, tokenHashes);
    }

    [Fact]
    public async Task Errors_are_problem_details()
    {
        var r = await factory.Mobile().PostAsJsonAsync($"{Base}/login", new { email = "", password = "" });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Equal("application/problem+json", r.Content.Headers.ContentType?.MediaType);
        using var doc = JsonDocument.Parse(await r.Content.ReadAsStringAsync());
        Assert.True(doc.RootElement.TryGetProperty("errors", out _));
    }
}

public sealed class RateLimitTests
{
    [Fact]
    public async Task Auth_endpoints_return_429_when_rate_limited()
    {
        using var f = new IdentityApiFactory { AuthPermitPerMinute = 3 };
        var c = f.Mobile();
        var codes = new List<HttpStatusCode>();
        for (var i = 0; i < 4; i++)
            codes.Add((await c.PostAsJsonAsync("/api/v1/identity/login", new { email = NewEmail(), password = "wrong-password-123" })).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, codes[^1]);
    }
}
