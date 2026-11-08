// Types copied from contracts/identity-v1.md (draft 2026-11-08). Do not change without a contract update.

export const ROLES = [
  'Patient',
  'Carer',
  'Consultant',
  'Secretary',
  'BookingTeam',
  'InsuranceAdmin',
  'HospitalManager',
  'PlatformAdmin',
] as const;
export type Role = (typeof ROLES)[number];

export const PATIENT_ROLES: readonly Role[] = ['Patient', 'Carer'];
export const STAFF_ROLES: readonly Role[] = [
  'Consultant',
  'Secretary',
  'BookingTeam',
  'InsuranceAdmin',
  'HospitalManager',
  'PlatformAdmin',
];

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
  organisationId: string | null;
}

export interface AuthResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken?: string; // mobile only; never present for web
  user: UserProfile;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // yyyy-mm-dd
  acceptedTermsVersion: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** RFC 9457 Problem Details, with the ASP.NET validation `errors` extension. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string[]>;
}
