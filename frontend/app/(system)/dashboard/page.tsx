"use client";

import { useUserRole } from "@/app/hooks/useUserRole";
import Loading from "@/components/layout/Loading";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import MemberDashboard from "@/components/dashboard/MemberDashboard";

export default function DashboardPage() {
  const { role, loading, error } = useUserRole();
  if (loading) return <Loading />;
  if (error) return <p role="alert">{error}</p>;
  if (role === "member") return <MemberDashboard />;
  if (role === "admin") return <AdminDashboard />;
  return <p>Unauthorized access.</p>;
}
