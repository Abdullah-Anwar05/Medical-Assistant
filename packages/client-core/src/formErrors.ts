import { ApiError, NetworkError, problemFieldErrors } from './errors';

const GENERIC_MESSAGE = 'Something went wrong on our side. Please try again.';

export interface FormError {
  /** Summary shown at the top of the form. */
  message: string;
  /** Field-level messages keyed by camelCase field name. */
  fields: Record<string, string>;
}

export type AuthFlow = 'login' | 'register';

export const CORRECT_FIELDS_MESSAGE = 'Please correct the highlighted fields.';

/**
 * Maps an API failure to user-facing text. Messages are fixed per status rather than echoing
 * server text, so the UI never reveals whether an account exists (no user enumeration).
 */
export function toFormError(err: unknown, flow: AuthFlow): FormError {
  if (err instanceof NetworkError) {
    return { message: 'We could not reach MediPath. Check your connection and try again.', fields: {} };
  }
  if (!(err instanceof ApiError)) return { message: GENERIC_MESSAGE, fields: {} };
  switch (err.status) {
    case 400:
      return { message: CORRECT_FIELDS_MESSAGE, fields: problemFieldErrors(err.problem) };
    case 401:
      // Only login can fail on credentials.
      return { message: flow === 'login' ? 'Email or password is incorrect.' : GENERIC_MESSAGE, fields: {} };
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
      return { message: GENERIC_MESSAGE, fields: {} };
  }
}
