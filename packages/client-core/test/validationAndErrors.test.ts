import { hasAnyRole, isStaff, PATIENT_ROLES, ROLES, STAFF_ROLES } from '../src/contract';
import { ApiError, NetworkError, problemFieldErrors, readProblem } from '../src/errors';
import { toFormError } from '../src/formErrors';
import { palette, paletteCssVariables } from '../src/palette';
import {
  hasErrors,
  isValidPastDate,
  MIN_PASSWORD_LENGTH,
  normalizeRegisterInput,
  validateLogin,
  validateRegister,
} from '../src/validation';
import { makeUser } from './helpers';

const VALID_REGISTER = {
  firstName: 'Testy',
  lastName: 'Synthetic',
  email: 'test.patient@example.test',
  dateOfBirth: '1990-01-01',
  password: 'a'.repeat(MIN_PASSWORD_LENGTH),
  acceptedTerms: true,
};

describe('roles', () => {
  it('splits every role into exactly one of patient or staff', () => {
    expect([...PATIENT_ROLES, ...STAFF_ROLES].sort()).toEqual([...ROLES].sort());
  });

  it('detects staff and role membership', () => {
    expect(isStaff(makeUser(['PlatformAdmin']))).toBe(true);
    expect(isStaff(makeUser(['Patient']))).toBe(false);
    expect(hasAnyRole(null, PATIENT_ROLES)).toBe(false);
  });
});

describe('validators', () => {
  it('requires login email and password', () => {
    expect(validateLogin({ email: '', password: '' })).toEqual({
      email: 'Enter your email address.',
      password: 'Enter your password.',
    });
  });

  it('accepts a valid registration', () => {
    expect(hasErrors(validateRegister(VALID_REGISTER))).toBe(false);
  });

  it('enforces the 12-character minimum exactly', () => {
    expect(validateRegister({ ...VALID_REGISTER, password: 'a'.repeat(11) }).password).toBe(
      'Password must be at least 12 characters.',
    );
  });

  it('flags missing fields, a non-ISO date and unaccepted terms', () => {
    const fields = validateRegister({
      ...VALID_REGISTER,
      firstName: '',
      lastName: '',
      email: '',
      dateOfBirth: '01/01/1990',
      acceptedTerms: false,
    });
    expect(Object.keys(fields).sort()).toEqual(['dateOfBirth', 'email', 'firstName', 'lastName', 'terms']);
  });

  it('rejects impossible and future dates of birth', () => {
    const today = new Date('2026-11-09T12:00:00Z');
    expect(validateRegister({ ...VALID_REGISTER, dateOfBirth: '1980-02-30' }, today).dateOfBirth).toBe(
      'Enter your date of birth.',
    );
    expect(validateRegister({ ...VALID_REGISTER, dateOfBirth: '2030-01-01' }, today).dateOfBirth).toBe(
      'Date of birth must be in the past.',
    );
    expect(isValidPastDate('2026-11-09', today)).toBe(true);
    expect(isValidPastDate('2026-11-10', today)).toBe(false);
  });

  it('checks email format after trimming', () => {
    expect(validateRegister({ ...VALID_REGISTER, email: 'not-an-email' }).email).toBe('Enter a valid email address.');
    expect(validateRegister({ ...VALID_REGISTER, email: '  test.patient@example.test  ' }).email).toBeUndefined();
  });

  it('treats whitespace-only names and email as missing, and trims text but not the password', () => {
    const fields = validateRegister({ ...VALID_REGISTER, firstName: '   ', lastName: ' ', email: '  ' });
    expect(fields).toMatchObject({ firstName: 'Enter your first name.', email: 'Enter your email address.' });
    expect(validateLogin({ email: '  ', password: 'x' }).email).toBe('Enter your email address.');
    const normalized = normalizeRegisterInput({ ...VALID_REGISTER, firstName: ' Testy ', password: ' pass phrase ' });
    expect(normalized.firstName).toBe('Testy');
    expect(normalized.password).toBe(' pass phrase ');
  });
});

describe('readProblem', () => {
  it('returns null for an empty or malformed JSON error body', async () => {
    const headers = { 'Content-Type': 'application/problem+json' };
    expect(await readProblem(new Response('', { status: 500, headers }))).toBeNull();
    expect(await readProblem(new Response('{not json', { status: 500, headers }))).toBeNull();
  });
});

describe('error mapping', () => {
  it('camel-cases Problem Details field keys and JSON paths', () => {
    expect(problemFieldErrors({ errors: { Password: ['Too short.', 'Common.'], '$.email': ['Bad.'], Empty: [] } })).toEqual({
      password: 'Too short. Common.',
      email: 'Bad.',
    });
  });

  it('uses one generic login message for 401 regardless of server text', () => {
    expect(toFormError(new ApiError(401, { title: 'No such user' }), 'login').message).toBe(
      'Email or password is incorrect.',
    );
  });

  it('keeps 409 neutral and 423 flow-specific', () => {
    expect(toFormError(new ApiError(409, null), 'register').message).not.toMatch(/already registered/i);
    expect(toFormError(new ApiError(423, null), 'login').message).toMatch(/15 minutes/);
    expect(toFormError(new ApiError(423, null), 'register').message).toBe('Please try again later.');
  });

  it('maps network failures to a connection message', () => {
    expect(toFormError(new NetworkError(new TypeError('x')), 'login').message).toMatch(/could not reach/);
  });

  it('maps unexpected non-API errors to the generic message, not the connection one', () => {
    expect(toFormError(new SyntaxError('bad body'), 'login').message).toBe(
      'Something went wrong on our side. Please try again.',
    );
  });

  it('does not blame credentials for a 401 during registration', () => {
    expect(toFormError(new ApiError(401, null), 'register').message).toBe(
      'Something went wrong on our side. Please try again.',
    );
  });
});

describe('palette', () => {
  it('exposes CSS variables under the --color- prefix', () => {
    const vars = paletteCssVariables();
    expect(vars['--color-navy-900']).toBe(palette.navy900);
    expect(vars['--color-error-bg']).toBe(palette.errorBg);
    expect(vars['--color-neutral-50']).toBe(palette.neutral50);
    expect(Object.keys(vars)).toHaveLength(Object.keys(palette).length);
  });
});
