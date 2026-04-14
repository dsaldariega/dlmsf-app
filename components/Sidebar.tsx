"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const path = usePathname();

  const linkClass = (href: string) =>
    `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
      path === href
        ? "bg-blue-600 text-white shadow-md"
        : "text-gray-800 hover:bg-gray-100"
    }`;

  return (
    <aside className="w-full md:w-64 md:shrink-0 bg-white border-b md:border-r border-gray-100 md:min-h-screen p-4 md:p-6">
      {/* BRAND */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">💰 DLMSF</h1>
        <p className="text-xs text-gray-400">Cooperative Monitoring System</p>
      </div>

      {/* NAV */}
      <nav className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible">
        <Link href="/" className={linkClass("/")}>
          📊 Dashboard
        </Link>

        <Link href="/members" className={linkClass("/members")}>
          👥 Members
        </Link>

        <Link href="/payments" className={linkClass("/payments")}>
          💸 Payments
        </Link>

        <Link href="/loans" className={linkClass("/loans")}>
          🏦 Loans
        </Link>
      </nav>
    </aside>
  );
}
