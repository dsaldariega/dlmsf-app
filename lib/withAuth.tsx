"use client";

import { useEffect, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabase";

type Role = "admin" | "member";

function parseRoles(value: unknown): Role[] {
  let parsed: unknown = value;

  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = value.split(",");
    }
  }

  const values = Array.isArray(parsed) ? parsed : [parsed];

  return values
    .filter((role): role is string => typeof role === "string")
    .map((role) => role.trim().toLowerCase())
    .filter((role): role is Role => role === "admin" || role === "member");
}

export function withAuth<P extends object>(
  Component: ComponentType<P>,
  requiredRole: Role,
) {
  return function AuthWrapper(props: P) {
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
      let active = true;

      async function checkUser() {
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

          // Fail closed if the profile lookup fails or no profile exists.
          if (memberError || !member) {
            router.replace("/login");
            return;
          }

          const roles = parseRoles(member.roles);

          if (!roles.includes(requiredRole)) {
            router.replace("/login");
            return;
          }

          if (active) {
            setAuthorized(true);
          }
        } catch (error) {
          console.error("Authentication check failed:", error);
          router.replace("/login");
        } finally {
          if (active) {
            setChecking(false);
          }
        }
      }

      void checkUser();

      return () => {
        active = false;
      };
    }, [requiredRole, router]);

    // Never render protected content while authentication is unresolved
    // or when the current user is not authorized.
    if (checking || !authorized) {
      return null;
    }

    return <Component {...props} />;
  };
}
