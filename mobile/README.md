# MediPath mobile (patient app)

Expo SDK 58, React Native, TypeScript and expo-router. The app targets iOS first. It implements Identity v1 (`../contracts/identity-v1.md`): register, sign in and sign out.

## Setup

```bash
npm install
```

`.npmrc` sets `legacy-peer-deps=true` because of an optional peer conflict between `react-dom` and React 19.3. Add packages with `npx expo install <pkg>`.

## Gateway URL

The client reads the gateway URL in this order: `EXPO_PUBLIC_API_BASE_URL`, then `app.json` `expo.extra.apiBaseUrl` (default `http://localhost:5080`).
On a phone, `localhost` refers to the phone itself, so use the dev machine's LAN IP. The gateway currently binds localhost only (ask the API thread for 0.0.0.0) and Windows Firewall must allow the port:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.20:5080 npx expo start
```

In PowerShell, run `$env:EXPO_PUBLIC_API_BASE_URL='http://192.168.1.20:5080'; npx expo start`.

## Running on iOS from Windows

There's no iOS simulator on Windows, so use one of these:
- **Expo Go on an iPhone:** run `npx expo start` and scan the QR code. The phone and the PC must be on the same network. You can also use `npx expo start --tunnel`, but the API URL still has to be reachable from the phone.
- **EAS build:** run `npx eas build -p ios --profile development`. It needs an Apple developer account and an `eas.json`, which isn't added yet.

## Checks

```bash
npm run typecheck
npm run lint
npm test
```

## Design

- `src/api/client.ts` is a typed client. It always sends `X-Client: mobile`. The access token stays in memory only. The refresh token goes to the Keychain through `expo-secure-store` (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`). On a 401 the client refreshes once and retries the request. Refresh is single-flight because the server rotates the token and reuse revokes the whole token family. A 400 or 401 from refresh signs the user out. A network error keeps the stored token.
- The app restores the session from the Keychain on launch. When it resumes, it refreshes if the access token expires within 60 seconds.
- Error handling follows `src/api/errors.ts`. A 401 on login always shows "Email or password is incorrect." Server wording is never shown, so the app doesn't reveal whether an account exists. Field errors from a 400 Problem Details response appear next to their fields.
- `src/theme.ts` sets the theme: navy and teal on pale neutrals, with AA contrast. Line heights aren't fixed, so text scales with Dynamic Type. Touch targets are at least 44pt, and errors are announced as alerts.
- Tests use Jest with jest-expo and React Native Testing Library 14. In RNTL 14, `render` and `fireEvent` are async, so tests must await them. The API is mocked through an injected `fetch`. All data is synthetic.
