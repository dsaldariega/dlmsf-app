/**
 * Local DLMSF instance selection.
 *
 * The same APK can be configured for different Firebase projects. This module
 * stores only public Firebase/OAuth client configuration and a display label;
 * it does not store credentials, member data, or admin privileges.
 *
 * IMPORTANT:
 * - A locally selected instance is NOT proof that the signed-in user belongs
 *   to that instance.
 * - The first maintaining admin must be established by a trusted provisioning
 *   process (Admin SDK / secured setup service), never by the mobile client.
 * - After connecting, the app must verify system/config and the authenticated
 *   user's membership before showing protected data.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { FirebaseClientConfig } from "./firebase";

const SELECTED_INSTANCE_STORAGE_KEY = "@dlmsf/selected-instance";
const INSTANCE_CONFIG_VERSION = 1;

export type GoogleOAuthClientConfig = {
  /** Google OAuth 2.0 client ID registered for the Android application. */
  androidClientId?: string;
  /** Google OAuth 2.0 client ID registered for the iOS application. */
  iosClientId?: string;
  /** Google OAuth 2.0 web client ID, used where the provider flow requires it. */
  webClientId?: string;
};

export type DLMSFInstanceConfig = {
  configVersion: typeof INSTANCE_CONFIG_VERSION;
  instanceId: string;
  displayName: string;
  firebase: FirebaseClientConfig;
  /**
   * OAuth client IDs belong to the Google Cloud project backing this Firebase
   * instance. They are public identifiers, not client secrets.
   */
  googleOAuth?: GoogleOAuthClientConfig;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFirebaseClientConfig(value: unknown): value is FirebaseClientConfig {
  if (!value || typeof value !== "object") return false;

  const config = value as Record<string, unknown>;
  return (
    isNonEmptyString(config.apiKey) &&
    isNonEmptyString(config.authDomain) &&
    isNonEmptyString(config.projectId) &&
    isNonEmptyString(config.messagingSenderId) &&
    isNonEmptyString(config.appId) &&
    (!("storageBucket" in config) ||
      config.storageBucket === undefined ||
      typeof config.storageBucket === "string") &&
    (!("measurementId" in config) ||
      config.measurementId === undefined ||
      typeof config.measurementId === "string")
  );
}

function isGoogleOAuthClientConfig(value: unknown): value is GoogleOAuthClientConfig {
  if (!value || typeof value !== "object") return false;

  const config = value as Record<string, unknown>;
  return (
    Object.keys(config).every((key) =>
      ["androidClientId", "iosClientId", "webClientId"].includes(key),
    ) &&
    Object.values(config).every(
      (clientId) => clientId === undefined || isNonEmptyString(clientId),
    )
  );
}

export function isDLMSFInstanceConfig(
  value: unknown,
): value is DLMSFInstanceConfig {
  if (!value || typeof value !== "object") return false;

  const config = value as Record<string, unknown>;
  return (
    config.configVersion === INSTANCE_CONFIG_VERSION &&
    isNonEmptyString(config.instanceId) &&
    isNonEmptyString(config.displayName) &&
    isFirebaseClientConfig(config.firebase) &&
    (config.googleOAuth === undefined ||
      isGoogleOAuthClientConfig(config.googleOAuth))
  );
}

/**
 * Persist the selected instance's public Firebase and optional OAuth client
 * configuration. The caller should obtain it from a trusted setup flow.
 */
export async function saveSelectedInstance(
  config: DLMSFInstanceConfig,
): Promise<void> {
  if (!isDLMSFInstanceConfig(config)) {
    throw new Error("The DLMSF instance configuration is invalid.");
  }

  const normalized: DLMSFInstanceConfig = {
    ...config,
    instanceId: config.instanceId.trim(),
    displayName: config.displayName.trim(),
    firebase: {
      ...config.firebase,
      apiKey: config.firebase.apiKey.trim(),
      authDomain: config.firebase.authDomain.trim(),
      projectId: config.firebase.projectId.trim(),
      messagingSenderId: config.firebase.messagingSenderId.trim(),
      appId: config.firebase.appId.trim(),
      ...(config.firebase.storageBucket
        ? { storageBucket: config.firebase.storageBucket.trim() }
        : {}),
      ...(config.firebase.measurementId
        ? { measurementId: config.firebase.measurementId.trim() }
        : {}),
    },
    ...(config.googleOAuth
      ? {
          googleOAuth: Object.fromEntries(
            Object.entries(config.googleOAuth)
              .filter(([, clientId]) => Boolean(clientId))
              .map(([key, clientId]) => [key, clientId!.trim()]),
          ) as GoogleOAuthClientConfig,
        }
      : {}),
  };

  await AsyncStorage.setItem(
    SELECTED_INSTANCE_STORAGE_KEY,
    JSON.stringify(normalized),
  );
}

/**
 * Read the locally selected instance. Invalid or outdated stored data is
 * cleared so the app can return to its instance setup flow safely.
 */
export async function getSelectedInstance(): Promise<DLMSFInstanceConfig | null> {
  const stored = await AsyncStorage.getItem(SELECTED_INSTANCE_STORAGE_KEY);
  if (!stored) return null;

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!isDLMSFInstanceConfig(parsed)) {
      await clearSelectedInstance();
      return null;
    }

    return parsed;
  } catch {
    await clearSelectedInstance();
    return null;
  }
}

/** Clear the selected project when the user switches or disconnects instances. */
export async function clearSelectedInstance(): Promise<void> {
  await AsyncStorage.removeItem(SELECTED_INSTANCE_STORAGE_KEY);
}
