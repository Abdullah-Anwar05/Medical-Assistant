import { ApiError } from './client';

export interface FormError {
  /** Summary shown at the top of the form. */
  message: string;
  /** Field-level messages keyed by camelCase field name. */
  fields: Record<string, string>;
}

type Flow = 'login' | 'register';

/**
 * Maps an API failure to user-facing text. Messages are fixed per status rather than echoing
 * server text, so the UI can never reveal whether an account exists (no user enumeration).
 */
export function toFormError(err: unknown, flow: Flow): FormError {
  if (!(err instanceof ApiError)) {
    return { message: 'We could not reach MediPath. Check your connection and try again.', fields: {} };
  }
  switch (err.status) {
    case 400:
      return { message: 'Please correct the highlighted fields.', fields: fieldErrors(err.problem?.errors) };
    case 401:
      return { message: 'Email or password is incorrect.', fields: {} };
    case 409:
      // Deliberately neutral: does not confirm that this email is registered.
      return {
        message: 'We could not create an account with these details. If you already have an account, sign in instead.',
        fields: {},
      };
    case 423:
      return {
        message:
          flow === 'login'
            ? 'Email or password is incorrect, or sign-in is temporarily locked. Please try again in 15 minutes.'
            : 'Please try again later.',
        fields: {},
      };
    case 429:
      return { message: 'Too many attempts. Please wait a moment and try again.', fields: {} };
    default:
      return { message: 'Something went wrong on our side. Please try again.', fields: {} };
  }
}

function fieldErrors(errors: Record<string, string[]> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!errors) return out;
  for (const [key, messages] of Object.entries(errors)) {
    // ASP.NET may send PascalCase keys ("Password") or paths ("$.password").
    const name = key.replace(/^\$\./, '');
    const camel = name.charAt(0).toLowerCase() + name.slice(1);
    if (messages.length) out[camel] = messages.join(' ');
  }
  return out;
}
