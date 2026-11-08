using MediPath.BuildingBlocks.Audit;
using MediPath.Identity.Application.Abstractions;
using MediPath.Identity.Data;
using MediPath.Identity.Infrastructure.Persistence;
using MediPath.Identity.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace MediPath.Identity.Infrastructure;

public static class DependencyInjection
{
    public const string TestingEnvironment = "Testing";

    public static IServiceCollection AddIdentityInfrastructure(
        this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        AddDatabase(services, configuration, environment);

        services.AddScoped<IUserRepository, EfUserRepository>();
        services.AddScoped<IRefreshTokenStore, EfRefreshTokenStore>();
        services.AddScoped<ILoginAttemptStore, EfLoginAttemptStore>();
        services.AddScoped<IUnitOfWork, EfUnitOfWork>();
        services.AddScoped<IAuditWriter, AuditWriter<IdentityDbContext>>();
        services.AddScoped<IAuditLog, AuditLog>();

        services.AddSingleton<ITokenIssuer, JwtTokenIssuer>();
        services.AddSingleton<IPasswordHasher, AspNetPasswordHasher>();
        services.AddSingleton<ILoginTimingEqualiser, PasswordHashTimingEqualiser>();
        services.AddSingleton<IBlockedPasswordList, FileBlockedPasswordList>();
        return services;
    }

    /// <summary>PostgreSQL gets migrations (schema <c>identity</c>); the SQLite dev/test databases are created directly.</summary>
    public static async Task InitialiseIdentityDatabaseAsync(this IServiceProvider scopedServices, CancellationToken ct = default)
    {
        var db = scopedServices.GetRequiredService<IdentityDbContext>();
        if (db.Database.IsNpgsql())
            await db.Database.MigrateAsync(ct);
        else
            await db.Database.EnsureCreatedAsync(ct);
    }

    /// <summary>The PostgreSQL options used at runtime, by the design-time factory and by the PostgreSQL test host.</summary>
    public static DbContextOptionsBuilder UseIdentityPostgres(this DbContextOptionsBuilder options, string connectionString) =>
        options
            .UseNpgsql(connectionString, x => x.MigrationsHistoryTable("__ef_migrations_history", IdentityDbContext.Schema))
            .UseSnakeCaseNamingConvention();

    private static void AddDatabase(IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        if (environment.IsEnvironment(TestingEnvironment))
            return; // the test host registers its own DbContext

        if (environment.IsDevelopment() &&
            string.Equals(configuration["Database:Provider"], "Sqlite", StringComparison.OrdinalIgnoreCase))
        {
            // Dev-only fallback for machines without Docker/PostgreSQL. Never used outside Development.
            services.AddDbContext<IdentityDbContext>(o => o
                .UseSqlite(configuration.GetConnectionString("Sqlite") ?? "Data Source=identity-dev.db")
                .UseSnakeCaseNamingConvention());
            return;
        }

        var connectionString = configuration.GetConnectionString("MediPath")
            ?? throw new InvalidOperationException("ConnectionStrings:MediPath is not set (see api/README.md).");
        services.AddDbContext<IdentityDbContext>(o => o.UseIdentityPostgres(connectionString));
    }
}
