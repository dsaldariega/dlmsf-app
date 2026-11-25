/**
 * Firebase Authentication adapter for DLMSF.
 *
 * This adapter is intentionally separate from the currently active Supabase
 * adapter. The app will switch providers only after the Firebase sign-in and
 * membership flows have been integrated and tested.
 *
 * Google OAuth is performed by the native/UI layer. This module accepts the
 * resulting Google ID token and exchanges it for a Firebase session.
 */

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signOut as firebaseSignOut,
  type Auth,
} from "firebase/auth";
import { doc, getDoc, type Firestore } from "firebase/firestore";

import type { MemberRole } from "../lib/auth";
import type {
  AuthIdentity,
  AuthSessionSnapshot,
  AuthStateListener,
} from "./index";

export interface FirebaseAuthService {
  onAuthStateChange(
    listener: AuthStateListener,
  ): { unsubscribe: () => void };
  getSession(): Promise<AuthSessionSnapshot | null>;
  getUser(accessToken: string): Promise<AuthIdentity | null>;
  signInWithGoogleIdToken(idToken: string): Promise<AuthIdentity>;
  signOut(): Promise<void>;
  getMemberRole(userId: string): Promise<MemberRole>;
}

type InstanceConfig = {
  instanceId: string;
  status: "active" | "suspended";
  maintainingAdminUid: string;
};

function isInstanceConfig(value: unknown): value is InstanceConfig {
  if (!value || typeof value !== "object") return false;

  const config = value as Record<string, unknown>;
  return (
    typeof config.instanceId === "string" &&
    typeof config.maintainingAdminUid === "string" &&
    (config.status === "active" || config.status === "suspended")
  );
}

/**
 * Creates an auth adapter scoped to one selected Firebase project/instance.
 * A Google account is not automatically a DLMSF member: access is granted
 * only after its UID is verified against trusted instance configuration or,
 * in a later phase, a trusted member invitation/link.
 */
export function createFirebaseAuthService(
  auth: Auth,
  firestore: Firestore,
  expectedInstanceId: string,
): FirebaseAuthService {
  if (!expectedInstanceId.trim()) {
    throw new Error("A DLMSF instance ID is required for Firebase authentication.");
  }

  return {
    onAuthStateChange(listener) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        listener(user ? "SIGNED_IN" : "SIGNED_OUT");
      });

      return { unsubscribe };
    },

    async getSession() {
      const user = auth.currentUser;
      if (!user) return null;

      return {
        accessToken: await user.getIdToken(),
        userId: user.uid,
      };
    },

    async getUser(_accessToken) {
      // Firebase Auth owns and refreshes its persisted session. Read the
      // current SDK user rather than trying to decode a token on the client.
      const user = auth.currentUser;
      if (!user) return null;

      return {
        id: user.uid,
        email: user.email ?? "",
      };
    },

    async signInWithGoogleIdToken(idToken) {
      if (!idToken.trim()) {
        throw new Error("Google sign-in did not return an ID token.");
      }

      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);

      if (!result.user) {
        throw new Error("Firebase could not retrieve the signed-in account.");
      }

      return {
        id: result.user.uid,
        email: result.user.email ?? "",
      };
    },

    async signOut() {
      await firebaseSignOut(auth);
    },

    async getMemberRole(userId) {
      const user = auth.currentUser;
      if (!user || user.uid !== userId) {
        throw new Error("Your Firebase session is no longer valid. Please sign in again.");
      }

      const configSnapshot = await getDoc(doc(firestore, "system", "config"));
      if (!configSnapshot.exists()) {
        throw new Error("This DLMSF instance has not been initialized by its maintaining admin.");
      }

      const config: unknown = configSnapshot.data();
      if (!isInstanceConfig(config)) {
        throw new Error("The DLMSF instance configuration is invalid.");
      }

      if (config.instanceId !== expectedInstanceId) {
        throw new Error("The selected Firebase project does not match this DLMSF instance.");
      }

      if (config.status !== "active") {
        throw new Error("This DLMSF instance is currently suspended. Contact its maintaining admin.");
      }

      if (config.maintainingAdminUid === user.uid) {
        return "admin";
      }

      // Member UID linking is deliberately not inferred from Google account
      // email. A trusted invitation flow will establish that link in a later
      // phase before member access is enabled.
      throw new Error(
        "This Google account is not the maintaining admin. Member access will be available after invitation setup.",
      );
    },
  };
}
