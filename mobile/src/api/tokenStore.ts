import type { RefreshTokenStorage } from '@medipath/client-core';
import * as SecureStore from 'expo-secure-store';

const KEY = 'medipath.refreshToken';

/** iOS Keychain via expo-secure-store; this-device-only, so it is not restored to another device. */
export const secureRefreshTokenStore: RefreshTokenStorage = {
  get: () => SecureStore.getItemAsync(KEY),
  set: (token) =>
    SecureStore.setItemAsync(KEY, token, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }),
  clear: () => SecureStore.deleteItemAsync(KEY),
};
