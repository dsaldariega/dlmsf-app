import { AppState, Platform } from "react-native";
import { createClient, processLock } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase configuration. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in mobile/.env.",
  );
}

/**
 * SecureStore has a practical per-value size limit on some iOS versions.
 * Store the Supabase session in 1,800-character chunks and switch the
 * manifest only after every new chunk has been written successfully.
 */
const CHUNK_SIZE = 1800;

const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const manifestValue = await SecureStore.getItemAsync(`${key}.meta`);
    if (!manifestValue) return null;

    const manifest = JSON.parse(manifestValue) as {
      generation: string;
      count: number;
    };

    const chunks = await Promise.all(
      Array.from({ length: manifest.count }, (_, index) =>
        SecureStore.getItemAsync(
          `${key}.${manifest.generation}.${index}`,
        ),
      ),
    );

    if (chunks.some((chunk) => chunk === null)) {
      throw new Error("Your saved session is incomplete. Please sign in again.");
    }

    return (chunks as string[]).join("");
  },

  async setItem(key: string, value: string): Promise<void> {
    const previousManifestValue = await SecureStore.getItemAsync(`${key}.meta`);
    const previousManifest = previousManifestValue
      ? (JSON.parse(previousManifestValue) as { generation: string; count: number })
      : null;
    const generation = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const chunks = value.match(new RegExp(`[\\s\\S]{1, ${CHUNK_SIZE}}`, "g")) ?? [""];

    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(`${key}.${generation}.${index}`, chunk),
      ),
    );

    await SecureStore.setItemAsync(
      `${key}.meta`,
      JSON.stringify({ generation, count: chunks.length }),
    );

    if (previousManifest) {
      await Promise.all(
        Array.from({ length: previousManifest.count }, (_, index) =>
          SecureStore.deleteItemAsync(
            `${key}.${previousManifest.generation}.${index}`,
          ),
        ),
      );
    }
  },

  async removeItem(key: string): Promise<void> {
    const manifestValue = await SecureStore.getItemAsync(`${key}.meta`);
    await SecureStore.deleteItemAsync(`${key}.meta`);

    if (!manifestValue) return;
    const manifest = JSON.parse(manifestValue) as {
      generation: string;
      count: number;
    };

    await Promise.all(
      Array.from({ length: manifest.count }, (_, index) =>
        SecureStore.deleteItemAsync(
          `${key}.${manifest.generation}.${index}`,
        ),
      ),
    );
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
