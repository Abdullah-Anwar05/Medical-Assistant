import Constants from 'expo-constants';

/**
 * Gateway base URL. On a phone or simulator `localhost` is the device itself, so set
 * EXPO_PUBLIC_API_BASE_URL to the dev machine's LAN IP, e.g. http://192.168.1.20:5080.
 */
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  'http://localhost:5080';

/** Terms version accepted at registration. Placeholder until the terms document exists. */
export const TERMS_VERSION = process.env.EXPO_PUBLIC_TERMS_VERSION ?? '2026-11-draft'; // same placeholder as web
