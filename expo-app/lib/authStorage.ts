import * as SecureStore from 'expo-secure-store';

const AUTH_KEY = 'auth_data';

type AuthData = {
  access_token: string;
  refresh_token: string;
};

export const saveAuthData = async (data: AuthData) => {
  try {
    await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving auth data:', error);
  }
};

export const getAuthData = async (): Promise<AuthData | null> => {
  try {
    // Workaround for some emulators: force SecureStore to use a fallback if available
    // and add a timeout to avoid hanging forever
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 4000)
    );
    const getItemPromise = SecureStore.getItemAsync(AUTH_KEY);

    const data = await Promise.race([getItemPromise, timeoutPromise]);
    if (data === null) {
      // Timeout or no data
      return null;
    }
    return JSON.parse(data as string);
  } catch (error) {
    console.error('Error getting auth data:', error);
    return null;
  }
};

export const removeAuthData = async () => {
  try {
    await SecureStore.deleteItemAsync(AUTH_KEY);
  } catch (error) {
    console.error('Error removing auth data:', error);
  }
};
