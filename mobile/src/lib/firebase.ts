/**
 * Firebase client factory for a DLMSF instance.
 *
 * A single APK may connect to different Firebase projects at runtime. The
 * selected instance supplies its public Firebase config; do not assume the
 * build-time EXPO_PUBLIC_* config identifies every installation.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { FirebaseApp, getApps, initializeApp } from "firebase/app";
import * as firebaseAuthExports from "firebase/auth";
import {
  Auth,
  Persistence,
  getAuth,
  initializeAuth,
} from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";

import type { FirebaseClientConfig } from "../config/firebase";

export type FirebaseClient = {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
};

const appNameFor = (projectId: string) => `dlmsf-${projectId}`;

/**
 * Creates or reuses Firebase services for the supplied DLMSF Firebase project.
 * Auth state is persisted using AsyncStorage across app restarts.
 */
export function createFirebaseClient(
  config: FirebaseClientConfig,
): FirebaseClient {
  const appName = appNameFor(config.projectId);
  const existingApp = getApps().find((candidate) => candidate.name === appName);
  const app = existingApp ?? initializeApp(config, appName);

  // Firebase's React Native export is selected by Metro at runtime. Its
  // package-level TypeScript barrel currently exposes the browser typings,
  // so narrow the RN-only export explicitly here.
  const getNativePersistence = (
    (firebaseAuthExports as unknown as {
      getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
    }).getReactNativePersistence
  );

  let auth: Auth;
  try {
    auth = initializeAuth(app, {
      persistence: getNativePersistence(AsyncStorage),
    });
  } catch (error) {
    // A repeated factory call may find Auth already initialized for this app.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "auth/already-initialized"
    ) {
      auth = getAuth(app);
    } else {
      throw error;
    }
  }

  return {
    app,
    auth,
    firestore: getFirestore(app),
  };
}