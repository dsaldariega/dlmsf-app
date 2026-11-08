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

  useEffect(() => {
    let active = true;
    apiRequest<{ payments: Payment[]; loanPayments: LoanPayment[] }>("/api/payments")
      .then(data => { if (active) { setPayments(data.payments); setLoanPayments(data.loanPayments); } })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to load payment records."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const total = payments.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const weeklyColumns: DataTableColumn<Payment>[] = [
    { key: "week", header: "Week start", render: row => row.week_start },
    { key: "amount", header: "Recorded contributions", render: row => <span className="font-semibold text-emerald-700">{formatCurrency(Number(row.amount || 0))}</span> },
  ];
  const loanColumns: DataTableColumn<LoanPayment>[] = [
    { key: "borrower", header: "Borrower", render: row => row.borrower || "—" },
    { key: "amount", header: "Amount", render: row => <span className="font-semibold text-purple-700">{formatCurrency(Number(row.amount || 0))}</span> },
    { key: "paid", header: "Date paid", render: row => row.paid_at ? new Date(row.paid_at + "T00:00:00").toLocaleDateString("en-PH") : "—" },
  ];

  return <div className="space-y-6">
    <header><h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Payment records</h1><p className="mt-1 text-sm text-slate-500">Review recorded weekly contributions and loan repayments.</p></header>
    {error && <p role="alert" className="dlmsf-alert dlmsf-alert-danger">{error}</p>}
    <section className="grid gap-4 sm:grid-cols-2">
      <article className="dlmsf-card p-5"><p className="text-sm font-medium text-slate-500">Total weekly contributions</p><p className="mt-2 text-2xl font-bold tabular-nums text-emerald-700">{loading ? "—" : formatCurrency(total)}</p></article>
      <article className="dlmsf-card p-5"><p className="text-sm font-medium text-slate-500">Weekly collection weeks</p><p className="mt-2 text-2xl font-bold tabular-nums text-blue-700">{loading ? "—" : payments.length.toLocaleString("en-PH")}</p></article>
    </section>
    <section className="overflow-hidden dlmsf-card"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Weekly contribution history</h2><p className="mt-1 text-sm text-slate-500">Totals are calculated from the individual member records for each week.</p></div><div className="overflow-x-auto"><DataTable data={payments} columns={weeklyColumns} getRowKey={row => row.week_start} tableClassName={tableClass} thClassName={thClass} tdClassName={tdClass} loading={loading} loadingRow={<TableLoading message="Loading weekly records..." colSpan={weeklyColumns.length}/>} emptyMessage="No weekly contributions recorded yet."/></div></section>
    <section className="overflow-hidden dlmsf-card"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Loan repayment records</h2><p className="mt-1 text-sm text-slate-500">Confirmed loan repayments remain separate from weekly contributions.</p></div><div className="overflow-x-auto"><DataTable data={loanPayments} columns={loanColumns} getRowKey={row => String(row.id)} tableClassName={tableClass} thClassName={thClass} tdClassName={tdClass} loading={loading} loadingRow={<TableLoading message="Loading loan payments..." colSpan={loanColumns.length}/>} emptyMessage="No loan repayments recorded yet."/></div></section>
  </div>;
}
