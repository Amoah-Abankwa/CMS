import * as SecureStore from 'expo-secure-store';

/** Sign-in tokens live in the phone's secure storage (Keychain on iOS, Keystore on Android), never in plain storage. */
const ACCESS = 'anu.accessToken';
const REFRESH = 'anu.refreshToken';

export const tokenStore = {
  async get() {
    const [accessToken, refreshToken] = await Promise.all([SecureStore.getItemAsync(ACCESS), SecureStore.getItemAsync(REFRESH)]);
    return { accessToken, refreshToken };
  },
  async set(accessToken: string, refreshToken: string) {
    await Promise.all([SecureStore.setItemAsync(ACCESS, accessToken), SecureStore.setItemAsync(REFRESH, refreshToken)]);
  },
  async clear() {
    await Promise.all([SecureStore.deleteItemAsync(ACCESS), SecureStore.deleteItemAsync(REFRESH)]);
  },
};
