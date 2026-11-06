"use client";

import { useUserRole } from "@/app/hooks/useUserRole";
import Loading from "@/components/layout/Loading";
import MemberLoans from "@/components/loans/MemberLoans";
import AdminLoans from "@/components/loans/AdminLoans";

export default function LoansPage() {
  const { role, loading, error } = useUserRole();
  if (loading) return <Loading />;
  if (error) return <p role="alert">{error}</p>;
  if (role === "member") return <MemberLoans />;
  if (role === "admin") return <AdminLoans />;
  return <p>Unauthorized access.</p>;
}