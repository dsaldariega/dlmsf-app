"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

export default function Dashboard() {
  const RATE = 50;

  const [members, setMembers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [loanPayments, setLoanPayments] = useState<any[]>([]);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const [m, p, l, lp] = await Promise.all([
      supabase.from("members").select("*"),
      supabase.from("payments").select("*"),
      supabase.from("loans").select("*"),
      supabase.from("loan_payments").select("*"),
    ]);
    setMembers(m.data || []);
    setPayments(p.data || []);
    setLoans(l.data || []);
    setLoanPayments(lp.data || []);
  };

  // --- Calculations ---
  const heads = members.reduce((s, m) => s + m.heads, 0);
  const totalSinkingCollected = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalLoanInterestCollected = loanPayments.reduce(
    (sum, lp) => sum + lp.amount,
    0,
  );
  const totalLoanPrincipalDisbursed = loans.reduce(
    (sum, l) => sum + l.amount,
    0,
  );
  const availableFunds = totalSinkingCollected - totalLoanPrincipalDisbursed;

  // --- Months Dec 2025 → Dec 2026 ---
  const months = [
    "December 2025",
    "January 2026",
    "February 2026",
    "March 2026",
    "April 2026",
    "May 2026",
    "June 2026",
    "July 2026",
    "August 2026",
    "September 2026",
    "October 2026",
    "November 2026",
    "December 2026",
  ];

  // --- Sinking Fund Monthly Table ---
  const getMonthlySinkingTarget = (month: string) => {
    const cutoffMonths = ["October 2026", "November 2026", "December 2026"];
    if (cutoffMonths.includes(month)) return "Cutoff";
    return heads * RATE * 4; // 4 weeks per month
  };

  const getMonthlySinkingCollected = (month: string) =>
    payments
      .filter((p) => {
        const d = new Date(p.week_start);
        const mName = d.toLocaleString("default", { month: "long" });
        return `${mName} ${d.getFullYear()}` === month;
      })
      .reduce((sum, p) => sum + p.amount, 0);

  const totalSinkingTarget = months.reduce((sum, m) => {
    const target = getMonthlySinkingTarget(m);
    return typeof target === "number" ? sum + target : sum;
  }, 0);

  // --- Loan Interest Monthly Table ---
  const getMonthlyLoanTarget = (month: string) => {
    if (["October 2026", "November 2026", "December 2026"].includes(month))
      return "Cutoff";
    if (["December 2025", "January 2026", "February 2026"].includes(month))
      return 15000;
    if (month === "March 2026") return 20000;
    if (
      [
        "April 2026",
        "May 2026",
        "June 2026",
        "July 2026",
        "August 2026",
        "September 2026",
      ].includes(month)
    )
      return 25000;
    return 0;
  };

  const getMonthlyLoanCollected = (month: string) =>
    loanPayments
      .filter((lp) => {
        const d = new Date(lp.paid_at);
        const mName = d.toLocaleString("default", { month: "long" });
        return `${mName} ${d.getFullYear()}` === month;
      })
      .reduce((sum, lp) => sum + lp.amount, 0);

  const totalLoanTarget = months.reduce((sum, m) => {
    const t = getMonthlyLoanTarget(m);
    return typeof t === "number" ? sum + t : sum;
  }, 0);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-100">
      <Sidebar />

      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Dashboard</h1>

        {/* --- Updated Cards (Members + Heads + New) --- */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {/* Members */}
          <div className="bg-white rounded-xl shadow p-4 hover:shadow-lg transition transform hover:-translate-y-1">
            <p className="text-sm text-gray-500 uppercase tracking-wide">
              Members
            </p>
            <p className="text-2xl font-bold mt-1 text-gray-800">
              {members.length}
            </p>
          </div>

          {/* Heads */}
          <div className="bg-white rounded-xl shadow p-4 hover:shadow-lg transition transform hover:-translate-y-1">
            <p className="text-sm text-gray-500 uppercase tracking-wide">
              Heads
            </p>
            <p className="text-2xl font-bold mt-1 text-gray-800">{heads}</p>
          </div>

          {/* Sinking Fund Total Collection */}
          <div className="bg-white rounded-xl shadow p-4 hover:shadow-lg transition transform hover:-translate-y-1">
            <p className="text-sm text-gray-500 uppercase tracking-wide">
              Sinking Fund Total Collection
            </p>
            <p className="text-2xl font-bold mt-1 text-green-600">
              ₱{totalSinkingCollected.toLocaleString()}
            </p>
          </div>

          {/* Loan Interest Total Collection */}
          <div className="bg-white rounded-xl shadow p-4 hover:shadow-lg transition transform hover:-translate-y-1">
            <p className="text-sm text-gray-500 uppercase tracking-wide">
              Loan Interest Total Collection
            </p>
            <p className="text-2xl font-bold mt-1 text-blue-600">
              ₱{totalLoanInterestCollected.toLocaleString()}
            </p>
          </div>

          {/* Available Funds for Loan */}
          <div className="bg-white rounded-xl shadow p-4 hover:shadow-lg transition transform hover:-translate-y-1">
            <p className="text-sm text-gray-500 uppercase tracking-wide">
              Available Funds for Loan
            </p>
            <p className="text-2xl font-bold mt-1 text-indigo-600">
              ₱{availableFunds.toLocaleString()}
            </p>
          </div>
        </div>

        {/* --- Sinking Fund Table --- */}
        <h2 className="text-xl font-semibold mb-2">
          Sinking Fund Collection (Monthly)
        </h2>
        <div className="bg-white rounded-xl shadow overflow-hidden hover:shadow-lg transition mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-100 text-gray-700 font-semibold">
                <tr>
                  <th className="p-4 text-left border-b border-gray-200">
                    Month
                  </th>
                  <th className="p-4 text-left border-b border-gray-200">
                    Target
                  </th>
                  <th className="p-4 text-left border-b border-gray-200">
                    Collected
                  </th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr
                    key={m}
                    className="hover:bg-gray-50 transition-colors duration-150"
                  >
                    <td className="p-4 font-medium text-gray-800">{m}</td>
                    <td className="p-4 font-semibold text-blue-600">
                      {getMonthlySinkingTarget(m)}
                    </td>
                    <td className="p-4 font-semibold text-green-600">
                      ₱{getMonthlySinkingCollected(m)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="p-4 text-gray-800">Total</td>
                  <td className="p-4 text-blue-600">₱{totalSinkingTarget}</td>
                  <td className="p-4 text-green-600">
                    ₱{totalSinkingCollected}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* --- Loan Interest Table --- */}
        <h2 className="text-xl font-semibold mb-2">
          Loan Interest Collection (Monthly)
        </h2>
        <div className="bg-white rounded-xl shadow overflow-hidden hover:shadow-lg transition">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-100 text-gray-700 font-semibold">
                <tr>
                  <th className="p-4 text-left border-b border-gray-200">
                    Month
                  </th>
                  <th className="p-4 text-left border-b border-gray-200">
                    Target
                  </th>
                  <th className="p-4 text-left border-b border-gray-200">
                    Collected
                  </th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr
                    key={m}
                    className="hover:bg-gray-50 transition-colors duration-150"
                  >
                    <td className="p-4 font-medium text-gray-800">{m}</td>
                    <td className="p-4 font-semibold text-blue-600">
                      {getMonthlyLoanTarget(m)}
                    </td>
                    <td className="p-4 font-semibold text-green-600">
                      ₱{getMonthlyLoanCollected(m)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="p-4 text-gray-800">Total</td>
                  <td className="p-4 text-blue-600">{totalLoanTarget}</td>
                  <td className="p-4 text-green-600">
                    ₱{totalLoanInterestCollected}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
