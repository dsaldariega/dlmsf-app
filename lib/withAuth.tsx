"use client";

import { useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabase";

type Role = "admin" | "member";

export function withAuth(Component: React.FC, requiredRole: Role) {
  return function AuthWrapper(props: any) {
    const router = useRouter();

    useEffect(() => {
      const checkUser = async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push("/auth/login");
          return;
        }

        const { data: member } = await supabase
          .from("members")
          .select("*")
          .eq("auth_id", user.id)
          .single();

        if (!member) {
          router.push("/auth/login");
          return;
        }

        let roles: string[] = [];
        if (Array.isArray(member.roles)) roles = member.roles;
        else if (typeof member.roles === "string") {
          try {
            roles = JSON.parse(member.roles);
          } catch {
            roles = [member.roles];
          }
        }

        if (!roles.includes(requiredRole)) {
          router.push("/auth/login");
          return;
        }
      };

      checkUser();
    }, []);

    return <Component {...props} />;
  };
}
