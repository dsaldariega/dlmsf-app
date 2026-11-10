"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users,
  Wallet,
  Landmark,
  HandCoins,
  TrendingUp,
  RefreshCw,
  ClipboardList,
  Receipt,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { withAuth } from "@/lib/withAuth";
import type {
  DataTableColumn,
  Loan,
  LoanPayment,
  Member,
  Payment,
} from "@/lib/types";
import { CUTOFF_MONTHS, MONTHS } from "@/lib/constants/dashboard";
import { motion, AnimatePresence } from "motion/react";
import { tableClass, tdClass, thClass } from "@/components/ui/table-styles";
import DataTable from "@/components/ui/DataTable";
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
  const [loanRequests, setLoanRequests] = useState<
    Array<{ id: number; status: string }>
  >([]);
  const [paymentSubmissions, setPaymentSubmissions] = useState<
    Array<{ id: number; payment_type: string; status: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [data, requests, submissions] = await Promise.all([
        apiRequest<{
          members: Member[];
          payments: Payment[];
          loans: Loan[];
          loanPayments: LoanPayment[];
        }>("/api/dashboard"),
        apiRequest<Array<{ id: number; status: string }>>(
          "/api/loans/requests",
        ),
        apiRequest<Array<{ id: number; payment_type: string; status: string }>>(
          "/api/payments/submissions",
        ),
      ]);
      setMembers(data.members);
      setPayments(data.payments);
      setLoans(data.loans);
      setLoanPayments(data.loanPayments);
      setLoanRequests(requests);
      setPaymentSubmissions(submissions);
    } catch (error) {
      console.error("Dashboard API error:", error);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load dashboard data. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const heads = members.reduce((sum, member) => sum + amount(member.heads), 0);

  const totalSinkingCollected = payments.reduce(
    (sum, payment) => sum + amount(payment.amount),
    0,
  );

  const totalLoanRepaymentsCollected = loanPayments.reduce(
    (sum, payment) => sum + amount(payment.amount),
    0,
  );

  const totalLoanPrincipalDisbursed = loans.reduce(
    (sum, loan) => sum + amount(loan.amount),
    0,
  );

  // Loan repayments return principal and interest to the available fund.
  const availableFunds =
    totalSinkingCollected +
    totalLoanRepaymentsCollected -
    totalLoanPrincipalDisbursed;

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

    return sundays.reduce((sum, payment) => sum + amount(payment.amount), 0);
  };

  // Keep the dashboard target in sync with the monthly installment values
  // shown on the Loan Admin page. Paid loans no longer contribute to the
  // expected monthly collection target.
  const getMonthlyLoanTarget = (month: string): number | null => {
    if (CUTOFF_MONTHS.includes(month)) return null;

    return loans
      .filter((loan) => loan.status !== "Paid")
      .reduce((sum, loan) => sum + amount(loan.monthly), 0);
  };

  const getMonthlyLoanCollected = (month: string) =>
    loanPayments
      .filter((payment) => monthOf(payment.paid_at) === month)
      .reduce((sum, payment) => sum + amount(payment.amount), 0);

  const cardClass = "dlmsf-card p-5 transition-shadow hover:shadow-md";

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
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}
          >
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
      <div className="dlmsf-page-header">
        <div>
          <h2 className="dlmsf-page-title">Dashboard Overview</h2>
          <p className="dlmsf-page-subtitle">
            Monitor members, sinking fund contributions, and loan collections.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className="dlmsf-btn dlmsf-btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
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
                  {loading ? "—" : currency(totalLoanRepaymentsCollected)}
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
          Request monitoring
        </h3>
        <p className="mb-4 text-sm text-slate-500">
          Track member loan requests and payment submissions separately.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              title: "Loan requests",
              total: loanRequests.length,
              approved: loanRequests.filter((x) => x.status === "Approved")
                .length,
              pending: loanRequests.filter((x) => x.status === "Pending")
                .length,
              href: "/loans",
              Icon: ClipboardList,
            },
            {
              title: "Weekly payment requests",
              total: paymentSubmissions.filter(
                (x) => x.payment_type === "Weekly",
              ).length,
              approved: paymentSubmissions.filter(
                (x) => x.payment_type === "Weekly" && x.status === "Confirmed",
              ).length,
              pending: paymentSubmissions.filter(
                (x) => x.payment_type === "Weekly" && x.status === "Pending",
              ).length,
              href: "/payments",
              Icon: Receipt,
            },
            {
              title: "Loan repayment requests",
              total: paymentSubmissions.filter((x) => x.payment_type === "Loan")
                .length,
              approved: paymentSubmissions.filter(
                (x) => x.payment_type === "Loan" && x.status === "Confirmed",
              ).length,
              pending: paymentSubmissions.filter(
                (x) => x.payment_type === "Loan" && x.status === "Pending",
              ).length,
              href: "/payments",
              Icon: HandCoins,
            },
          ].map((item) => (
            <a
              key={item.title}
              href={item.href}
              className="dlmsf-card p-5 transition hover:border-blue-200 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-600">
                  {item.title}
                </p>
                <item.Icon className="text-blue-600" size={21} />
              </div>
              <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">
                {loading ? "—" : item.total}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span className="font-medium text-emerald-700">
                  {item.approved} approved
                </span>
                <span className="font-medium text-amber-700">
                  {item.pending} pending
                </span>
              </div>
            </a>
          ))}
          <article className="dlmsf-card bg-slate-50 p-5">
            <p className="text-sm font-medium text-slate-600">All requests</p>
            <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">
              {loading ? "—" : loanRequests.length + paymentSubmissions.length}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className="font-medium text-emerald-700">
                {loanRequests.filter((x) => x.status === "Approved").length +
                  paymentSubmissions.filter((x) => x.status === "Confirmed")
                    .length}{" "}
                approved
              </span>
              <span className="font-medium text-amber-700">
                {loanRequests.filter((x) => x.status === "Pending").length +
                  paymentSubmissions.filter((x) => x.status === "Pending")
                    .length}{" "}
                pending
              </span>
            </div>
          </article>
        </div>
      </section>
      <section>
        <h3 className="mb-1 text-lg font-semibold text-slate-900">
          Sinking Fund Collection (Monthly)
        </h3>
        <p className="mb-4 text-sm text-slate-500">
          Monthly contribution targets and actual collections.
        </p>

        <div className="dlmsf-card overflow-x-auto">
          <div className="max-h-[26rem] overflow-y-auto">
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

        <div className="dlmsf-card overflow-x-auto">
          <div className="max-h-[26rem] overflow-y-auto">
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
