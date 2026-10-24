import DashboardShell from "@/components/layout/DashboardShell";

export default function SystemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
