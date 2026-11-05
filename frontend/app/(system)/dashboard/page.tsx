"use client";

import { useUserRole } from "@/app/hooks/useUserRole";
import Loading from "@/components/layout/Loading";

import AdminDashboard from "@/components/dashboard/AdminDashboard";
import MemberDashboard from "@/components/dashboard/MemberDashboard";
import UnderDevelopment from "@/components/layout/UnderDevelopment";

export default function DashboardPage() {
  const { role, loading, error } = useUserRole();

  if (loading) return <Loading />;
  if (error) return <p>{error}</p>;
  if (role === "member") {
    return (
      <UnderDevelopment
        title="Dashboard Coming Soon"
        description="The Dashboard page is currently being developed. You'll be able to view your loan summary information here once it becomes available."
      />
    );
  }
  if (role === "admin") return <AdminDashboard />;

  return <p>Unauthorized access.</p>;
}
