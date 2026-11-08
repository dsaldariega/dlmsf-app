"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Banknote,
  Bell,
  ChevronDown,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Sun,
  Search,
  Users,
  UserRound,
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
  const [darkMode, setDarkMode] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [pendingLoanRequests, setPendingLoanRequests] = useState(0);
  const [pendingLoanPayments, setPendingLoanPayments] = useState(0);
  const [notificationLoading, setNotificationLoading] = useState(false);

  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("dlmsf-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const enabled = savedTheme ? savedTheme === "dark" : prefersDark;
    setDarkMode(enabled);
    document.documentElement.classList.toggle("dark", enabled);
  }, []);

  function toggleDarkMode() {
    setDarkMode((current) => {
      const next = !current;
      document.documentElement.classList.toggle("dark", next);
      window.localStorage.setItem("dlmsf-theme", next ? "dark" : "light");
      return next;
    });
  }

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

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

  const breadcrumbItems = [
    { label: "Home", href: "/dashboard" },
    ...(currentPage !== "Dashboard" ? [{ label: currentPage }] : []),
  ];

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
        id="dlmsf-sidebar"
        aria-label="Main sidebar"
        className={`dlmsf-sidebar fixed inset-y-0 left-0 z-50 flex w-65 flex-col transition-all duration-200 ${
          "lg:w-65"
        } ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        {/* Brand */}
        <div className="dlmsf-brand flex h-16 shrink-0 items-center border-b border-slate-200 px-4">
          <Link href="/" onClick={() => setMobileOpen(false)} title="DLMSF Home" className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">DL</span>
            <span className="dlmsf-brand-text truncate text-lg font-bold tracking-tight">DLMSF</span>
          </Link>
        </div>


