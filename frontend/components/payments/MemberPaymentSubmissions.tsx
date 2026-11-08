"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Receipt, X } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/utils/loans";
import DataTable from "@/components/ui/DataTable";
import TableLoading from "@/components/ui/TableLoading";
import { tableClass, tdClass, thClass } from "@/components/ui/table-styles";
import type { Loan, PaymentSubmission, DataTableColumn } from "@/lib/types";


const inputClass = "dlmsf-control mt-1";
const today = () => { const d = new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };

export default function MemberPaymentSubmissions() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [rows, setRows] = useState<PaymentSubmission[]>([]);
  const [loanId, setLoanId] = useState("");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(today());
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [loanRows, submissions] = await Promise.all([
        apiRequest<Loan[]>("/api/loans"),
        apiRequest<PaymentSubmission[]>("/api/payments/submissions"),
      ]);
      setLoans(loanRows.filter(row => row.status !== "Paid"));
      setRows(submissions.filter(row => row.payment_type === "Loan"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load payment records.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const selectedLoan = loans.find(row => String(row.id) === loanId);
  useEffect(() => {
    if (selectedLoan) setAmount(Number(selectedLoan.monthly || 0).toFixed(2));
    else setAmount("");
  }, [selectedLoan]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !selectedLoan) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await apiRequest("/api/payments/submissions", {
        method: "POST",
        body: JSON.stringify({ paymentType: "Loan", amount: Number(amount), paidOn, loanId: Number(loanId), reference }),
      });
      setReference(""); setOpen(false); setNotice("Loan repayment submitted for administrator confirmation."); await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to submit loan repayment.");
    } finally { setBusy(false); }
  }

  const columns: DataTableColumn<PaymentSubmission>[] = [
    { key: "amount", header: "Amount", render: row => formatCurrency(Number(row.amount)) },
    { key: "loan", header: "Loan", render: row => row.loan_id ? "Loan #" + row.loan_id : "—" },
    { key: "date", header: "Date paid", render: row => row.paid_on ? new Date(row.paid_on + "T00:00:00").toLocaleDateString("en-PH") : "—" },
    { key: "reference", header: "Reference", render: row => row.reference || "—" },
    { key: "status", header: "Status", render: row => <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + (row.status === "Confirmed" ? "bg-emerald-50 text-emerald-700" : row.status === "Rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700")}>{row.status}</span> },
    { key: "remarks", header: "Admin remarks", render: row => row.admin_remarks || "—" },
  ];
  const pending = rows.filter(row => row.status === "Pending").length;
  const confirmed = rows.filter(row => row.status === "Confirmed").length;

  return <div className="space-y-6">
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">My Loan Payments</h1><p className="mt-1 text-sm text-slate-500">Submit loan repayments and track administrator confirmation. Weekly contributions are recorded by the administrator.</p></div><button type="button" onClick={() => setOpen(true)} disabled={loading || loans.length === 0} className="dlmsf-btn dlmsf-btn-primary disabled:opacity-50"><Receipt size={17}/>Submit loan repayment</button></header>
    {error && <p role="alert" className="dlmsf-alert dlmsf-alert-danger">{error}</p>}
    {notice && <p role="status" className="dlmsf-alert dlmsf-alert-success">{notice}</p>}
    <section className="grid gap-4 sm:grid-cols-3"><article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Loan submissions</p><p className="mt-2 text-2xl font-bold">{rows.length}</p></article><article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Confirmed</p><p className="mt-2 text-2xl font-bold text-emerald-700">{confirmed}</p></article><article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Pending review</p><p className="mt-2 text-2xl font-bold text-amber-700">{pending}</p></article></section>
    <section className="overflow-hidden dlmsf-card"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold">Loan repayment submissions</h2><p className="mt-1 text-sm text-slate-500">A repayment is applied to your loan after an administrator confirms it.</p></div><div className="overflow-x-auto"><DataTable data={rows} columns={columns} getRowKey={row => row.id} tableClassName={tableClass} thClassName={thClass} tdClassName={tdClass} loading={loading} loadingRow={<TableLoading message="Loading loan submissions..." colSpan={columns.length}/>} emptyMessage="No loan repayment submissions yet."/></div></section>
    {open && <div className="animate-modal-backdrop fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="loan-payment-title" className="animate-modal-panel max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><span className="mb-3 inline-flex rounded-lg bg-blue-50 p-2 text-blue-700"><Receipt size={20}/></span><h2 id="loan-payment-title" className="text-lg font-semibold text-slate-900">Submit loan repayment</h2><p className="mt-1 text-sm text-slate-500">Provide the amount and payment details for administrator review.</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Close modal" className="dlmsf-btn dlmsf-btn-outline dlmsf-btn-sm !min-h-0 !border-0 !p-2"><X size={19}/></button></div><form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700 sm:col-span-2">Loan<select required value={loanId} onChange={event => setLoanId(event.target.value)} className={inputClass}><option value="">Select loan</option>{loans.map(loan => <option key={loan.id} value={loan.id}>Loan #{loan.id} · Monthly {formatCurrency(Number(loan.monthly))}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Amount (₱)<input required type="number" min={selectedLoan ? Number(selectedLoan.monthly) : 0.01} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} className={inputClass}/><span className="mt-1 block text-xs font-normal text-slate-500">Monthly due: {selectedLoan ? formatCurrency(Number(selectedLoan.monthly)) : "Select a loan"}.</span></label><label className="text-sm font-medium text-slate-700">Date paid<input required type="date" max={today()} value={paidOn} onChange={event => setPaidOn(event.target.value)} className={inputClass}/></label><label className="text-sm font-medium text-slate-700 sm:col-span-2">Reference / note (optional)<input value={reference} onChange={event => setReference(event.target.value)} maxLength={160} className={inputClass}/></label><p className="rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-800 sm:col-span-2">Loan repayments are not applied until an administrator confirms the submission.</p><div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button><button disabled={busy || !selectedLoan || !amount || Number(amount) <= 0} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{busy ? "Submitting..." : "Submit for confirmation"}</button></div></form></section></div>}
  </div>;
}
