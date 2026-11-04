"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

import AdminDashboard from "@/components/dashboard/AdminDashboard";
import MemberDashboard from "@/components/dashboard/MemberDashboard";

export default function DashboardPage() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.replace("/login");
        return;
      }

      const { data: member } = await supabase
        .from("members")
        .select("roles")
        .eq("auth_id", user.id)
        .maybeSingle();

      if (!member) {
        window.location.replace("/login");
        return;
      }

      const roles = Array.isArray(member.roles)
        ? member.roles
        : typeof member.roles === "string"
          ? (() => {
              try {
                const parsed = JSON.parse(member.roles);
                return Array.isArray(parsed) ? parsed : [member.roles];
              } catch {
                return [member.roles];
              }
            })()
          : [];

      const normalizedRoles = roles
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim().toLowerCase());

      if (normalizedRoles.includes("admin")) {
        setRole("admin");
      } else if (normalizedRoles.includes("member")) {
        setRole("member");
      }

      setLoading(false);
    }

    loadRole();
  }, []);

  if (loading) {
    return <div className="p-6">Loading dashboard...</div>;
  }

  if (role === "admin") return <AdminDashboard />;
  if (role === "member") return <MemberDashboard />;

  return (
    <div className="p-6">
      You don't have permission to access this dashboard.
    </div>
  );
}
