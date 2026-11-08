using System.Threading.RateLimiting;
using MediPath.BuildingBlocks.Audit;
using MediPath.BuildingBlocks.Auth;
using MediPath.BuildingBlocks.Problems;
using MediPath.Identity.Data;
using MediPath.Identity.Domain;
using MediPath.Identity.Endpoints;
using MediPath.Identity.Security;
using MediPath.Identity.Seeding;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddMediPathProblemDetails();
builder.Services.AddMediPathJwt(builder.Configuration);
builder.Services.AddHttpContextAccessor();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<PasswordPolicy>();
builder.Services.AddSingleton<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddSingleton<TokenService>();
builder.Services.AddScoped<IAuditWriter, AuditWriter<IdentityDbContext>>();

// The test host registers its own (SQLite) DbContext.
if (builder.Environment.IsDevelopment() &&
    string.Equals(builder.Configuration["Database:Provider"], "Sqlite", StringComparison.OrdinalIgnoreCase))
{
    // Dev-only fallback for machines without Docker/PostgreSQL. Never used outside Development.
    builder.Services.AddDbContext<IdentityDbContext>(o => o
        .UseSqlite(builder.Configuration.GetConnectionString("Sqlite") ?? "Data Source=identity-dev.db")
        .UseSnakeCaseNamingConvention());
}
else if (!builder.Environment.IsEnvironment("Testing"))
{
    var cs = builder.Configuration.GetConnectionString("MediPath")
        ?? throw new InvalidOperationException("ConnectionStrings:MediPath is not set (see api/README.md).");
    builder.Services.AddDbContext<IdentityDbContext>(o => o
        .UseNpgsql(cs, x => x.MigrationsHistoryTable("__ef_migrations_history", IdentityDbContext.Schema))
        .UseSnakeCaseNamingConvention());
}

var authPermitPerMinute = builder.Configuration.GetValue("RateLimiting:AuthPermitPerMinute", 20);
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy(IdentityEndpoints.AuthRateLimitPolicy, ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = authPermitPerMinute, Window = TimeSpan.FromMinutes(1) }));
});

// The gateway forwards the client IP; only loopback proxies are trusted (the default).
builder.Services.Configure<ForwardedHeadersOptions>(o =>
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto);

builder.Services.AddHealthChecks();

var app = builder.Build();

app.UseForwardedHeaders();
app.UseMediPathProblemDetails();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health");
app.MapIdentityEndpoints();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
    if (db.Database.IsNpgsql())
        await db.Database.MigrateAsync();
    else
        await db.Database.EnsureCreatedAsync();
    await AdminSeeder.SeedAsync(scope.ServiceProvider, app.Logger);
}

app.Run();

public partial class Program;
