"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Wallet,
  Landmark,
  HandCoins,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { withAuth } from "@/lib/withAuth";
import { Member } from "@/lib/types/member";
import { LoanPayment, Payment } from "@/lib/types/payment";
import { Loan } from "@/lib/types/loan";
import { CUTOFF_MONTHS, MONTHS } from "@/lib/constants/dashboard";

function amount(value: number | string | null | undefined): number {
  return Number(value ?? 0) || 0;
}

function currency(value: number): string {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function monthOf(date: string | null | undefined): string {
  if (!date) return "";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function AdminDashboard() {
  const RATE = 50;

  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanPayments, setLoanPayments] = useState<LoanPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setLoadError("");

      try {
        const results = await Promise.all([
          supabase.from("members").select("*"),
          supabase.from("payments").select("*"),
          supabase.from("loans").select("*"),
          supabase.from("loan_payments").select("*"),
        ]);

        if (cancelled) return;

        const [m, p, l, lp] = results;

        if (m.error || p.error || l.error || lp.error) {
          console.error("Dashboard query errors:", results);
          setLoadError("Some dashboard data could not be loaded.");
        }

        setMembers((m.data ?? []) as Member[]);
        setPayments((p.data ?? []) as Payment[]);
        setLoans((l.data ?? []) as Loan[]);
        setLoanPayments((lp.data ?? []) as LoanPayment[]);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setLoadError("Unable to load dashboard data. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const heads = members.reduce((sum, member) => sum + amount(member.heads), 0);

  const totalSinkingCollected = payments.reduce(
    (sum, payment) => sum + amount(payment.amount),
    0,
  );

  const totalLoanInterestCollected = loanPayments.reduce(
    (sum, payment) => sum + amount(payment.amount),
    0,
  );

  const totalLoanPrincipalDisbursed = loans
    .filter((loan) => loan.status?.toLowerCase() !== "paid")
    .reduce((sum, loan) => sum + amount(loan.amount), 0);

  const availableFunds = totalSinkingCollected - totalLoanPrincipalDisbursed;

  const getMonthlySinkingTarget = (month: string): number | null => {
    if (CUTOFF_MONTHS.includes(month)) return null;
    return heads * RATE * 4;
  };

  const getMonthlySinkingCollected = (month: string) =>
    payments
      .filter((payment) => monthOf(payment.week_start) === month)
      .reduce((sum, payment) => sum + amount(payment.amount), 0);

  const getMonthlyLoanTarget = (month: string): number | null => {
    if (CUTOFF_MONTHS.includes(month)) return null;

    if (["December 2025", "January 2026", "February 2026"].includes(month)) {
      return 15000;
    }

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
    ) {
      return 25000;
    }

    return 0;
  };

  const getMonthlyLoanCollected = (month: string) =>
    loanPayments
      .filter((payment) => monthOf(payment.paid_at) === month)
      .reduce((sum, payment) => sum + amount(payment.amount), 0);

  const cardClass =
    "rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md";

  const tableClass = "w-full min-w-[600px] border-collapse text-left text-sm";

  const thClass =
    "border-b border-slate-200 bg-slate-50 px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500";

  const tdClass = "border-b border-slate-100 px-5 py-4 text-slate-700";

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Dashboard Overview
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Monitor members, sinking fund contributions, and loan collections.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {loadError && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-4 text-sm text-red-700"
        >
          {loadError}
        </p>
      )}

      <section>
        <h3 className="mb-4 text-base font-semibold text-slate-900">
          Financial Summary
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className={cardClass}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Total Members</p>
                <p className="mt-3 text-3xl font-bold text-slate-900">
                  {loading ? "—" : members.length.toLocaleString()}
                </p>
              </div>
              <Users className="text-orange-600" size={26} />
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Total Heads</p>
                <p className="mt-3 text-3xl font-bold text-slate-900">
                  {loading ? "—" : heads.toLocaleString()}
                </p>
              </div>
              <Users className="text-green-600" size={26} />
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Sinking Fund Collected</p>
                <p className="mt-3 text-2xl font-bold text-blue-700">
                  {loading ? "—" : currency(totalSinkingCollected)}
                </p>
              </div>
              <Wallet className="text-blue-600" size={26} />
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Available Funds</p>
                <p
                  className={`mt-3 text-2xl font-bold ${
                    availableFunds < 0 ? "text-red-600" : "text-teal-700"
                  }`}
                >
                  {loading ? "—" : currency(availableFunds)}
                </p>
              </div>
              <Landmark className="text-teal-600" size={26} />
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Total Loan Payments</p>
                <p className="mt-3 text-2xl font-bold text-purple-700">
                  {loading ? "—" : currency(totalLoanInterestCollected)}
                </p>
              </div>
              <HandCoins className="text-purple-600" size={26} />
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">
                  Outstanding Loan Principal
                </p>
                <p className="mt-3 text-2xl font-bold text-amber-700">
                  {loading ? "—" : currency(totalLoanPrincipalDisbursed)}
                </p>
              </div>
              <TrendingUp className="text-amber-600" size={26} />
            </div>
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-1 text-lg font-semibold text-slate-900">
          Sinking Fund Collection (Monthly)
        </h3>
        <p className="mb-4 text-sm text-slate-500">
          Monthly contribution targets and actual collections.
        </p>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Month</th>
                <th className={thClass}>Target</th>
                <th className={thClass}>Collected</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className={tdClass}>
                    Loading...
                  </td>
                </tr>
              ) : (
                MONTHS.map((month) => {
                  const target = getMonthlySinkingTarget(month);
                  const collected = getMonthlySinkingCollected(month);
                  const achieved = target !== null && collected >= target;

                  return (
                    <tr key={month} className="hover:bg-slate-50">
                      <td className={tdClass}>{month}</td>
                      <td className={tdClass}>
                        {target === null ? "Cutoff" : currency(target)}
                      </td>
                      <td className={`${tdClass} font-semibold text-green-700`}>
                        {currency(collected)}
                      </td>
                      <td className={tdClass}>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            target === null
                              ? "bg-slate-100 text-slate-600"
                              : achieved
                                ? "bg-green-50 text-green-700"
                                : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {target === null
                            ? "Cutoff"
                            : achieved
                              ? "Target reached"
                              : "In progress"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-1 text-lg font-semibold text-slate-900">
          Loan Collection (Monthly)
        </h3>
        <p className="mb-4 text-sm text-slate-500">
          Monthly loan repayment targets and actual collections.
        </p>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Month</th>
                <th className={thClass}>Target</th>
                <th className={thClass}>Collected</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className={tdClass}>
                    Loading...
                  </td>
                </tr>
              ) : (
                MONTHS.map((month) => {
                  const target = getMonthlyLoanTarget(month);
                  const collected = getMonthlyLoanCollected(month);
                  const achieved = target !== null && collected >= target;

                  const status =
                    target === null
                      ? "Cutoff"
                      : achieved
                        ? "Target reached"
                        : "Pending";

                  return (
                    <tr key={month} className="hover:bg-slate-50">
                      <td className={tdClass}>{month}</td>
                      <td className={tdClass}>
                        {target === null ? "Cutoff" : currency(target)}
                      </td>
                      <td className={`${tdClass} font-semibold text-blue-700`}>
                        {currency(collected)}
                      </td>
                      <td className={tdClass}>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            status === "Target reached"
                              ? "bg-green-50 text-green-700"
                              : status === "Cutoff"
                                ? "bg-slate-100 text-slate-600"
                                : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs leading-5 text-slate-400">
        Figures are based on records returned by Supabase. Confirm your
        accounting rules before treating these values as official balances.
      </p>
    </div>
  );
}

export default withAuth(AdminDashboard, "admin");
