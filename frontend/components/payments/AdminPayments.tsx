"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { DataTableColumn, LoanPayment, Payment } from "@/lib/types";
import DataTable from "@/components/ui/DataTable";
import TableLoading from "@/components/ui/TableLoading";
import { formatCurrency } from "@/lib/utils/loans";
import { tableClass, tdClass, thClass } from "@/components/ui/table-styles";

export default function AdminPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loanPayments, setLoanPayments] = useState<LoanPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generationNotice, setGenerationNotice] = useState("");
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - today.getDay());
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  useEffect(() => {
    let active = true;
    apiRequest<{ payments: Payment[]; loanPayments: LoanPayment[] }>(
      "/api/payments",
    )
      .then((data) => {
        if (active) {
          setPayments(data.payments);
          setLoanPayments(data.loanPayments);
        }
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "Unable to load payment records.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function generateAllWeeklyPayments() {
    if (generating) return;
    if (
      !window.confirm(
        `Generate weekly payment records for all members for Sunday ${weekStart}? This will record the remaining weekly due for each member as paid.`,
      )
    )
      return;

    setGenerating(true);
    setError("");
    setGenerationNotice("");

    try {
      const result = await apiRequest<{
        membersUpdated: number;
        totalGenerated: number;
      }>("/api/payments/weekly/generate-all", {
        method: "POST",
        body: JSON.stringify({
          weekStart,
          paidOn: (() => {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, "0");
            const day = String(today.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
          })(),
        }),
      });

      setGenerationNotice(
        `Generated weekly payments for ${result.membersUpdated} member${result.membersUpdated === 1 ? "" : "s"} totaling ${formatCurrency(Number(result.totalGenerated || 0))}.`,
      );

      const refreshed = await apiRequest<{
        payments: Payment[];
        loanPayments: LoanPayment[];
      }>("/api/payments");

      setPayments(refreshed.payments);
      setLoanPayments(refreshed.loanPayments);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to generate weekly payments.",
      );
    } finally {
      setGenerating(false);
    }
  }

  const weeklyColumns: DataTableColumn<Payment>[] = [
    {
      key: "week",
      header: "Week start",
      render: (row) => row.week_start,
    },
    {
      key: "amount",
      header: "Recorded contributions",
      render: (row) => (
        <span className="font-semibold text-emerald-700">
          {formatCurrency(Number(row.amount || 0))}
        </span>
      ),
    },
  ];

  const loanColumns: DataTableColumn<LoanPayment>[] = [
    {
      key: "borrower",
      header: "Borrower",
      render: (row) => row.borrower || "—",
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) => (
        <span className="font-semibold text-purple-700">
          {formatCurrency(Number(row.amount || 0))}
        </span>
      ),
    },
    {
      key: "paid",
      header: "Date paid",
      render: (row) =>
        row.paid_at
          ? new Date(row.paid_at + "T00:00:00").toLocaleDateString("en-PH")
          : "—",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
        Payments
      </h1>

      {error && (
        <p role="alert" className="dlmsf-alert dlmsf-alert-danger">
          {error}
        </p>
      )}

      {generationNotice && (
        <p role="status" className="dlmsf-alert dlmsf-alert-success">
          {generationNotice}
        </p>
      )}

      <section>
        <h2 className="text-xl font-bold text-slate-900">
          Weekly contribution payments
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Generate the weekly payment records for all members.
        </p>
      </section>

      <section className="dlmsf-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="text-xs font-semibold text-slate-600">
              Collection week
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Choose the Sunday that starts the contribution week.
              </span>
              <input
                type="date"
                value={weekStart}
                onChange={(event) => {
                  if (event.target.value) setWeekStart(event.target.value);
                }}
                className="mt-2 block h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-700"
              />
            </label>

            <button
              type="button"
              onClick={generateAllWeeklyPayments}
              disabled={generating}
              className="dlmsf-btn dlmsf-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating
                ? "Generating..."
                : "Generate weekly payment for all members"}
            </button>
          </div>
        </div>
      </section>

      <section className="dlmsf-card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Weekly Payment Contributions</h2>
          <p className="mt-1 text-sm text-slate-500">
            Weekly contribution totals are calculated from the individual
            member records for each collection week.
          </p>
        </div>
        <div className="overflow-x-auto">
          <DataTable
            data={payments}
            columns={weeklyColumns}
            getRowKey={(row) => row.week_start}
            tableClassName={tableClass}
            thClassName={thClass}
            tdClassName={tdClass}
            loading={loading}
            loadingRow={
              <TableLoading
                message="Loading weekly records..."
                colSpan={weeklyColumns.length}
              />
            }
            emptyMessage="No weekly contributions recorded yet."
          />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900">Loan Payments</h2>
        <p className="mt-1 text-sm text-slate-500">Loan repayment submissions.</p>
      </section>

      <section className="dlmsf-card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
        </div>
        <div className="overflow-x-auto">
          <DataTable
            data={loanPayments}
            columns={loanColumns}
            getRowKey={(row) => String(row.id)}
            tableClassName={tableClass}
            thClassName={thClass}
            tdClassName={tdClass}
            loading={loading}
            loadingRow={
              <TableLoading
                message="Loading loan payments..."
                colSpan={loanColumns.length}
              />
            }
            emptyMessage="No loan repayments recorded yet."
          />
        </div>
      </section>
    </div>
  );
}
