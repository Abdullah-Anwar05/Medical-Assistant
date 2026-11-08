using MediPath.Identity.Data;
using Microsoft.EntityFrameworkCore;

namespace Identity.Tests;

public sealed class DatabaseProviderTests(IdentityApiFactory factory) : IClassFixture<IdentityApiFactory>
{
    [Fact]
    public void Provider_matches_MEDIPATH_TEST_DB_and_postgres_has_migrations_applied()
    {
        _ = factory.Server; // start the host, which migrates/creates the database

        factory.WithDb(db =>
        {
            Assert.Equal(IdentityApiFactory.UsePostgres, db.Database.IsNpgsql());
            if (IdentityApiFactory.UsePostgres)
            {
                Assert.Empty(db.Database.GetPendingMigrations());
                Assert.NotEmpty(db.Database.GetAppliedMigrations());
                Assert.Equal(IdentityDbContext.Schema, db.Model.GetDefaultSchema());
            }
            return 0;
        });
    }
}
