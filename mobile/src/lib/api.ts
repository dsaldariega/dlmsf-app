import { supabase } from "./supabase";

const API_URL = process.env.EXPO_PUBLIC_API_URL
  ?.replace(/\/api\/?$/, "")
  .replace(/\/$/, "");

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * All mobile business data is accessed through the existing Express API.
 * The current Supabase access token is attached to every request.
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  if (!API_URL) {
    throw new Error("The API URL is not configured. Set EXPO_PUBLIC_API_URL.");
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw new Error(sessionError.message);
  if (!session?.access_token) {
    throw new ApiError("Your session has expired. Please sign in again.", 401);
  }

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${session.access_token}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error("Unable to reach the server. Check your connection and try again.");
  }

  const payload = (await response.json().catch(() => null)) as
    | ApiEnvelope<T>
    | { message?: string; error?: string }
    | null;

  if (!response.ok) {
    const message =
      (payload && "message" in payload ? payload.message : undefined) ||
      (payload && "error" in payload ? payload.error : undefined) ||
      `Request failed (${response.status}). Please try again.`;
    throw new ApiError(message, response.status);
  }

  if (!payload || !("success" in payload) || !payload.success) {
    throw new Error(
      payload && "message" in payload && payload.message
        ? payload.message
        : "The server returned an invalid response.",
    );
  }

  return payload.data;
}


/**
 * Download a binary response through the same authenticated API boundary.
 * Used for generated reports and exports rather than exposing API details to UI.
 */
export async function apiDownload(endpoint: string): Promise<ArrayBuffer> {
  if (!API_URL) {
    throw new Error("The API URL is not configured. Set EXPO_PUBLIC_API_URL.");
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw new Error(sessionError.message);
  if (!session?.access_token) {
    throw new ApiError("Your session has expired. Please sign in again.", 401);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  } catch {
    throw new Error("Unable to reach the server. Check your connection and try again.");
  }

  if (!response.ok) {
    const message = await response.text();
    throw new ApiError(message || `Request failed (${response.status}). Please try again.`, response.status);
  }

  return response.arrayBuffer();
}
