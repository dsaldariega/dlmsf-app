"use client";

import { useUserRole } from "@/app/hooks/useUserRole";
import Loading from "@/components/layout/Loading";
import UnderDevelopment from "@/components/layout/UnderDevelopment";
import AdminLoans from "@/components/loans/AdminLoans";

export default function LoansPage() {
  const { role, loading, error } = useUserRole();

  if (loading) return <Loading />;
  if (error) return <p>{error}</p>;

  if (role === "admin") {
    return <AdminLoans />;
  }

  return null;
}
