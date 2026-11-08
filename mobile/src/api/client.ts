import { IDENTITY_PATH } from '../config';
import { ApiError, NetworkError } from './errors';
import type { RefreshTokenStore } from './tokenStore';
import type { AuthResponse, LoginRequest, ProblemDetails, RegisterRequest, UserProfile } from './types';

export interface Session {
  accessToken: string;
  accessTokenExpiresAt: number;
  user: UserProfile;
}

export type SessionListener = (session: Session | null) => void;

export interface ApiClientOptions {
  baseUrl: string;
  tokenStore: RefreshTokenStore;
  fetchImpl?: typeof fetch;
}

/**
 * Typed client for the Identity v1 contract. The access token lives only in memory;
 * the refresh token lives only in the token store (Keychain).
 */
export class ApiClient {
  private session: Session | null = null;
  private refreshInFlight: Promise<Session | null> | null = null;
  private listeners = new Set<SessionListener>();
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: ApiClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  get currentSession(): Session | null {
    return this.session;
  }

  /** Subscribe to session changes (null = signed out, including a rejected refresh). */
  subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async register(body: RegisterRequest): Promise<UserProfile> {
    const res = await this.send<AuthResponse>('POST', '/register', body);
    return (await this.acceptAuth(res)).user;
  }

  async login(body: LoginRequest): Promise<UserProfile> {
    const res = await this.send<AuthResponse>('POST', '/login', body);
    return (await this.acceptAuth(res)).user;
  }

  /** Revokes the refresh token server-side (best effort) and always clears local state. */
  async logout(): Promise<void> {
    const refreshToken = await this.opts.tokenStore.get();
    try {
      if (refreshToken) await this.authed('POST', '/logout', { refreshToken });
    } catch {
      // Local sign-out must succeed even if the server is unreachable.
    } finally {
      await this.clear();
    }
  }

  me(): Promise<UserProfile> {
    return this.authed<UserProfile>('GET', '/me');
  }

  /**
   * Exchanges the stored refresh token for a new session. Single-flight: the server rotates the
   * token on every refresh and reuse revokes the whole family, so concurrent callers share one request.
   */
  refresh(): Promise<Session | null> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.doRefresh().finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  /** True if there is a session whose access token expires within `skewMs`. */
  isExpiringSoon(skewMs = 60_000, now = Date.now()): boolean {
    return this.session !== null && this.session.accessTokenExpiresAt - now <= skewMs;
  }

  private async doRefresh(): Promise<Session | null> {
    const refreshToken = await this.opts.tokenStore.get();
    if (!refreshToken) {
      await this.clear();
      return null;
    }
    try {
      const res = await this.send<AuthResponse>('POST', '/refresh', { refreshToken });
      return await this.acceptAuth(res);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 400 || e.status === 401)) {
        await this.clear();
        return null;
      }
      throw e; // network or 5xx: keep the stored token so a later attempt can succeed
    }
  }

  private async authed<T>(method: string, path: string, body?: unknown): Promise<T> {
    let session = this.session ?? (await this.refresh());
    if (!session) throw new ApiError(401, null);
    try {
      return await this.send<T>(method, path, body, session.accessToken);
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) throw e;
      session = await this.refresh();
      if (!session) throw e;
      return this.send<T>(method, path, body, session.accessToken);
    }
  }

  private async acceptAuth(res: AuthResponse): Promise<Session> {
    if (!res.refreshToken) throw new Error('Identity API returned no refresh token for X-Client: mobile');
    await this.opts.tokenStore.set(res.refreshToken);
    this.session = {
      accessToken: res.accessToken,
      accessTokenExpiresAt: Date.parse(res.accessTokenExpiresAt),
      user: res.user,
    };
    this.emit();
    return this.session;
  }

  private async clear(): Promise<void> {
    this.session = null;
    await this.opts.tokenStore.clear();
    this.emit();
  }

  private emit(): void {
    for (const l of this.listeners) l(this.session);
  }

  private async send<T>(method: string, path: string, body?: unknown, accessToken?: string): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Client': 'mobile' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    let res: Response;
    try {
      res = await this.fetchImpl(`${this.opts.baseUrl}${IDENTITY_PATH}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new NetworkError();
    }

    if (!res.ok) {
      let problem: ProblemDetails | null = null;
      try {
        problem = (await res.json()) as ProblemDetails;
      } catch {
        problem = null;
      }
      throw new ApiError(res.status, problem);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}
