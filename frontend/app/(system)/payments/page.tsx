"use client";

import { useUserRole } from "@/app/hooks/useUserRole";
import Loading from "@/components/layout/Loading";
import AdminPayments from "@/components/payments/AdminPayments";
import MemberPaymentSubmissions from "@/components/payments/MemberPaymentSubmissions";

export default function PaymentsPage() {
  const { role, loading, error } = useUserRole();

  if (loading) return <Loading />;
  if (error) return <p role="alert">{error}</p>;
  if (role === "member") return <MemberPaymentSubmissions />;
  if (role === "admin") return <AdminPayments />;

  return <p>Unauthorized access.</p>;
}
