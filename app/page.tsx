"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";
import { withAuth } from "@/lib/withAuth";

function AdminDashboard() {
  const RATE = 50;

  const [members, setMembers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [loanPayments, setLoanPayments] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
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

  const heads = members.reduce((sum, m) => sum + m.heads, 0);
  const totalSinkingCollected = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalLoanInterestCollected = loanPayments.reduce(
    (sum, lp) => sum + lp.amount,
    0,
  );
  const totalLoanPrincipalDisbursed = loans
    .filter((l) => l.status !== "Paid")
    .reduce((sum, l) => sum + l.amount, 0);

  const availableFunds = totalSinkingCollected - totalLoanPrincipalDisbursed;

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

  const getMonthlySinkingTarget = (month: string) => {
    const cutoff = ["October 2026", "November 2026", "December 2026"];
    if (cutoff.includes(month)) return "Cutoff";
    return heads * RATE * 4;
  };

  const getMonthlySinkingCollected = (month: string) =>
    payments
      .filter(
        (p) =>
          new Date(p.week_start).toLocaleString("default", {
            month: "long",
            year: "numeric",
          }) === month,
      )
      .reduce((sum, p) => sum + p.amount, 0);

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
      .filter(
        (lp) =>
          new Date(lp.paid_at).toLocaleString("default", {
            month: "long",
            year: "numeric",
          }) === month,
      )
      .reduce((sum, lp) => sum + lp.amount, 0);

  return (
    <div className="h-screen flex flex-col md:flex-row bg-gray-100">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
        <div className="flex justify-end mb-4"></div>

        <h1 className="text-3xl font-bold text-gray-800 mb-6">Dashboard</h1>

        {/* Cards */}
        <div className="grid gap-6 mb-8 md:grid-cols-2 xl:grid-cols-4">
          <div className="flex items-center p-4 bg-white rounded-lg shadow-xs">
            <div className="p-3 mr-4 text-orange-500 bg-orange-100 rounded-full">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path>
              </svg>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-600">Members</p>
              <p className="text-lg font-semibold text-gray-700">
                {members.length}
              </p>
            </div>
          </div>

          <div className="flex items-center p-4 bg-white rounded-lg shadow-xs">
            <div className="p-3 mr-4 text-green-500 bg-green-100 rounded-full">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
                  clipRule="evenodd"
                ></path>
              </svg>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-600">Heads</p>
              <p className="text-lg font-semibold text-gray-700">{heads}</p>
            </div>
          </div>

          <div className="flex items-center p-4 bg-white rounded-lg shadow-xs">
            <div className="p-3 mr-4 text-blue-500 bg-blue-100 rounded-full">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"></path>
              </svg>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-600">
                Sinking Fund Collected
              </p>
              <p className="text-lg font-semibold text-gray-700">
                ₱{totalSinkingCollected.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center p-4 bg-white rounded-lg shadow-xs">
            <div className="p-3 mr-4 text-teal-500 bg-teal-100 rounded-full">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z"
                  clipRule="evenodd"
                ></path>
              </svg>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-600">
                Available Funds
              </p>
              <p className="text-lg font-semibold text-gray-700">
                ₱{availableFunds.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center p-4 bg-white rounded-lg shadow-xs">
            <div className="p-3 mr-4 text-purple-500 bg-purple-100 rounded-full">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM10 5a1 1 0 11-2 0 1 1 0 012 0zm0 3a1 1 0 100 2 1 1 0 000-2zm0 3a1 1 0 100 2 1 1 0 000-2z" />
              </svg>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-600">
                Total Loan Collected
              </p>
              <p className="text-lg font-semibold text-gray-700">
                ₱{totalLoanInterestCollected.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Sinking Fund Table */}
        <h2 className="my-6 text-2xl font-semibold text-gray-700">
          Sinking Fund Collection (Monthly)
        </h2>
        <div className="w-full overflow-hidden rounded-lg shadow-xs mb-6">
          <div className="w-full overflow-x-auto">
            <table className="w-full whitespace-no-wrap">
              <thead>
                <tr className="text-xs font-semibold tracking-wide text-left text-gray-500 uppercase border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Collected</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {months.map((m) => (
                  <tr
                    key={m}
                    className="text-gray-700 border-b border-gray-200"
                  >
                    <td className="px-4 py-3">{m}</td>
                    <td className="px-4 py-3">
                      {getMonthlySinkingTarget(m) !== "Cutoff"
                        ? `₱${getMonthlySinkingTarget(m)}`
                        : "Cutoff"}
                    </td>
                    <td className="px-4 py-3">
                      ₱{getMonthlySinkingCollected(m)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Loan Table */}
        <h2 className="my-6 text-2xl font-semibold text-gray-700">
          Loan Interest Collection (Monthly)
        </h2>
        <div className="w-full overflow-hidden rounded-lg shadow-xs">
          <div className="w-full overflow-x-auto">
            <table className="w-full whitespace-no-wrap">
              <thead>
                <tr className="text-xs font-semibold tracking-wide text-left text-gray-500 uppercase border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Collected</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {months.map((m) => {
                  const collected = getMonthlyLoanCollected(m);
                  const target = getMonthlyLoanTarget(m);
                  let status = "Pending";
                  if (target === "Cutoff") status = "Cutoff";
                  else if (collected >= Number(target)) status = "Approved";
                  return (
                    <tr
                      key={m}
                      className="text-gray-700 border-b border-gray-200"
                    >
                      <td className="px-4 py-3">{m}</td>
                      <td className="px-4 py-3">
                        {target !== "Cutoff" ? `₱${target}` : "Cutoff"}
                      </td>
                      <td className="px-4 py-3">₱{collected}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 font-semibold leading-tight rounded-full ${
                            status === "Approved"
                              ? "text-green-700 bg-green-100"
                              : status === "Pending"
                                ? "text-orange-700 bg-orange-100"
                                : "text-gray-700 bg-gray-100"
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

export default withAuth(AdminDashboard, "admin");
