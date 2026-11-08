import type { AuthResponse, LoginRequest, RegisterRequest, UserProfile } from './contract';
import { ApiError } from './errors';
import type { IdentityClient } from './identityClient';
import type { TokenDelivery } from './tokenDelivery';

export interface Session {
  accessToken: string;
  /** Epoch milliseconds. */
  accessTokenExpiresAt: number;
  user: UserProfile;
}

export type SessionListener = (session: Session | null) => void;

export interface SessionManagerOptions {
  client: IdentityClient;
  delivery: TokenDelivery;
  /** Refresh this many ms before the access token expires. Omit to disable timed refresh. */
  autoRefreshLeadMs?: number;
  /** Receives failures of a timed refresh other than an ordinary 400/401 sign-out. */
  onBackgroundError?: (error: unknown) => void;
  now?: () => number;
}

/** Never schedule a timed refresh sooner than this. */
const MIN_REFRESH_DELAY_MS = 5_000;

function isRejectedSession(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 400 || error.status === 401);
}

/**
 * Owns the signed-in session: access token in memory only, refresh via the client's token delivery.
 * Refresh is single-flight because the API rotates the refresh token on every use and treats reuse
 * as theft (revoking the whole family), so concurrent callers must share one request.
 */
export class SessionManager {
  private current: Session | null = null;
  private refreshInFlight: Promise<Session | null> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly listeners = new Set<SessionListener>();
  private readonly now: () => number;

  constructor(private readonly opts: SessionManagerOptions) {
    this.now = opts.now ?? Date.now;
  }

  get session(): Session | null {
    return this.current;
  }

  subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async login(body: LoginRequest): Promise<UserProfile> {
    return this.apply(await this.opts.client.login(body)).user;
  }

  async register(body: RegisterRequest): Promise<UserProfile> {
    return this.apply(await this.opts.client.register(body)).user;
  }

  /**
   * Exchanges the refresh token for a new session. Resolves null when the API rejects the token
   * (the normal signed-out state); rejects on network or server errors and keeps local state.
   */
  refresh(): Promise<Session | null> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.doRefresh().finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  /** Revokes the session server-side and always clears it locally; a server failure is rethrown afterwards. */
  async logout(): Promise<void> {
    try {
      if (this.current) await this.withAccessToken((token) => this.opts.client.logout(token));
    } finally {
      await this.discard();
    }
  }

  /** Drops the session locally without calling the API. */
  async discard(): Promise<void> {
    this.cancelTimer();
    this.current = null;
    await this.opts.delivery.clear();
    this.emit();
  }

  /** GET /me, refreshing once if the access token was rejected. */
  me(): Promise<UserProfile> {
    return this.withAccessToken((token) => this.opts.client.me(token));
  }

  /** Runs an authenticated call, refreshing and retrying once if the access token is rejected (401). */
  private async withAccessToken<T>(call: (accessToken: string) => Promise<T>): Promise<T> {
    const session = this.current ?? (await this.refresh());
    if (!session) throw new ApiError(401, null);
    try {
      return await call(session.accessToken);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error;
      const renewed = await this.refresh();
      if (!renewed) throw error;
      return call(renewed.accessToken);
    }
  }

  /** Stops timed refresh; call when the owner unmounts. */
  dispose(): void {
    this.cancelTimer();
    this.listeners.clear();
  }

  private async doRefresh(): Promise<Session | null> {
    try {
      return this.apply(await this.opts.client.refresh());
    } catch (error) {
      if (!isRejectedSession(error)) throw error;
      await this.discard();
      return null;
    }
  }

  private apply(res: AuthResponse): Session {
    this.current = {
      accessToken: res.accessToken,
      accessTokenExpiresAt: Date.parse(res.accessTokenExpiresAt),
      user: res.user,
    };
    this.schedule(this.current.accessTokenExpiresAt);
    this.emit();
    return this.current;
  }

  private schedule(expiresAt: number): void {
    const lead = this.opts.autoRefreshLeadMs;
    if (lead === undefined) return;
    this.cancelTimer();
    const delay = Math.max(expiresAt - this.now() - lead, MIN_REFRESH_DELAY_MS);
    this.timer = setTimeout(() => {
      this.refresh().catch((error: unknown) => this.opts.onBackgroundError?.(error));
    }, delay);
  }

  private cancelTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.current);
  }
}
