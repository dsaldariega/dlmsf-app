"use client";

import { useUserRole } from "@/app/hooks/useUserRole";
import RoleLoading from "@/components/layout/RoleLoading";
import UnderDevelopment from "@/components/layout/UnderDevelopment";
import AdminLoans from "@/components/loans/AdminLoans";

export default function LoansPage() {
  const { role, loading, error } = useUserRole();

  if (loading) return <RoleLoading />;
  if (error) return <p>{error}</p>;

  if (role === "admin") {
    return <AdminLoans />;
  }

  return null;
}
