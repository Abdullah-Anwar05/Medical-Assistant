# MediPath / MediWay web

React 18 + TypeScript + Vite. MediPath patient site at `/`; MediWay staff portal at `/mediway`.
Calls the Identity API through the gateway per `contracts/identity-v1.md`.

## Run

```bash
npm install
cp .env.example .env.local   # set VITE_API_BASE_URL to the gateway, e.g. http://localhost:5000
npm run dev                  # http://localhost:5173
```

## Test / lint / build

```bash
npm test        # Vitest + React Testing Library, API mocked with MSW (src/test/server.ts)
npm run lint
npm run build
```

## Auth design

- Access token is held **in memory only** (React ref in `src/auth/AuthContext.tsx`), never in web storage.
- Refresh token is the HttpOnly `mp_refresh` cookie; all requests use `credentials: 'include'`.
  On load the app calls `POST /refresh` to restore the session, and refreshes 60 s before expiry.
  Concurrent refreshes are de-duplicated (refresh tokens rotate; reuse revokes the family).
- Route guards: `RequireRole` — anonymous → login (returns afterwards), wrong role → `/forbidden`.
  Patient area: `Patient`, `Carer`. MediWay: all staff roles.
- Errors: Problem Details mapped to fixed messages per status (`src/api/errors.ts`), so the UI never
  reveals whether an account exists. 400 `errors` maps onto form fields.

## Gateway requirements

CORS must allow origin `http://localhost:5173` with `Access-Control-Allow-Credentials: true`.
In dev the cookie is `Secure; SameSite=Strict`: run the gateway on `localhost` (cookies on
`localhost` are same-site across ports, and Chrome treats `http://localhost` as a secure context).

## Placeholders

- `TERMS_VERSION` in `src/pages/RegisterPage.tsx` is a placeholder until a terms document exists.
