const KEYCHAIN_SERVICE = "meridian-supabase";

let KeychainModule: {
  setGenericPassword: (username: string, password: string, options?: { service: string; accessGroup?: string }) => Promise<boolean | { service: string; storage: string }>;
  getGenericPassword: (options?: { service: string }) => Promise<false | { username: string; password: string }>;
  resetGenericPassword: (options?: { service: string }) => Promise<boolean>;
} | null = null;

const getKeychain = () => {
  if (KeychainModule) return KeychainModule;
  try {
    KeychainModule = require("react-native-keychain");
  } catch {
    KeychainModule = null;
  }
  return KeychainModule;
};

export async function saveSession(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  const keychain = getKeychain();
  if (keychain) {
    await keychain.setGenericPassword(
      "session",
      JSON.stringify({ accessToken, refreshToken }),
      { service: KEYCHAIN_SERVICE }
    );
  }
}

export async function getSession(): Promise<{ accessToken: string; refreshToken: string } | null> {
  const keychain = getKeychain();
  if (!keychain) return null;
  const result = await keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
  if (!result) return null;
  return JSON.parse(result.password);
}

export async function clearSession(): Promise<void> {
  const keychain = getKeychain();
  if (keychain) {
    await keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
  }
}
