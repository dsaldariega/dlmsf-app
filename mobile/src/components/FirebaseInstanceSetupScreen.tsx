import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  getSelectedInstance,
  saveSelectedInstance,
  type DLMSFInstanceConfig,
} from "../config/instance";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
};

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  optional?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
};

function ConfigField({
  label,
  value,
  onChangeText,
  placeholder,
  optional = false,
  secureTextEntry = false,
  autoCapitalize = "none",
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}{optional ? " (optional)" : ""}
      </Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        secureTextEntry={secureTextEntry}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

export default function FirebaseInstanceSetupScreen({
  visible,
  onClose,
  onSaved,
}: Props) {
  const [instanceId, setInstanceId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [authDomain, setAuthDomain] = useState("");
  const [projectId, setProjectId] = useState("");
  const [messagingSenderId, setMessagingSenderId] = useState("");
  const [appId, setAppId] = useState("");
  const [storageBucket, setStorageBucket] = useState("");
  const [measurementId, setMeasurementId] = useState("");
  const [androidClientId, setAndroidClientId] = useState("");
  const [iosClientId, setIosClientId] = useState("");
  const [webClientId, setWebClientId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!visible) return;

    let active = true;
    setError("");
    setSuccess("");
    setLoading(true);

    getSelectedInstance()
      .then((config) => {
        if (!active || !config) return;
        setInstanceId(config.instanceId);
        setDisplayName(config.displayName);
        setApiKey(config.firebase.apiKey);
        setAuthDomain(config.firebase.authDomain);
        setProjectId(config.firebase.projectId);
        setMessagingSenderId(config.firebase.messagingSenderId);
        setAppId(config.firebase.appId);
        setStorageBucket(config.firebase.storageBucket ?? "");
        setMeasurementId(config.firebase.measurementId ?? "");
        setAndroidClientId(config.googleOAuth?.androidClientId ?? "");
        setIosClientId(config.googleOAuth?.iosClientId ?? "");
        setWebClientId(config.googleOAuth?.webClientId ?? "");
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load the saved configuration.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [visible]);

  async function handleSave() {
    setError("");
    setSuccess("");

    const required = [
      instanceId,
      displayName,
      apiKey,
      authDomain,
      projectId,
      messagingSenderId,
      appId,
    ];

    if (required.some((value) => !value.trim())) {
      setError("Complete all required instance and Firebase fields.");
      return;
    }

    const config: DLMSFInstanceConfig = {
      configVersion: 1,
      instanceId: instanceId.trim(),
      displayName: displayName.trim(),
      firebase: {
        apiKey: apiKey.trim(),
        authDomain: authDomain.trim(),
        projectId: projectId.trim(),
        messagingSenderId: messagingSenderId.trim(),
        appId: appId.trim(),
        ...(storageBucket.trim() ? { storageBucket: storageBucket.trim() } : {}),
        ...(measurementId.trim() ? { measurementId: measurementId.trim() } : {}),
      },
      googleOAuth: {
        ...(androidClientId.trim() ? { androidClientId: androidClientId.trim() } : {}),
        ...(iosClientId.trim() ? { iosClientId: iosClientId.trim() } : {}),
        ...(webClientId.trim() ? { webClientId: webClientId.trim() } : {}),
      },
    };

    setSaving(true);
    try {
      await saveSelectedInstance(config);
      setSuccess("Instance configuration saved on this device.");
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the instance configuration.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" onPress={onClose}>
            <Text style={styles.back}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.heading}>Firebase instance</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color="#1D4ED8" />
            <Text style={styles.helper}>Loading saved configuration…</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.intro}>
              Configure which DLMSF Firebase project this installation will use.
              These are public client settings, not passwords or admin credentials.
            </Text>

            <Text style={styles.section}>DLMSF INSTANCE</Text>
            <ConfigField label="Instance ID" value={instanceId} onChangeText={setInstanceId} placeholder="dlmsf-developer-test" />
            <ConfigField label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="DLMSF Developer Test" autoCapitalize="sentences" />

            <Text style={styles.section}>FIREBASE PROJECT CONFIGURATION</Text>
            <ConfigField label="Web API key" value={apiKey} onChangeText={setApiKey} placeholder="AIza…" />
            <ConfigField label="Auth domain" value={authDomain} onChangeText={setAuthDomain} placeholder="your-project.firebaseapp.com" />
            <ConfigField label="Project ID" value={projectId} onChangeText={setProjectId} placeholder="your-project-id" />
            <ConfigField label="Messaging sender ID" value={messagingSenderId} onChangeText={setMessagingSenderId} placeholder="123456789012" />
            <ConfigField label="Firebase app ID" value={appId} onChangeText={setAppId} placeholder="1:123456789012:android:…" />
            <ConfigField label="Storage bucket" value={storageBucket} onChangeText={setStorageBucket} placeholder="your-project.firebasestorage.app" optional />
            <ConfigField label="Measurement ID" value={measurementId} onChangeText={setMeasurementId} placeholder="G-XXXXXXXXXX" optional />

            <Text style={styles.section}>GOOGLE OAUTH CLIENT IDS</Text>
            <ConfigField label="Android client ID" value={androidClientId} onChangeText={setAndroidClientId} placeholder="…apps.googleusercontent.com" optional />
            <ConfigField label="iOS client ID" value={iosClientId} onChangeText={setIosClientId} placeholder="…apps.googleusercontent.com" optional />
            <ConfigField label="Web client ID" value={webClientId} onChangeText={setWebClientId} placeholder="…apps.googleusercontent.com" optional />

            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>Important</Text>
              <Text style={styles.noticeText}>
                Saving this configuration only selects a Firebase project on this device.
                It does not create an account, grant admin access, or authorize access to DLMSF records.
                Never enter service-account keys, private keys, or OAuth client secrets here.
              </Text>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {success ? <Text style={styles.success}>{success}</Text> : null}

            <TouchableOpacity
              accessibilityRole="button"
              disabled={saving}
              onPress={handleSave}
              style={[styles.saveButton, saving && styles.disabled]}
            >
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Save instance configuration</Text>}
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Back to sign in</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { minHeight: 58, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#E2E8F0", backgroundColor: "#FFFFFF" },
  back: { color: "#1D4ED8", fontSize: 14, fontWeight: "700" },
  heading: { color: "#1E293B", fontSize: 16, fontWeight: "800" },
  headerSpacer: { width: 38 },
  content: { padding: 20, paddingBottom: 36 },
  intro: { color: "#64748B", fontSize: 13, lineHeight: 20, marginBottom: 22 },
  section: { color: "#1D4ED8", fontSize: 10, fontWeight: "900", letterSpacing: 1.3, marginTop: 18, marginBottom: 10 },
  field: { marginBottom: 12 },
  label: { color: "#334155", fontSize: 12, fontWeight: "700", marginBottom: 6 },
  input: { minHeight: 46, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 11, backgroundColor: "#FFFFFF", paddingHorizontal: 12, color: "#1E293B", fontSize: 13 },
  notice: { padding: 14, marginTop: 10, borderRadius: 12, backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#DBEAFE" },
  noticeTitle: { color: "#1E40AF", fontSize: 12, fontWeight: "800", marginBottom: 5 },
  noticeText: { color: "#1E40AF", fontSize: 11, lineHeight: 17 },
  error: { color: "#B91C1C", fontSize: 12, lineHeight: 18, marginTop: 14 },
  success: { color: "#15803D", fontSize: 12, lineHeight: 18, marginTop: 14 },
  saveButton: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#1D4ED8", marginTop: 18 },
  saveText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.65 },
  cancelButton: { alignItems: "center", paddingVertical: 15 },
  cancelText: { color: "#64748B", fontSize: 12, fontWeight: "700" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  helper: { color: "#64748B", fontSize: 12 },
});
