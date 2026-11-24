import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { supabase } from "./lib/supabase";
import { getMemberRole, type MemberRole } from "./lib/auth";

type AuthenticatedUser = {
  id: string;
  email: string;
  role: MemberRole;
};

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && mounted) {
        setUser(null);
      }
    });

    async function restoreSession() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;
        if (!session) return;

        const {
          data: { user: authUser },
          error: userError,
        } = await supabase.auth.getUser(session.access_token);

        if (userError || !authUser) {
          await supabase.auth.signOut();
          return;
        }

        const role = await getMemberRole(authUser.id);
        if (mounted) {
          setUser({ id: authUser.id, email: authUser.email ?? "", role });
        }
      } catch (restoreError) {
        if (mounted) {
          setError(
            restoreError instanceof Error
              ? restoreError.message
              : "Unable to restore your session. Please sign in again.",
          );
        }
      } finally {
        if (mounted) setInitializing(false);
      }
    }

    void restoreSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignIn() {
    setError("");
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError("Enter your email address and password to continue.");
      return;
    }

    setSubmitting(true);
    try {
      const {
        data: { user: authUser },
        error: signInError,
      } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (signInError) throw signInError;
      if (!authUser) throw new Error("Unable to retrieve your account.");

      let role: MemberRole;
      try {
        role = await getMemberRole(authUser.id);
      } catch (profileError) {
        await supabase.auth.signOut();
        throw profileError;
      }

      setUser({ id: authUser.id, email: authUser.email ?? normalizedEmail, role });
      setPassword("");
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "Sign in failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    setError("");
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
    else setUser(null);
  }

  if (initializing) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <View style={styles.brandMark}>
          <Text style={styles.brandInitials}>DL</Text>
        </View>
        <ActivityIndicator color="#1F604A" size="small" />
        <Text style={styles.loadingText}>Preparing your account…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <View style={styles.brandMark}>
            <Text style={styles.brandInitials}>DL</Text>
          </View>
          <Text style={styles.eyebrow}>DILI LABAD MEMBERS</Text>
          <Text style={styles.title}>Sinking Fund</Text>
          <Text style={styles.subtitle}>
            {user
              ? "Your account is securely connected."
              : "Sign in to access your members account."}
          </Text>

          {user ? (
            <View style={styles.accountCard}>
              <Text style={styles.cardEyebrow}>SIGNED IN AS</Text>
              <Text style={styles.accountEmail}>{user.email}</Text>
              <View style={styles.rolePill}>
                <Text style={styles.roleText}>
                  {user.role === "admin" ? "Administrator" : "Member"}
                </Text>
              </View>
              <Text style={styles.accountNote}>
                Authentication is ready. Your role has been verified against
                your DLMSF member profile.
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={handleSignOut}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Sign out</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Welcome back</Text>
              <Text style={styles.formDescription}>
                Use the same account you use for DLMSF on the web.
              </Text>

              <Text style={styles.label}>Email address</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#98A69F"
                returnKeyType="next"
                style={styles.input}
                value={email}
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="password"
                onChangeText={setPassword}
                onSubmitEditing={handleSignIn}
                placeholder="Enter your password"
                placeholderTextColor="#98A69F"
                returnKeyType="go"
                secureTextEntry
                style={styles.input}
                value={password}
              />

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                accessibilityRole="button"
                disabled={submitting}
                onPress={handleSignIn}
                style={[styles.primaryButton, submitting && styles.disabledButton]}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Sign in</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.securityNote}>
                Your sign-in is handled by Supabase Authentication.
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.footer}>DLMSF · Mobile</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F7F5" },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 64 : 48,
    paddingBottom: 24,
  },
  container: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    flex: 1,
    justifyContent: "center",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F7F5",
  },
  brandMark: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#173D32",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  brandInitials: { color: "#FFFFFF", fontSize: 21, fontWeight: "800", letterSpacing: 1 },
  eyebrow: { color: "#648075", fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  title: { color: "#172D26", fontSize: 38, lineHeight: 46, fontWeight: "800", letterSpacing: -1.2, marginTop: 7 },
  subtitle: { color: "#64736D", fontSize: 15, lineHeight: 23, marginTop: 10, marginBottom: 28 },
  formCard: { backgroundColor: "#FFFFFF", borderRadius: 22, padding: 22, borderWidth: 1, borderColor: "#E7EDE9" },
  formTitle: { color: "#1A3028", fontSize: 21, fontWeight: "800" },
  formDescription: { color: "#738078", fontSize: 13, lineHeight: 20, marginTop: 6, marginBottom: 22 },
  label: { color: "#34483F", fontSize: 12, fontWeight: "700", marginBottom: 8, marginTop: 14 },
  input: { height: 50, borderRadius: 12, borderWidth: 1, borderColor: "#DCE5DF", backgroundColor: "#FBFCFB", paddingHorizontal: 14, color: "#1A3028", fontSize: 14 },
  primaryButton: { height: 52, borderRadius: 13, backgroundColor: "#1B4A3A", alignItems: "center", justifyContent: "center", marginTop: 22 },
  disabledButton: { opacity: 0.65 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  securityNote: { color: "#8A9891", fontSize: 11, textAlign: "center", marginTop: 16 },
  errorBox: { backgroundColor: "#FFF1F0", borderColor: "#F4D2CF", borderWidth: 1, borderRadius: 10, padding: 11, marginTop: 16 },
  errorText: { color: "#A43B32", fontSize: 12, lineHeight: 18 },
  accountCard: { backgroundColor: "#FFFFFF", borderRadius: 22, padding: 22, borderWidth: 1, borderColor: "#E7EDE9" },
  cardEyebrow: { color: "#829088", fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  accountEmail: { color: "#1A3028", fontSize: 16, fontWeight: "700", marginTop: 9 },
  rolePill: { alignSelf: "flex-start", backgroundColor: "#E7F0EA", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, marginTop: 15 },
  roleText: { color: "#315D49", fontSize: 11, fontWeight: "800" },
  accountNote: { color: "#738078", fontSize: 13, lineHeight: 20, marginTop: 20 },
  secondaryButton: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: "#DCE5DF", alignItems: "center", justifyContent: "center", marginTop: 24 },
  secondaryButtonText: { color: "#315D49", fontSize: 13, fontWeight: "800" },
  loadingText: { color: "#738078", fontSize: 13, marginTop: 14 },
  footer: { color: "#91A099", fontSize: 12, fontWeight: "600", textAlign: "center", marginTop: 30 },
});
