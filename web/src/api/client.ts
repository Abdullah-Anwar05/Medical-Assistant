import type { AuthResponse, LoginRequest, ProblemDetails, RegisterRequest, UserProfile } from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails | null;

  constructor(status: number, problem: ProblemDetails | null) {
    super(problem?.title ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
  }
}

/** Gateway base URL from env (VITE_API_BASE_URL). */
export function apiBaseUrl(): string {
  const url = import.meta.env.VITE_API_BASE_URL;
  if (!url) throw new Error('VITE_API_BASE_URL is not set. Copy .env.example to .env.local.');
  return url.replace(/\/+$/, '');
}

const IDENTITY = '/api/v1/identity';

async function request<T>(path: string, init: RequestInit & { token?: string | null } = {}): Promise<T> {
  const { token, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set('Accept', 'application/json, application/problem+json');
  if (rest.body !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${apiBaseUrl()}${IDENTITY}${path}`, {
    ...rest,
    headers,
    // Required so the browser stores and sends the HttpOnly mp_refresh cookie.
    credentials: 'include',
  });

  if (!res.ok) {
    let problem: ProblemDetails | null = null;
    try {
      problem = (await res.json()) as ProblemDetails;
    } catch {
      problem = null; // non-JSON error body; the status code alone drives the UI
    }
    throw new ApiError(res.status, problem);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const identityApi = {
  register: (body: RegisterRequest) =>
    request<AuthResponse>('/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: LoginRequest) =>
    request<AuthResponse>('/login', { method: 'POST', body: JSON.stringify(body) }),
  refresh: () => request<AuthResponse>('/refresh', { method: 'POST' }),
  logout: (token: string) => request<void>('/logout', { method: 'POST', token }),
  me: (token: string) => request<UserProfile>('/me', { token }),
};
