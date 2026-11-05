"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export type UserRole = "admin" | "member";

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

export function useUserRole() {
  const router = useRouter();

  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadRole() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const { data: member, error: memberError } = await supabase
          .from("members")
          .select("roles")
          .eq("auth_id", user.id)
          .maybeSingle();

        if (memberError) {
          throw memberError;
        }

        if (!member) {
          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }

        const roles = parseRoles(member.roles);

        // Admin takes precedence if an account has both roles.
        const userRole: UserRole | null = roles.includes("admin")
          ? "admin"
          : roles.includes("member")
            ? "member"
            : null;

        if (!userRole) {
          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }

        if (active) {
          setRole(userRole);
        }
      } catch (err) {
        console.error("Unable to load user role:", err);

        if (active) {
          setError("Unable to verify your account. Please try again.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadRole();

    return () => {
      active = false;
    };
  }, [router]);

  return { role, loading, error };
}