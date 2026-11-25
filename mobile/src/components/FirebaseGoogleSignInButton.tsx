import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useIdTokenAuthRequest } from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

import {
  getSelectedInstance,
  type DLMSFInstanceConfig,
} from "../config/instance";
import {
  connectToSelectedFirebaseInstance,
} from "../services/firebase-instance";
import type { FirebaseAuthService } from "../services/firebase-auth";

WebBrowser.maybeCompleteAuthSession();

type Props = {
  refreshKey: number;
};

type FirebaseSignedInUser = {
  email: string;
  instanceName: string;
};

export default function FirebaseGoogleSignInButton({ refreshKey }: Props) {
  const [config, setConfig] = useState<DLMSFInstanceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");

    getSelectedInstance()
      .then((savedConfig) => {
        if (active) setConfig(savedConfig);
      })
      .catch((error) => {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load the selected Firebase instance.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#1D4ED8" />
        <Text style={styles.helper}>Loading Firebase sign-in configuration…</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{loadError}</Text>
      </View>
    );
  }

  if (!config) {
    return (
      <View style={styles.container}>
        <Text style={styles.helper}>
          Configure a Firebase instance and Google OAuth client IDs to test Firebase sign-in.
        </Text>
      </View>
    );
  }

  const platformClientId =
    Platform.OS === "android"
      ? config.googleOAuth?.androidClientId
      : Platform.OS === "ios"
        ? config.googleOAuth?.iosClientId
        : config.googleOAuth?.webClientId;

  if (!platformClientId?.trim()) {
    const platformName =
      Platform.OS === "android"
        ? "Android"
        : Platform.OS === "ios"
          ? "iOS"
          : "Web";

    return (
      <View style={styles.container}>
        <Text style={styles.helper}>
          Add the {platformName} Google OAuth client ID in Firebase instance settings to enable Google sign-in on this device.
        </Text>
      </View>
    );
  }

  return <ConfiguredGoogleSignIn key={config.instanceId + platformClientId} config={config} />;
}

function ConfiguredGoogleSignIn({ config }: { config: DLMSFInstanceConfig }) {
  const [request, , promptAsync] = useIdTokenAuthRequest(
    {
      androidClientId: config.googleOAuth?.androidClientId,
      iosClientId: config.googleOAuth?.iosClientId,
      webClientId: config.googleOAuth?.webClientId,
      scopes: ["openid", "profile", "email"],
      selectAccount: true,
    },
    { scheme: "dlmsf" },
  );

  const [busy, setBusy] = useState(false);
  const [firebaseAuth, setFirebaseAuth] = useState<FirebaseAuthService | null>(null);
  const [signedInUser, setSignedInUser] = useState<FirebaseSignedInUser | null>(null);
  const [error, setError] = useState("");

  async function handleGoogleSignIn() {
    setBusy(true);
    setError("");

    try {
      const result = await promptAsync();

      if (result.type !== "success") {
        if (result.type === "cancel" || result.type === "dismiss") return;
        throw new Error("Google sign-in could not be completed. Please try again.");
      }

      const idToken =
        result.authentication?.idToken ?? result.params?.id_token;

      if (!idToken) {
        throw new Error(
          "Google did not return an ID token. Check the OAuth client IDs configured for this Firebase instance.",
        );
      }

      const instance = await connectToSelectedFirebaseInstance();
      if (!instance) {
        throw new Error("Configure a Firebase instance before signing in.");
      }

      const identity = await instance.auth.signInWithGoogleIdToken(idToken);
      setFirebaseAuth(instance.auth);
      setSignedInUser({
        email: identity.email || "Google account",
        instanceName: instance.config.displayName,
      });
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "Firebase Google sign-in failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleFirebaseSignOut() {
    if (!firebaseAuth) return;

    setBusy(true);
    setError("");
    try {
      await firebaseAuth.signOut();
      setFirebaseAuth(null);
      setSignedInUser(null);
    } catch (signOutError) {
      setError(
        signOutError instanceof Error
          ? signOutError.message
          : "Unable to sign out of Firebase.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>FIREBASE AUTHENTICATION TEST</Text>
      {signedInUser ? (
        <>
          <Text style={styles.success}>
            Firebase signed in: {signedInUser.email}
          </Text>
          <Text style={styles.helper}>
            Instance: {signedInUser.instanceName}. This confirms authentication only; it does not grant DLMSF access or switch the app's data provider.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={busy}
            onPress={handleFirebaseSignOut}
            style={[styles.secondaryButton, busy && styles.disabled]}
          >
            {busy ? (
              <ActivityIndicator color="#1D4ED8" />
            ) : (
              <Text style={styles.secondaryButtonText}>Sign out of Firebase test</Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity
          accessibilityRole="button"
          disabled={!request || busy}
          onPress={handleGoogleSignIn}
          style={[styles.googleButton, (!request || busy) && styles.disabled]}
        >
          {busy ? (
            <ActivityIndicator color="#1E293B" />
          ) : (
            <Text style={styles.googleButtonText}>
              {request ? "Continue with Google (Firebase test)" : "Preparing Google sign-in…"}
            </Text>
          )}
        </TouchableOpacity>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!signedInUser ? (
        <Text style={styles.helper}>
          Test only. Your existing Supabase login and DLMSF data remain unchanged.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    gap: 8,
  },
  sectionLabel: {
    color: "#64748B",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  googleButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  googleButtonText: {
    color: "#1E293B",
    fontSize: 12,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: "#1D4ED8",
    fontSize: 11,
    fontWeight: "800",
  },
  helper: {
    color: "#64748B",
    fontSize: 10,
    lineHeight: 15,
  },
  success: {
    color: "#166534",
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16,
  },
  error: {
    color: "#B91C1C",
    fontSize: 11,
    lineHeight: 16,
  },
  disabled: {
    opacity: 0.55,
  },
});
