// Mirrors contracts/identity-v1.md (draft, 2026-11-08). Change only with a contract change.

export type Role =
  | 'Patient'
  | 'Carer'
  | 'Consultant'
  | 'Secretary'
  | 'BookingTeam'
  | 'InsuranceAdmin'
  | 'HospitalManager'
  | 'PlatformAdmin';

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
  /** Present because mobile always sends `X-Client: mobile`. */
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

/** RFC 9457 Problem Details. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>;
}
