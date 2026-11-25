/**
 * Public Firebase project configuration for the Expo client.
 *
 * Values are supplied through EXPO_PUBLIC_* environment variables because
 * Expo inlines these values into the mobile bundle at build time.
 *
 * Firebase client configuration is not a service-account credential. Access
 * control must be enforced by Firebase Authentication and Security Rules.
 * Never place Firebase Admin SDK credentials or private keys in this file.
 */

export type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  storageBucket?: string;
  measurementId?: string;
};

const firebaseEnvironment = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const hasRequiredFirebaseValues = Boolean(
  firebaseEnvironment.apiKey &&
    firebaseEnvironment.authDomain &&
    firebaseEnvironment.projectId &&
    firebaseEnvironment.messagingSenderId &&
    firebaseEnvironment.appId,
);

/**
 * Returns null until all required Firebase client values are configured.
 * This allows the existing Supabase-backed app to keep running unchanged.
 */
export function getFirebaseClientConfig(): FirebaseClientConfig | null {
  if (!hasRequiredFirebaseValues) return null;

  return {
    apiKey: firebaseEnvironment.apiKey!,
    authDomain: firebaseEnvironment.authDomain!,
    projectId: firebaseEnvironment.projectId!,
    messagingSenderId: firebaseEnvironment.messagingSenderId!,
    appId: firebaseEnvironment.appId!,
    ...(firebaseEnvironment.storageBucket
      ? { storageBucket: firebaseEnvironment.storageBucket }
      : {}),
    ...(firebaseEnvironment.measurementId
      ? { measurementId: firebaseEnvironment.measurementId }
      : {}),
  };
}

export const isFirebaseConfigured = hasRequiredFirebaseValues;