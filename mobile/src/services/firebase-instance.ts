/**
 * Runtime connection to the locally selected DLMSF Firebase instance.
 *
 * This is the boundary between persisted public instance configuration and
 * Firebase SDK services. It does not grant access: Firebase Auth and Firestore
 * Security Rules still decide what the signed-in account can access.
 */

import {
  getSelectedInstance,
  type DLMSFInstanceConfig,
} from "../config/instance";
import { createFirebaseClient, type FirebaseClient } from "../lib/firebase";
import {
  createFirebaseAuthService,
  type FirebaseAuthService,
} from "./firebase-auth";

export type ConnectedFirebaseInstance = {
  config: DLMSFInstanceConfig;
  client: FirebaseClient;
  auth: FirebaseAuthService;
};

/**
 * Connects to the saved instance, or returns null when this installation has
 * not been configured yet. A null result should lead to the instance setup UI.
 */
export async function connectToSelectedFirebaseInstance(): Promise<ConnectedFirebaseInstance | null> {
  const config = await getSelectedInstance();
  if (!config) return null;

  const client = createFirebaseClient(config.firebase);
  const auth = createFirebaseAuthService(
    client.auth,
    client.firestore,
    config.instanceId,
  );

  return {
    config,
    client,
    auth,
  };
}
