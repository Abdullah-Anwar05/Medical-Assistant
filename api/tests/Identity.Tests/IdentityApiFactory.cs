using System.Net.Http.Headers;
using System.Net.Http.Json;
using MediPath.Identity.Data;
using MediPath.Identity.Endpoints;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Time.Testing;

namespace Identity.Tests;

/// <summary>
/// Runs the real Identity service in-process against an in-memory SQLite database and a controllable clock.
/// All data is synthetic. PostgreSQL-specific behaviour (schema, migrations) is not covered here — see api/README.md.
/// </summary>
public sealed class IdentityApiFactory : WebApplicationFactory<Program>
{
    public const string AdminEmail = "synthetic.admin@example.test";
    public const string AdminPassword = "synthetic-admin-pass-0001";
    public static readonly Guid AdminOrg = Guid.Parse("00000000-0000-0000-0000-00000000a001");

    private readonly SqliteConnection _connection = new("DataSource=:memory:");
    public int AuthPermitPerMinute { get; init; } = 10_000;

    public FakeTimeProvider Clock { get; } = new(DateTimeOffset.UtcNow);

    public IdentityApiFactory() => _connection.Open();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("Jwt:SigningKey", "test-only-signing-key-not-a-secret-0123456789");
        builder.UseSetting("RateLimiting:AuthPermitPerMinute", AuthPermitPerMinute.ToString());
        builder.UseSetting("SeedAdmin:Email", AdminEmail);
        builder.UseSetting("SeedAdmin:Password", AdminPassword);
        builder.UseSetting("SeedAdmin:OrganisationId", AdminOrg.ToString());
        builder.ConfigureTestServices(s =>
        {
            s.RemoveAll<TimeProvider>();
            s.AddSingleton<TimeProvider>(Clock);
            s.AddDbContext<IdentityDbContext>(o => o.UseSqlite(_connection));
        });
    }

    public HttpClient Mobile()
    {
        var c = CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        c.DefaultRequestHeaders.Add("X-Client", "mobile");
        return c;
    }

    public HttpClient Web() =>
        CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false, BaseAddress = new Uri("https://localhost") });

    public T WithDb<T>(Func<IdentityDbContext, T> f)
    {
        using var scope = Services.CreateScope();
        return f(scope.ServiceProvider.GetRequiredService<IdentityDbContext>());
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing) _connection.Dispose();
    }
}

public static class TestData
{
    private static int _n;
    public const string GoodPassword = "correct-horse-battery-staple";

    public static string NewEmail() => $"synthetic.patient{Interlocked.Increment(ref _n)}@example.test";

    public static object Register(string email, string password = GoodPassword) => new
    {
        email, password, firstName = "Synthetic", lastName = "Patient", dateOfBirth = "1980-04-01", acceptedTermsVersion = "2026-11",
    };

    public static async Task<AuthResponse> RegisterOk(HttpClient c, string email)
    {
        var r = await c.PostAsJsonAsync("/api/v1/identity/register", Register(email));
        r.EnsureSuccessStatusCode();
        return (await r.Content.ReadFromJsonAsync<AuthResponse>())!;
    }

    public static HttpRequestMessage Bearer(HttpMethod m, string url, string token, object? body = null)
    {
        var req = new HttpRequestMessage(m, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (body is not null) req.Content = JsonContent.Create(body);
        return req;
    }

    public static string? RefreshCookie(HttpResponseMessage r) =>
        r.Headers.TryGetValues("Set-Cookie", out var values)
            ? values.FirstOrDefault(v => v.StartsWith(IdentityEndpoints.RefreshCookie + "=", StringComparison.Ordinal))
            : null;

    public static string CookieValue(string setCookie) =>
        setCookie.Split(';')[0][(IdentityEndpoints.RefreshCookie.Length + 1)..];
}
