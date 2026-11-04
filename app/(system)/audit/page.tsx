"use client";

import { useUserRole } from "@/app/hooks/useUserRole";
import RoleLoading from "@/components/layout/RoleLoading";
import UnderDevelopment from "@/components/layout/UnderDevelopment";
import AdminAudit from "@/components/audit/AdminAudit";

export default function LoansPage() {
  const { role, loading, error } = useUserRole();

  if (loading) return <RoleLoading />;
  if (error) return <p>{error}</p>;

  if (role === "member") {
    return (
      <UnderDevelopment
        title="Loans Coming Soon"
        description="The Loans section is currently being developed. You'll be able to view your loan information here once it becomes available."
      />
    );
  }

  if (role === "admin") {
    return <AdminAudit />;
  }

  return null;
}
