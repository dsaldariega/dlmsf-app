"use client";

import { useUserRole } from "@/app/hooks/useUserRole";
import Loading from "@/components/layout/Loading";
import AdminAudit from "@/components/audit/AdminAudit";
import MemberAudit from "@/components/audit/MemberAudit";

export default function AuditPage() {
  const { role, loading, error } = useUserRole();
  if (loading) return <Loading />;
  if (error) return <p role="alert">{error}</p>;
  if (role === "member") return <MemberAudit />;
  if (role === "admin") return <AdminAudit />;
  return <p>Unauthorized access.</p>;
}