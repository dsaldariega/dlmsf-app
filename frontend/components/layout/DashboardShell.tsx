"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Banknote,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Users,
  UserRound,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiRequest } from "@/lib/api";

const adminNavigation = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Members", href: "/members", icon: Users },
  { label: "Loans", href: "/loans", icon: Banknote },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Audit", href: "/audit", icon: Activity },
];

const memberNavigation = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Loans", href: "/loans", icon: Banknote },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Audit", href: "/audit", icon: Activity },
];

type MemberProfile = {
  name: string;
  role: string;
};

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [pendingLoanRequests, setPendingLoanRequests] = useState(0);
  const [pendingLoanPayments, setPendingLoanPayments] = useState(0);
  const [notificationLoading, setNotificationLoading] = useState(false);

  const pathname = usePathname();
  const router = useRouter();

  const isAdmin = profile?.role
    .toLowerCase()
    .split(",")
    .map((role) => role.trim())
    .includes("admin");

  const navigation = isAdmin ? adminNavigation : memberNavigation;

  async function loadPendingNotifications() {
    if (!isAdmin) return;
    setNotificationLoading(true);
    try {
      const [loanRequests, paymentSubmissions] = await Promise.all([
        apiRequest<Array<{status:string}>>("/api/loans/requests"),
        apiRequest<Array<{status:string;payment_type:string}>>("/api/payments/submissions"),
      ]);
      setPendingLoanRequests(loanRequests.filter(x => x.status === "Pending").length);
      setPendingLoanPayments(paymentSubmissions.filter(x => x.status === "Pending" && x.payment_type === "Loan").length);
    } catch (error) {
      console.error("Unable to load pending notifications:", error);
    } finally {
      setNotificationLoading(false);
    }
  }

  // Load the authenticated user's member profile.
  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (error || !user) {
        setProfile(null);
        return;
      }

      const { data: member, error: memberError } = await supabase
        .from("members")
        .select("*")
        .eq("auth_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (memberError || !member) {
        setProfile({
          name: user.email || "Account",
          role: "User",
        });
        return;
      }

      // Use the available member name field.
      const memberData = member as Record<string, unknown>;

      const name =
        memberData.full_name ||
        memberData.member_name ||
        memberData.name ||
        [memberData.first_name, memberData.last_name]
          .filter(Boolean)
          .join(" ") ||
        user.email ||
        "Member";

      // Parse roles, supporting both array and string formats.
      let roles: string[] = [];

      if (Array.isArray(memberData.roles)) {
        roles = memberData.roles.filter(
          (role): role is string => typeof role === "string",
        );
      } else if (typeof memberData.roles === "string") {
        try {
          const parsed: unknown = JSON.parse(memberData.roles);

          roles = Array.isArray(parsed)
            ? parsed.filter((role): role is string => typeof role === "string")
            : [memberData.roles];
        } catch {
          roles = [memberData.roles];
        }
      }

      const roleLabel = roles.length
        ? roles
            .map((role) => role.charAt(0).toUpperCase() + role.slice(1))
            .join(", ")
        : "Member";

      setProfile({
        name: String(name),
        role: roleLabel,
      });
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setLoggingOut(false);
      window.alert(`Unable to log out: ${error.message}`);
      return;
    }

    setProfileOpen(false);
    router.replace("/login");
    router.refresh();
  }

  const currentPage =
    navigation.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )?.label ?? (pathname === "/" ? "Dashboard" : "DLMSF System");

  const displayName = profile?.name || "Loading profile...";
  const displayRole = profile?.role || "Account";
  const initials = displayName.trim().charAt(0).toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-slate-800">
      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`dlmsf-sidebar fixed inset-y-0 left-0 z-50 flex w-65 flex-col transition-all duration-200 ${
          collapsed ? "lg:w-19" : "lg:w-65"
        } ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        {/* Brand */}
        <div className="dlmsf-brand flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-4">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            title="DLMSF Home"
            className="flex min-w-0 items-center gap-3"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              DL
            </span>

            {!collapsed && (
              <span className="dlmsf-brand-text truncate text-lg font-bold tracking-tight">
                DLMSF
              </span>
            )}
          </Link>

          {/* Mobile close button */}
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <X size={19} />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-5">
          {!collapsed && (
            <p className="dlmsf-muted mb-3 px-3 text-xs font-semibold uppercase tracking-wider">
              Main menu
            </p>
          )}

          <nav aria-label="Main navigation" className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;

              const active =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`) ||
                (item.href === "/dashboard" && pathname === "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? "page" : undefined}
                  data-active={active ? "true" : "false"}
                  className={`dlmsf-nav-link flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon size={19} className="shrink-0" />

                  {!collapsed && <span>{item.label}</span>}

                  {active && !collapsed && (
                    <span className="ml-auto size-1.5 rounded-full bg-blue-600" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar footer */}
        <div className="border-t border-white/10 p-3">
          {!collapsed ? (
            <div className="rounded-lg bg-white/5 px-3 py-3">
              <p className="dlmsf-brand-text text-xs font-semibold">
                DLMSF Monitoring
              </p>
              <p className="dlmsf-muted mt-1 text-xs">
                Loan Management System
              </p>
            </div>
          ) : (
            <div
              className="dlmsf-muted flex justify-center py-2 text-xs font-semibold"
              title="DLMSF Monitoring"
            >
              DL
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div
        className={`min-h-screen transition-[margin] duration-200 ${
          collapsed ? "lg:ml-19" : "lg:ml-65"
        }`}
      >
        {/* Navbar */}

        <header className="dlmsf-navbar sticky top-0 z-30 flex h-16 w-full items-center justify-between gap-3 border-b border-slate-200 bg-white px-2 sm:px-3">
          {/* Navbar left */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {/* Mobile menu */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu size={21} />
            </button>

            {/* Desktop sidebar toggle */}
            <button
              type="button"
              onClick={() => setCollapsed((previous) => !previous)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 lg:inline-flex"
            >
              {collapsed ? (
                <ChevronRight size={20} />
              ) : (
                <ChevronLeft size={20} />
              )}
            </button>

            {/* Current page */}
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-slate-900">
                {currentPage}
              </h1>
              <p className="hidden text-xs text-slate-500 sm:block">
                DLMSF Monitoring System
              </p>
            </div>
          </div>

          {/* Navbar right */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            {isAdmin && (
              <div className="relative">
                <button type="button" onClick={() => { const next=!notificationsOpen; setNotificationsOpen(next); if(next) void loadPendingNotifications(); }} aria-label={`Pending approvals: ${pendingLoanRequests+pendingLoanPayments}`} aria-expanded={notificationsOpen} className="relative rounded-lg p-2.5 text-slate-600 transition-colors hover:bg-slate-100">
                  <Bell size={20}/>
                  {(pendingLoanRequests+pendingLoanPayments)>0&&<span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-4 text-white">{pendingLoanRequests+pendingLoanPayments>99?"99+":pendingLoanRequests+pendingLoanPayments}</span>}
                </button>
                {notificationsOpen&&<><button type="button" aria-label="Close notifications" onClick={()=>setNotificationsOpen(false)} className="fixed inset-0 z-40 cursor-default"/><div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-3 shadow-xl"><div className="flex items-center justify-between border-b border-slate-100 px-2 pb-3"><div><p className="text-sm font-semibold text-slate-900">Pending approvals</p><p className="mt-0.5 text-xs text-slate-500">Items waiting for your review</p></div><button type="button" onClick={()=>void loadPendingNotifications()} disabled={notificationLoading} className="text-xs font-medium text-blue-700 hover:text-blue-800">{notificationLoading?"Refreshing...":"Refresh"}</button></div><div className="space-y-1 py-2"><Link onClick={()=>setNotificationsOpen(false)} href="/loans" className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm hover:bg-slate-50"><span className="text-slate-700">Loan requests</span><span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">{pendingLoanRequests}</span></Link><Link onClick={()=>setNotificationsOpen(false)} href="/payments" className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm hover:bg-slate-50"><span className="text-slate-700">Loan repayment requests</span><span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">{pendingLoanPayments}</span></Link></div><p className="border-t border-slate-100 px-2 pt-3 text-xs text-slate-400">Counts refresh when you open this panel.</p></div></>}
              </div>
            )}
            {/* Profile dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((previous) => !previous)}
                aria-expanded={profileOpen}
                aria-label="Open profile menu"
                className="flex max-w-55 items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-slate-100"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                  {initials}
                </div>

                <div className="hidden min-w-0 text-left sm:block">
                  <p className="max-w-37.5 truncate text-sm font-medium text-slate-800">
                    {displayName}
                  </p>
                  <p className="max-w-37.5 truncate text-xs text-slate-500">
                    {displayRole}
                  </p>
                </div>

                <ChevronDown
                  size={16}
                  className={`hidden shrink-0 text-slate-500 transition-transform sm:block ${
                    profileOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {profileOpen && (
                <>
                  {/* Outside click target */}
                  <button
                    type="button"
                    aria-label="Close profile menu"
                    onClick={() => setProfileOpen(false)}
                    className="fixed inset-0 z-40 cursor-default"
                  />

                  <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                    <div className="border-b border-slate-100 px-3 py-3">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {displayName}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {displayRole}
                      </p>
                    </div>

                    <div className="py-1">
                      <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600">
                        <UserRound size={17} />
                        <span>Signed-in account</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <LogOut size={17} />
                        {loggingOut ? "Logging out..." : "Logout"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main
          id="main-content"
          className="min-h-[calc(100vh-8rem)] p-4 sm:p-6 lg:p-8"
        >
          <div className="mx-auto w-full max-w-400">{children}</div>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white px-6 py-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} DLMSF Monitoring System
        </footer>
      </div>
    </div>
  );
}
