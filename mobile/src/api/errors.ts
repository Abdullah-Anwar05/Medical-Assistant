import type { ProblemDetails } from './types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem: ProblemDetails | null,
  ) {
    super(problem?.title ?? `Request failed (${status})`);
    this.name = 'ApiError';
  }

  /** First message per field from a 400 response, keyed by camelCase field name. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, messages] of Object.entries(this.problem?.errors ?? {})) {
      if (messages.length > 0) out[key.charAt(0).toLowerCase() + key.slice(1)] = messages[0];
    }
    return out;
  }
}

export class NetworkError extends Error {
  constructor() {
    super('Network error');
    this.name = 'NetworkError';
  }
}

export type AuthAction = 'login' | 'register' | 'other';

/**
 * Message shown to the user. Login failures are deliberately generic (no user enumeration):
 * the server's wording is never shown for 401 on login.
 */
export function userMessage(error: unknown, action: AuthAction): string {
  if (error instanceof NetworkError) return 'We could not reach MediPath. Check your connection and try again.';
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.';
  switch (error.status) {
    case 400:
      return 'Please check the highlighted fields.';
    case 401:
      return action === 'login' ? 'Email or password is incorrect.' : 'Your session has ended. Please sign in again.';
    case 409:
      return action === 'register'
        ? 'We could not create an account with these details. If you already have an account, sign in instead.'
        : 'Something went wrong. Please try again.';
    case 423:
      return 'Too many unsuccessful attempts. Please wait 15 minutes and try again.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
