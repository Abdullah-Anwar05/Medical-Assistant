import type { LoginRequest, RegisterRequest } from './contract';

/** Contract: minimum 12 characters, no other complexity rules (the breached-list check is server-side). */
export const MIN_PASSWORD_LENGTH = 12;

export type FieldErrors = Record<string, string>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A real calendar date in yyyy-mm-dd form (rejects e.g. 1980-02-30). */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Contract: dateOfBirth must be a past date. */
export function isValidPastDate(value: string, today: Date = new Date()): boolean {
  return isValidIsoDate(value) && new Date(`${value}T00:00:00Z`).getTime() < today.getTime();
}

export function isValidEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}

export function validateLogin(input: LoginRequest): FieldErrors {
  const fields: FieldErrors = {};
  if (!input.email.trim()) fields.email = 'Enter your email address.';
  if (!input.password) fields.password = 'Enter your password.';
  return fields;
}

export interface RegisterInput extends Omit<RegisterRequest, 'acceptedTermsVersion'> {
  acceptedTerms: boolean;
}

/** Trims every text field except the password (spaces are valid password characters). */
export function normalizeRegisterInput(input: RegisterInput): RegisterInput {
  return {
    ...input,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim(),
    dateOfBirth: input.dateOfBirth.trim(),
  };
}

export function validateRegister(raw: RegisterInput, today: Date = new Date()): FieldErrors {
  const input = normalizeRegisterInput(raw);
  const fields: FieldErrors = {};
  if (!input.firstName) fields.firstName = 'Enter your first name.';
  if (!input.lastName) fields.lastName = 'Enter your last name.';
  if (!input.email) fields.email = 'Enter your email address.';
  else if (!isValidEmail(input.email)) fields.email = 'Enter a valid email address.';
  if (!isValidIsoDate(input.dateOfBirth)) fields.dateOfBirth = 'Enter your date of birth.';
  else if (!isValidPastDate(input.dateOfBirth, today)) fields.dateOfBirth = 'Date of birth must be in the past.';
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    fields.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!input.acceptedTerms) fields.terms = 'You must accept the terms to continue.';
  return fields;
}

export function hasErrors(fields: FieldErrors): boolean {
  return Object.keys(fields).length > 0;
}
