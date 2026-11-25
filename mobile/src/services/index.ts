/**
 * Provider-independent service contracts for the mobile application.
 *
 * The current adapters still use Supabase Auth and the Express API. Future
 * Firebase adapters should implement these same contracts so screens do not
 * need to know which cloud provider is active.
 */

import { supabase } from "../lib/supabase";
import { getMemberRole, type MemberRole } from "../lib/auth";
import { apiDownload, apiRequest } from "../lib/api";

export type AuthIdentity = {
  id: string;
  email: string;
};

export type AuthSessionSnapshot = {
  accessToken: string;
  userId: string;
};

export type AuthStateListener = (event: string) => void;

export interface AuthService {
  onAuthStateChange(listener: AuthStateListener): { unsubscribe: () => void };
  getSession(): Promise<AuthSessionSnapshot | null>;
  getUser(accessToken: string): Promise<AuthIdentity | null>;
  signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<AuthIdentity>;
  signOut(): Promise<void>;
  getMemberRole(userId: string): Promise<MemberRole>;
}

export interface DataService {
  request<T>(endpoint: string, options?: RequestInit): Promise<T>;
  download(endpoint: string): Promise<ArrayBuffer>;
}

/**
 * Supabase-backed implementation retained during the migration.
 * Errors are normalized here so application code can remain provider-agnostic.
 */
export const currentAuthService: AuthService = {
  onAuthStateChange(listener) {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => listener(event));

    return { unsubscribe: () => subscription.unsubscribe() };
  },

  async getSession() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) throw new Error(error.message);
    if (!session) return null;

    return {
      accessToken: session.access_token,
      userId: session.user.id,
    };
  },

  async getUser(accessToken) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken);

    if (error) throw new Error(error.message);
    if (!user) return null;

    return {
      id: user.id,
      email: user.email ?? "",
    };
  },

  async signInWithPassword({ email, password }) {
    const {
      data: { user },
      error,
    } = await supabase.auth.signInWithPassword({ email, password });

    if (error) throw new Error(error.message);
    if (!user) throw new Error("Unable to retrieve your account.");

    return {
      id: user.id,
      email: user.email ?? email,
    };
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  },

  getMemberRole,
};

/**
 * Current data adapter. All business-data requests continue through Express;
 * the existing API helper attaches the active Supabase access token.
 */
export const currentDataService: DataService = {
  request: apiRequest,
  download: apiDownload,
};
