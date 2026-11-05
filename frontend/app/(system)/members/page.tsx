"use client";

import { useUserRole } from "@/app/hooks/useUserRole";
import Loading from "@/components/layout/Loading";
import UnderDevelopment from "@/components/layout/UnderDevelopment";
import AdminMembers from "@/components/members/AdminMembers";

export default function LoansPage() {
  const { role, loading, error } = useUserRole();

  if (loading) return <Loading />;
  if (error) return <p>{error}</p>;

  if (role === "admin") {
    return <AdminMembers />;
  }

  return null;
}
