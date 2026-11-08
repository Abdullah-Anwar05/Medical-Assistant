// Types from contracts/identity-v1.md (draft 2026-11-08). Change only together with the contract.

export const IDENTITY_PATH = '/api/v1/identity';

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
  /** Present only for `X-Client: mobile`. */
  refreshToken?: string;
  user: UserProfile;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  /** yyyy-mm-dd */
  dateOfBirth: string;
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

export function hasAnyRole(user: UserProfile | null, roles: readonly Role[]): boolean {
  return user !== null && user.roles.some((r) => roles.includes(r));
}

export function isStaff(user: UserProfile): boolean {
  return hasAnyRole(user, STAFF_ROLES);
}
