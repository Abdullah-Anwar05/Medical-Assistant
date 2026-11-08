import { IDENTITY_PATH, type AuthResponse, type LoginRequest, type RegisterRequest, type UserProfile } from './contract';
import { ApiError, NetworkError, readProblem } from './errors';
import type { TokenDelivery } from './tokenDelivery';

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface IdentityClientOptions {
  /** Gateway base URL, e.g. http://localhost:5080 (a trailing slash is ignored). */
  baseUrl: string;
  delivery: TokenDelivery;
  fetchImpl?: FetchLike;
}

export interface IdentityClient {
  register(body: RegisterRequest): Promise<AuthResponse>;
  login(body: LoginRequest): Promise<AuthResponse>;
  /** Rejects with ApiError 401 when no refresh token is held (without calling the API). */
  refresh(): Promise<AuthResponse>;
  logout(accessToken: string): Promise<void>;
  me(accessToken: string): Promise<UserProfile>;
}

interface SendOptions {
  method: 'GET' | 'POST';
  body?: unknown;
  accessToken?: string;
}

/** Typed HTTP client for contracts/identity-v1.md. Holds no session state. */
export function createIdentityClient({ baseUrl, delivery, fetchImpl }: IdentityClientOptions): IdentityClient {
  const root = `${baseUrl.replace(/\/+$/, '')}${IDENTITY_PATH}`;
  const doFetch: FetchLike = fetchImpl ?? ((input, init) => fetch(input, init));

  async function send<T>(path: string, { method, body, accessToken }: SendOptions): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json, application/problem+json', ...delivery.headers };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const res = await doFetch(`${root}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: delivery.credentials,
    }).catch((cause: unknown) => {
      throw new NetworkError(cause);
    });

    if (!res.ok) throw new ApiError(res.status, await readProblem(res));
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  async function authenticate(path: string, body: unknown): Promise<AuthResponse> {
    const res = await send<AuthResponse>(path, { method: 'POST', body });
    await delivery.accept(res);
    return res;
  }

  return {
    register: (body) => authenticate('/register', body),
    login: (body) => authenticate('/login', body),
    async refresh() {
      const body = await delivery.refreshBody();
      if (body === null) throw new ApiError(401, null);
      return authenticate('/refresh', body);
    },
    async logout(accessToken) {
      await send<void>('/logout', { method: 'POST', body: await delivery.logoutBody(), accessToken });
    },
    me: (accessToken) => send<UserProfile>('/me', { method: 'GET', accessToken }),
  };
}
