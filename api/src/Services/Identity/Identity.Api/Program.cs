using System.Threading.RateLimiting;
using MediPath.BuildingBlocks.Auth;
using MediPath.BuildingBlocks.Problems;
using MediPath.Identity.Api.Endpoints;
using MediPath.Identity.Application.Common;
using MediPath.Identity.Application.Seeding;
using MediPath.Identity.Application.UseCases;
using MediPath.Identity.Application.Validation;
using MediPath.Identity.Infrastructure;
using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddMediPathProblemDetails();
builder.Services.AddMediPathJwt(builder.Configuration);
builder.Services.AddHttpContextAccessor();
builder.Services.AddSingleton(TimeProvider.System);

builder.Services.AddIdentityInfrastructure(builder.Configuration, builder.Environment);

// Application
builder.Services.AddSingleton<PasswordPolicy>();
builder.Services.AddSingleton<IRequestValidator<RegisterUserRequest>, RegisterUserRequestValidator>();
builder.Services.AddSingleton<IRequestValidator<LoginRequest>, LoginRequestValidator>();
builder.Services.AddScoped<SessionFactory>();
builder.Services.AddScoped<RegisterUser>();
builder.Services.AddScoped<LoginUser>();
builder.Services.AddScoped<RefreshSession>();
builder.Services.AddScoped<LogoutUser>();
builder.Services.AddScoped<GetCurrentUser>();
builder.Services.AddScoped<SeedPlatformAdmin>();

// Api
builder.Services.AddSingleton<ITokenDelivery, ClientTokenDelivery>();

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
    await scope.ServiceProvider.InitialiseIdentityDatabaseAsync();
    var seedOptions = app.Configuration.GetSection(SeedAdminOptions.SectionName).Get<SeedAdminOptions>();
    var seed = await scope.ServiceProvider.GetRequiredService<SeedPlatformAdmin>().ExecuteAsync(seedOptions, CancellationToken.None);
    if (seed.Outcome == SeedOutcome.Seeded)
        app.Logger.LogInformation("Seeded PlatformAdmin {UserId}.", seed.UserId);
    else if (seed.Outcome == SeedOutcome.NotConfigured)
        app.Logger.LogInformation("SeedAdmin not configured; no PlatformAdmin seeded.");
}

app.Run();

public partial class Program;
