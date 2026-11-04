"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Eye, EyeOff, LogIn, LoaderCircle } from "lucide-react";

function parseRoles(value: unknown): string[] {
  let parsed: unknown = value;

  if (typeof value === "string") {
    try {
      const result: unknown = JSON.parse(value);
      parsed = Array.isArray(result) ? result : value;
    } catch {
      parsed = value;
    }
  }

  const values = Array.isArray(parsed) ? parsed : [parsed];

  return values
    .filter((role): role is string => typeof role === "string")
    .map((role) => role.trim().toLowerCase());
}

function getDashboard(roles: string[]): string | null {
  const hasValidRole = roles.some(
    (role) => role === "admin" || role === "member",
  );

  return hasValidRole ? "/dashboard" : null;
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // Redirect authenticated users away from the login page.
  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) return;

        const { data: member, error: memberError } = await supabase
          .from("members")
          .select("roles")
          .eq("auth_id", user.id)
          .maybeSingle();

        if (!active) return;

        if (memberError) {
          console.error("Member lookup failed:", memberError);
          setErrorMessage("Unable to verify your account. Please try again.");
          return;
        }

        if (!member) {
          // Do not leave an authenticated session without a valid member.
          await supabase.auth.signOut();
          return;
        }

        const roles = parseRoles(member.roles);
        const destination = getDashboard(roles);

        if (destination) {
          router.replace(destination);
        } else {
          await supabase.auth.signOut();
          if (active) {
            setErrorMessage(
              "No valid role is assigned to your account. Please contact your administrator.",
            );
          }
        }
      } catch (error) {
        console.error("Session check failed:", error);

        if (active) {
          setErrorMessage(
            "Unable to verify your session. Please refresh and try again.",
          );
        }
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    }

    checkSession();

    return () => {
      active = false;
    };
  }, [router]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage("Invalid email or password. Please try again.");
        return;
      }

      const user = data.user;

      if (!user) {
        setErrorMessage("Unable to retrieve your account. Please try again.");
        return;
      }

      const { data: member, error: memberError } = await supabase
        .from("members")
        .select("roles")
        .eq("auth_id", user.id)
        .maybeSingle();

      if (memberError) {
        console.error("Member lookup failed:", memberError);
        await supabase.auth.signOut();
        setErrorMessage(
          "Unable to verify your account role. Please try again.",
        );
        return;
      }

      if (!member) {
        await supabase.auth.signOut();
        setErrorMessage(
          "Member record not found for this account. Please contact your administrator.",
        );
        return;
      }

      const roles = parseRoles(member.roles);
      const destination = getDashboard(roles);

      if (!destination) {
        await supabase.auth.signOut();
        setErrorMessage(
          "No valid role is assigned to your account. Please contact your administrator.",
        );
        return;
      }

      router.replace(destination);
      router.refresh();
    } catch (error) {
      console.error("Login failed:", error);
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold text-white shadow-lg">
            DL
          </div>

          <LoaderCircle className="animate-spin text-blue-600" size={26} />

          <div className="text-center">
            <h1 className="text-lg font-semibold text-slate-800">
              DLMSF Monitoring
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Checking your session...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 sm:p-6">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="bg-blue-600 px-8 py-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl bg-white text-lg font-bold text-blue-700 shadow-sm">
            DL
          </div>

          <h1 className="text-2xl font-bold text-white">DLMSF Monitoring</h1>

          <p className="mt-2 text-sm text-blue-100">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5 p-6 sm:p-8">
          {errorMessage && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {errorMessage}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Email address
            </label>

            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={loading}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Password
            </label>

            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 pr-12 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
              />

              <button
                type="button"
                onClick={() => setShowPassword((previous) => !previous)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-500 hover:text-slate-700"
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <LoaderCircle className="animate-spin" size={19} />
                Signing in...
              </>
            ) : (
              <>
                <LogIn size={19} />
                Sign In
              </>
            )}
          </button>

          <p className="text-center text-xs text-slate-400">
            DLMSF Monitoring System
          </p>
        </form>
      </div>
    </div>
  );
}
