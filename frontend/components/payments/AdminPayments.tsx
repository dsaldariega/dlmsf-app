"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { DataTableColumn, LoanPayment } from "@/lib/types";
import DataTable from "@/components/ui/DataTable";
import TableLoading from "@/components/ui/TableLoading";
import { formatCurrency } from "@/lib/utils/loans";
import { tableClass, tdClass, thClass } from "@/components/ui/table-styles";
import WeeklyContributions from "@/components/payments/WeeklyContributions";

export default function AdminPayments() {
  const [loanPayments, setLoanPayments] = useState<LoanPayment[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(true);
  const [loanError, setLoanError] = useState("");
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
  const [weeklyRefreshKey, setWeeklyRefreshKey] = useState(0);

  async function loadLoanPayments() {
    setLoadingLoans(true);
    setLoanError("");
    try {
      const data = await apiRequest<{ loanPayments: LoanPayment[] }>("/api/payments");
      setLoanPayments(data.loanPayments);
    } catch (e) {
      setLoanError(
        e instanceof Error ? e.message : "Unable to load loan repayment submissions.",
      );
    } finally {
      setLoadingLoans(false);
    }
  }

  useEffect(() => {
    void loadLoanPayments();
  }, []);

  async function generateAllWeeklyPayments() {
    if (generating) return;
    if (
      !window.confirm(
        `Generate weekly payment records for all members for Sunday ${weekStart}? This will record the remaining weekly due for each member as paid.`,
      )
    ) {
      return;
    }

    setGenerating(true);
    setLoanError("");
    setGenerationNotice("");

    try {
      const today = new Date();
      const paidOn = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0"),
      ].join("-");
      const result = await apiRequest<{
        membersUpdated: number;
        totalGenerated: number;
      }>("/api/payments/weekly/generate-all", {
        method: "POST",
        body: JSON.stringify({ weekStart, paidOn }),
      });

      setGenerationNotice(
        `Generated weekly payments for ${result.membersUpdated} member${result.membersUpdated === 1 ? "" : "s"} totaling ${formatCurrency(Number(result.totalGenerated || 0))}.`,
      );
      setWeeklyRefreshKey((value) => value + 1);
      await loadLoanPayments();
    } catch (e) {
      setLoanError(
        e instanceof Error ? e.message : "Unable to generate weekly payments.",
      );
    } finally {
      setGenerating(false);
    }
  }

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
        Admin Payments
      </h1>

      {generationNotice && (
        <p role="status" className="dlmsf-alert dlmsf-alert-success">
          {generationNotice}
        </p>
      )}

      <WeeklyContributions
        weekStart={weekStart}
        onWeekStartChange={setWeekStart}
        refreshKey={weeklyRefreshKey}
        bulkAction={
          <button
            type="button"
            onClick={generateAllWeeklyPayments}
            disabled={generating}
            className="dlmsf-btn dlmsf-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
          >
            {generating
              ? "Generating..."
              : "Generate weekly payment for all members"}
          </button>
        }
      />

      <section className="space-y-1">
        <h2 className="text-xl font-bold text-slate-900">Loan Payments</h2>
        <p className="text-sm text-slate-500">Loan repayment submissions.</p>
      </section>

      {loanError && (
        <p role="alert" className="dlmsf-alert dlmsf-alert-danger">
          {loanError}
        </p>
      )}

      <section className="dlmsf-card overflow-hidden">
        <div className="overflow-x-auto">
          <DataTable
            data={loanPayments}
            columns={loanColumns}
            getRowKey={(row) => String(row.id)}
            tableClassName={tableClass}
            thClassName={thClass}
            tdClassName={tdClass}
            loading={loadingLoans}
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
