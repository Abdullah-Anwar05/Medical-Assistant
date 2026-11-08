# MediPath API

.NET 10 microservices behind a YARP gateway. Contract: [`contracts/identity-v1.md`](../contracts/identity-v1.md).

| Project | Path | Port (dev) |
|---|---|---|
| Gateway (YARP, CORS) | `src/Gateway` | http://localhost:5080 |
| Identity service (Domain → Application → Infrastructure → Api) | `src/Services/Identity/Identity.*` | http://localhost:5101 |
| Shared (Problem Details, JWT, audit) | `src/BuildingBlocks` | — |
| Integration tests (HTTP, real service) | `tests/Identity.Tests` | — |
| Unit tests (Domain + Application, no DB) | `tests/Identity.UnitTests` | — |

Clients (web, mobile) call **only the gateway**: `http://localhost:5080/api/v1/identity/...`.

## Identity service layout

Dependencies point inward only: `Api → Infrastructure → Application → Domain`.

| Project | Holds | References |
|---|---|---|
| `Identity.Domain` | `User`, `RefreshToken` (rotate/revoke rules), `LoginAttempt` (lockout rules), `Roles` | nothing |
| `Identity.Application` | Use cases (`RegisterUser`, `LoginUser`, `RefreshSession`, `LogoutUser`, `GetCurrentUser`, `SeedPlatformAdmin`), ports, request validators, `Result`/`Failure` | Domain |
| `Identity.Infrastructure` | EF Core `IdentityDbContext` + migrations, port adapters (stores, unit of work, JWT issuer, password hasher, timing equaliser, audit) | Application, BuildingBlocks |
| `Identity.Api` | Endpoints (HTTP to use case only), `ITokenDelivery` (web cookie vs mobile body), failure-to-Problem-Details mapping, DI composition | Infrastructure |

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
dotnet user-secrets set "Jwt:SigningKey" "<random 48+ chars>" --project src/Services/Identity/Identity.Api
dotnet user-secrets set "ConnectionStrings:MediPath" "Host=localhost;Database=medipath;Username=medipath;Password=<yours>" --project src/Services/Identity/Identity.Api
dotnet user-secrets set "SeedAdmin:Email" "synthetic.admin@medipath.test" --project src/Services/Identity/Identity.Api
dotnet user-secrets set "SeedAdmin:Password" "<12+ chars>" --project src/Services/Identity/Identity.Api
```

## Run (PostgreSQL in Docker)

Prerequisite: Docker Desktop running. PostgreSQL is published on `127.0.0.1:5432` only.

```bash
cd api
# 1. One-time: choose a DB password. api/.env is git-ignored; compose reads it automatically.
echo "MEDIPATH_DB_PASSWORD=<random>" > .env
dotnet user-secrets set "ConnectionStrings:MediPath" "Host=localhost;Database=medipath;Username=medipath;Password=<same random>" --project src/Services/Identity/Identity.Api
# (plus Jwt:SigningKey and SeedAdmin:* from the Configuration section)

# 2. Start PostgreSQL
docker compose up -d

# 3. Start Identity (applies migrations to schema `identity`, seeds the PlatformAdmin) and the gateway, in two terminals
dotnet run --project src/Services/Identity/Identity.Api --launch-profile http
dotnet run --project src/Gateway --launch-profile http
```

Check: `curl -i http://localhost:5080/api/v1/identity/me` returns `401`.
Inspect the DB: `docker exec -it medipath-postgres psql -U medipath -d medipath -c '\dt identity.*'`.

If `dotnet run` fails with "Access is denied" starting the `.exe` (sandboxed shells), build and run the DLL instead:
`ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://localhost:5101 dotnet src/Services/Identity/Identity.Api/bin/Debug/net10.0/Identity.Api.dll`
(gateway: `ASPNETCORE_URLS=http://localhost:5080 dotnet src/Gateway/bin/Debug/net10.0/Gateway.dll`; run each from its project folder).

**No Docker?** Development-only fallback to a local SQLite file (`identity-dev.db`, git-ignored; no migrations, schema created directly):

```bash
Database__Provider=Sqlite dotnet run --project src/Services/Identity/Identity.Api --launch-profile http
```

## Tests

```bash
dotnet test                              # fast path: in-memory SQLite, no Docker
MEDIPATH_TEST_DB=postgres dotnet test    # real PostgreSQL 17 via Testcontainers, migrations applied
```

The integration tests host the real Identity service in-process (`WebApplicationFactory`) with a fake clock.
In PostgreSQL mode one container is started per run and each test class gets a fresh database; Docker must be running.
`DatabaseProviderTests` fails if the requested provider was not actually used. All data is synthetic.

## Migrations

```bash
dotnet tool restore
dotnet ef migrations add <Name> -p src/Services/Identity/Identity.Infrastructure -s src/Services/Identity/Identity.Api -o Persistence/Migrations
```

## Open issues

- Using a refresh token after logout is audited as `identity.refresh.reuse_detected` (it is a revoked token); the response is the correct `401`, but the audit label overstates it.
- CI should run `MEDIPATH_TEST_DB=postgres dotnet test` (no CI pipeline yet).
- **Common-password list is a placeholder** (`Identity.Infrastructure/Security/common-passwords.txt`, ~40 entries). Replace with a full breached list or an HIBP k-anonymity check.
- Lockout is per email, so anyone can lock a known email out for 15 minutes (inherent to the contract's lockout rule). Rate limiting is per IP and in-memory (single instance only).
- Access-token signing is HS256 with a shared key. Move to asymmetric keys (RS256/ES256 + JWKS) before other services validate tokens independently.
- Audit events live in `identity.audit_events`; no retention policy or tamper protection yet.
