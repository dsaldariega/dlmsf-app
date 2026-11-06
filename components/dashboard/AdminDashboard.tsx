"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users,
  Wallet,
  Landmark,
  HandCoins,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { withAuth } from "@/lib/withAuth";
import { Member } from "@/lib/types/member";
import { LoanPayment, Payment } from "@/lib/types/payment";
import { Loan } from "@/lib/types/loan";
import { CUTOFF_MONTHS, MONTHS } from "@/lib/constants/dashboard";
import { motion, AnimatePresence } from "motion/react";
import { tableClass, tdClass, thClass } from "@/components/ui/table-styles";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import TableLoading from "@/components/ui/TableLoading";

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

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await apiRequest<{
        members: Member[];
        payments: Payment[];
        loans: Loan[];
        loanPayments: LoanPayment[];
      }>("/api/dashboard");
      setMembers(data.members);
      setPayments(data.payments);
      setLoans(data.loans);
      setLoanPayments(data.loanPayments);
    } catch (error) {
      console.error("Dashboard API error:", error);
      setLoadError(error instanceof Error ? error.message : "Unable to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }

  useEffect(() => {
    void loadData();
  }, [loadData]);

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

  const getMonthlySinkingTarget = (month: string): number => {
    const [monthName, yearString] = month.split(" ");

    const parsedMonthIndex = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ].indexOf(monthName);

    if (parsedMonthIndex === -1 || !yearString) return 0;

    const parsedDate = new Date(Number(yearString), parsedMonthIndex, 1);

    if (Number.isNaN(parsedDate.getTime())) {
      console.error("Invalid month:", month);
      return 0;
    }

    const year = parsedDate.getFullYear();
    const monthIndex = parsedDate.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    let sundayCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      if (new Date(year, monthIndex, day).getDay() === 0) {
        sundayCount++;
      }
    }

    return heads * RATE * sundayCount;
  };

  const getMonthlySinkingCollected = (month: string): number => {
    const sundays = payments.filter(
      (payment) => monthOf(payment.week_start) === month,
    );

    return sundays.reduce((sum) => sum + Number(heads) * RATE, 0);
  };

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

  const sinkingCollectionColumns: DataTableColumn<string>[] = [
    {
      key: "month",
      header: "Month",
      render: (month) => month,
    },
    {
      key: "target",
      header: "Target",
      render: (month) => currency(getMonthlySinkingTarget(month)),
    },
    {
      key: "collected",
      header: "Collected",
      cellClassName: "font-semibold text-blue-700",
      render: (month) => currency(getMonthlySinkingCollected(month)),
    },
    {
      key: "status",
      header: "Status",
      render: (month) => {
        const target = getMonthlySinkingTarget(month);
        const collected = getMonthlySinkingCollected(month);

        const status =
          target === null
            ? "Cutoff"
            : collected >= target
              ? "Target reached"
              : "Pending";

        const statusClass =
          status === "Target reached"
            ? "bg-green-50 text-green-700"
            : status === "Cutoff"
              ? "bg-slate-100 text-slate-600"
              : "bg-amber-50 text-amber-700";

        return (
          <span className={`rounded-full text-xs font-semibold ${statusClass}`}>
            {status}
          </span>
        );
      },
    },
  ];

  const loanCollectionColumns: DataTableColumn<string>[] = [
    {
      key: "month",
      header: "Month",
      render: (month) => month,
    },
    {
      key: "target",
      header: "Target",
      render: (month) => {
        const target = getMonthlyLoanTarget(month);

        return target === null ? "Cutoff" : currency(target);
      },
    },
    {
      key: "collected",
      header: "Collected",
      cellClassName: "font-semibold text-blue-700",
      render: (month) => currency(getMonthlyLoanCollected(month)),
    },
    {
      key: "status",
      header: "Status",
      render: (month) => {
        const target = getMonthlyLoanTarget(month);
        const collected = getMonthlyLoanCollected(month);

        const status =
          target === null
            ? "Cutoff"
            : collected >= target
              ? "Target reached"
              : "Pending";

        const statusClass =
          status === "Target reached"
            ? "bg-green-100 text-green-700"
            : status === "Cutoff"
              ? "bg-slate-100 text-slate-600"
              : "bg-amber-100 text-amber-700";

        return (
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusClass}`}
          >
            {status}
          </span>
        );
      },
    },
  ];

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
          onClick={() => void loadData()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          {loading ? "Refreshing..." : "Refresh"}
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
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0, ease: "easeOut" }}
                  className="mt-3 text-3xl font-bold text-slate-900"
                >
                  {loading ? "—" : members.length.toLocaleString()}
                </motion.p>
              </div>
              <Users className="text-orange-600" size={26} />
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Total Heads</p>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.05, ease: "easeOut" }}
                  className="mt-3 text-3xl font-bold text-slate-900"
                >
                  {loading ? "—" : heads.toLocaleString()}
                </motion.p>
              </div>
              <Users className="text-green-600" size={26} />
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Sinking Fund Collected</p>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.1, ease: "easeOut" }}
                  className="mt-3 text-2xl font-bold text-blue-700"
                >
                  {loading ? "—" : currency(totalSinkingCollected)}
                </motion.p>
              </div>
              <Wallet className="text-blue-600" size={26} />
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Available Funds</p>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.15, ease: "easeOut" }}
                  className={`mt-3 text-2xl font-bold ${
                    availableFunds < 0 ? "text-red-600" : "text-teal-700"
                  }`}
                >
                  {loading ? "—" : currency(availableFunds)}
                </motion.p>
              </div>
              <Landmark className="text-teal-600" size={26} />
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Total Loan Payments</p>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.2, ease: "easeOut" }}
                  className="mt-3 text-2xl font-bold text-purple-700"
                >
                  {loading ? "—" : currency(totalLoanInterestCollected)}
                </motion.p>
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
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.25, ease: "easeOut" }}
                  className="mt-3 text-2xl font-bold text-amber-700"
                >
                  {loading ? "—" : currency(totalLoanPrincipalDisbursed)}
                </motion.p>
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
          <div className="h-105 overflow-y-scroll">
            <DataTable
              data={MONTHS}
              columns={sinkingCollectionColumns}
              getRowKey={(month) => month}
              tableClassName={`${tableClass} relative`}
              thClassName={thClass}
              tdClassName={tdClass}
              loading={loading}
              loadingRow={
                <TableLoading message="Loading sinking fund collections..." />
              }
            />
          </div>
        </div>
      </section>
      {/* Loan Collection Monthly */}
      <section>
        <h3 className="mb-1 text-lg font-semibold text-slate-900">
          Loan Collection (Monthly)
        </h3>
        <p className="mb-4 text-sm text-slate-500">
          Monthly loan repayment targets and actual collections.
        </p>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="h-105 overflow-y-scroll">
            <DataTable
              data={MONTHS}
              columns={loanCollectionColumns}
              getRowKey={(month) => month}
              tableClassName={`${tableClass} relative`}
              thClassName={thClass}
              tdClassName={tdClass}
              loading={loading}
              loadingRow={
                <TableLoading message="Loading loan collections..." />
              }
            />
          </div>
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
