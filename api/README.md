# MediPath API

.NET 10 microservices behind a YARP gateway. Contract: [`contracts/identity-v1.md`](../contracts/identity-v1.md).

| Project | Path | Port (dev) |
|---|---|---|
| Gateway (YARP, CORS) | `src/Gateway` | http://localhost:5080 |
| Identity service | `src/Services/Identity` | http://localhost:5101 |
| Shared (Problem Details, JWT, audit) | `src/BuildingBlocks` | — |
| Integration tests | `tests/Identity.Tests` | — |

Clients (web, mobile) call **only the gateway**: `http://localhost:5080/api/v1/identity/...`.

## Configuration — secrets never go in the repo

Set these with user-secrets (local) or environment variables (`__` instead of `:`, e.g. `Jwt__SigningKey`):

| Key | Project | Notes |
|---|---|---|
| `Jwt:SigningKey` | Identity | Required. ≥ 32 bytes, e.g. `openssl rand -base64 48`. Startup fails without it. |
| `ConnectionStrings:MediPath` | Identity | PostgreSQL, e.g. `Host=localhost;Database=medipath;Username=medipath;Password=<yours>` |
| `SeedAdmin:Email`, `SeedAdmin:Password`, `SeedAdmin:OrganisationId` | Identity | Optional. Seeds one **synthetic** PlatformAdmin on startup if the email does not exist. Password must pass the password policy. |
| `Cors:AllowedOrigins` | Gateway | Defaults to `http://localhost:5173` (Vite). |
| `RateLimiting:AuthPermitPerMinute` | Identity | Per-IP limit for register/login/refresh. Default 20. |

```bash
cd api
dotnet user-secrets set "Jwt:SigningKey" "<random 48+ chars>" --project src/Services/Identity
dotnet user-secrets set "ConnectionStrings:MediPath" "Host=localhost;Database=medipath;Username=medipath;Password=<yours>" --project src/Services/Identity
dotnet user-secrets set "SeedAdmin:Email" "synthetic.admin@medipath.test" --project src/Services/Identity
dotnet user-secrets set "SeedAdmin:Password" "<12+ chars>" --project src/Services/Identity
```

## Run

```bash
export MEDIPATH_DB_PASSWORD=<yours>
docker compose up -d
dotnet run --project src/Services/Identity --launch-profile http
dotnet run --project src/Gateway --launch-profile http
```

Identity applies its EF Core migrations (schema `identity`) on startup.

**No Docker?** Development-only fallback to a local SQLite file (`identity-dev.db`, git-ignored; no migrations, schema created directly):

```bash
Database__Provider=Sqlite dotnet run --project src/Services/Identity --launch-profile http
```

## Tests

```bash
dotnet test
```

The integration tests host the real Identity service in-process (`WebApplicationFactory`) on in-memory SQLite with a fake clock. All data is synthetic.

## Migrations

```bash
dotnet tool restore
dotnet ef migrations add <Name> -p src/Services/Identity -o Data/Migrations
```

## Open issues

- **PostgreSQL path not yet exercised.** The dev machine used to build this had no Docker or PostgreSQL; the migration was generated but never applied, and tests run on SQLite. Add a Testcontainers PostgreSQL test once Docker is available.
- **Common-password list is a placeholder** (`Security/common-passwords.txt`, ~40 entries). Replace with a full breached list or an HIBP k-anonymity check.
- Lockout is per email, so anyone can lock a known email out for 15 minutes (inherent to the contract's lockout rule). Rate limiting is per IP and in-memory (single instance only).
- Access-token signing is HS256 with a shared key. Move to asymmetric keys (RS256/ES256 + JWKS) before other services validate tokens independently.
- Audit events live in `identity.audit_events`; no retention policy or tamper protection yet.
