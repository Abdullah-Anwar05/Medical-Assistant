# Identity API — v1 contract (draft, 2026-11-08)

Owner: API thread. Consumers: web, mobile. Base path through the gateway: `/api/v1/identity`.
All bodies are JSON, camelCase. Errors use RFC 9457 Problem Details (`application/problem+json`).

## Roles

`Patient`, `Carer`, `Consultant`, `Secretary`, `BookingTeam`, `InsuranceAdmin`, `HospitalManager`, `PlatformAdmin`.
Patients self-register. Staff accounts are created by a `PlatformAdmin` (invite flow comes later).
Staff users belong to an `organisationId` (tenancy); patients do not.

## Tokens

- Access token: JWT, 15 minutes, `Authorization: Bearer <token>`. Claims: `sub`, `email`, `role` (one or more), `org` (staff only).
- Refresh token: opaque, 14 days, rotated on every refresh, revoked on logout. Reuse of a revoked token revokes the whole family.
- Delivery depends on the `X-Client` request header:
  - `X-Client: mobile` → `refreshToken` returned in the response body (store in iOS Keychain via `expo-secure-store`).
  - otherwise (web) → refresh token set as an `HttpOnly; Secure; SameSite=Strict` cookie `mp_refresh`, scoped to `/api/v1/identity`; omitted from the body. Web keeps the access token in memory only.

## Endpoints

| Method | Path | Auth | Body | Success |
|---|---|---|---|---|
| POST | `/register` | none | `{ email, password, firstName, lastName, dateOfBirth (yyyy-mm-dd), acceptedTermsVersion }` | 201 `AuthResponse` |
| POST | `/login` | none | `{ email, password }` | 200 `AuthResponse` |
| POST | `/refresh` | refresh token (body `{ refreshToken }` for mobile, cookie for web) | — | 200 `AuthResponse` |
| POST | `/logout` | Bearer | mobile: `{ refreshToken }` | 204 |
| GET | `/me` | Bearer | — | 200 `UserProfile` |

```jsonc
// AuthResponse
{ "accessToken": "…", "accessTokenExpiresAt": "2026-11-08T12:15:00Z",
  "refreshToken": "…",            // mobile only
  "user": UserProfile }

// UserProfile
{ "id": "uuid", "email": "…", "firstName": "…", "lastName": "…",
  "roles": ["Patient"], "organisationId": null }
```

## Rules

- Password: minimum 12 characters; checked against a breached/common list. No other complexity rules.
- Login failure always returns 401 with the same message (no user enumeration). Lockout after 5 failures for 15 minutes.
- Every login, failed login, refresh, logout and registration writes an audit event.
- MFA, email verification, password reset and staff invites: later contract versions (v1.1+).

## Behaviour details (clarified by API thread, 2026-11-08)

- Lockout counts failures per email address, including emails with no account, so `423` never reveals whether an account exists. The 5th failure itself returns `401`; attempts during the next 15 minutes return `423`, even with the correct password. A successful login resets the count.
- `/refresh` and `/logout` read the refresh token from the body **only** when `X-Client: mobile`; otherwise only from the `mp_refresh` cookie. Web must send requests with `credentials: 'include'`.
- `/refresh` failure (missing, unknown, expired, revoked or reused token) → `401`; web also gets the cookie cleared. Reuse revokes every token from that login.
- `/logout` revokes every token from that login (the session), clears the cookie on web, and returns `204` even if no refresh token is sent.
- `409` on `/register` reveals that an email is registered. It stays in v1 by decision (2026-11-08). **v1.1 change:** `/register` returns `202` whether or not the email exists and sends a verification email; tokens are issued only after verification.
- `/register` returns `Location: /api/v1/identity/me`. Email is unique case-insensitively. `dateOfBirth` must be a past date.
- `UserProfile.roles` for a self-registered user is `["Patient"]`. The `role` JWT claim is a string with one role and an array with several.
- Dev gateway: `http://localhost:5080`; CORS allows `http://localhost:5173` with credentials and the headers `Authorization`, `Content-Type`, `X-Client`.

## Status codes

400 validation (Problem Details with `errors` map) · 401 bad credentials/expired token · 409 email already registered · 423 locked out · 429 rate limited.
