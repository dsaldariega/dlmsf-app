"use client";

import { useUserRole } from "@/app/hooks/useUserRole";
import RoleLoading from "@/components/layout/RoleLoading";
import UnderDevelopment from "@/components/layout/UnderDevelopment";

import AdminPayments from "@/components/payments/AdminPayments";
import MemberPayments from "@/components/payments/MemberPayments";

export default function PaymentsPage() {
  const { role, loading, error } = useUserRole();

  if (loading) return <RoleLoading />;
  if (error) return <p>{error}</p>;

  if (role === "member") {
    return (
      <UnderDevelopment
        title="Payments Page Coming Soon"
        description="The Payments page is currently being developed. You'll be able to view your payments information here once it becomes available."
      />
    );
  }
  if (role === "admin") return <AdminPayments />;

  return <p>Unauthorized access.</p>;
}
