import type { ProblemDetails } from './contract';

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

/** The request never reached the API (offline, DNS failure, CORS rejection). */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('Network error', { cause });
    this.name = 'NetworkError';
  }
}

function isJson(contentType: string | null): boolean {
  return contentType !== null && /\bjson\b/i.test(contentType);
}

/** Problem Details body of a failed response; null when the body is not JSON, empty or malformed. */
export async function readProblem(res: Response): Promise<ProblemDetails | null> {
  if (!isJson(res.headers.get('Content-Type'))) return null;
  try {
    return (await res.json()) as ProblemDetails;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

/** Field errors from a 400 Problem Details, keyed by camelCase field name. */
export function problemFieldErrors(problem: ProblemDetails | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, messages] of Object.entries(problem?.errors ?? {})) {
    // ASP.NET may send PascalCase keys ("Password") or JSON paths ("$.password").
    const name = key.replace(/^\$\./, '');
    const camel = name.charAt(0).toLowerCase() + name.slice(1);
    if (messages.length) out[camel] = messages.join(' ');
  }
  return out;
}
