"use client";

import { useUserRole } from "@/app/hooks/useUserRole";
import Loading from "@/components/layout/Loading";
import AdminPayments from "@/components/payments/AdminPayments";
import MemberPayments from "@/components/payments/MemberPayments";

export default function PaymentsPage() {
  const { role, loading, error } = useUserRole();
  if (loading) return <Loading />;
  if (error) return <p role="alert">{error}</p>;
  if (role === "member") return <MemberPayments />;
  if (role === "admin") return <AdminPayments />;
  return <p>Unauthorized access.</p>;
}
