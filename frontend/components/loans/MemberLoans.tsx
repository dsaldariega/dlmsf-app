"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils/loans";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import TableLoading from "@/components/ui/TableLoading";
import { HandCoins, Info } from "lucide-react";

type Loan = { id: number; borrower_id: number; amount: number | string | null; interest: number; total: number; monthly: number; months: number; status: string | null };
export default function MemberLoans() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("Please sign in again.");
        const { data: member, error: memberError } = await supabase.from("members").select("id").eq("auth_id", user.id).maybeSingle();
        if (memberError) throw memberError;
        if (!member) throw new Error("Your member profile could not be found.");
        const rows = await apiRequest<Loan[]>("/api/loans");
        if (active) setLoans(rows.filter((loan) => loan.borrower_id === member.id));
      } catch (err) { if (active) setError(err instanceof Error ? err.message : "Unable to load loans."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);
  const total = loans.reduce((sum, loan) => sum + Number(loan.total || 0), 0);
  const outstanding = loans.filter((loan) => loan.status?.toLowerCase() !== "paid").reduce((sum, loan) => sum + Number(loan.total || 0), 0);
  const columns: DataTableColumn<Loan>[] = [
    { key: "amount", header: "Loan amount", render: (loan) => formatCurrency(Number(loan.amount || 0)) },
    { key: "terms", header: "Terms", render: (loan) => `${loan.months} ${loan.months === 1 ? "month" : "months"}` },
    { key: "total", header: "Total with interest", render: (loan) => <span className="font-semibold">{formatCurrency(Number(loan.total || 0))}</span> },
    { key: "monthly", header: "Monthly due", render: (loan) => formatCurrency(Number(loan.monthly || 0)) },
    { key: "status", header: "Status", render: (loan) => <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${loan.status?.toLowerCase() === "paid" ? "bg-emerald-50 text-emerald-700" : loan.status?.toLowerCase() === "pending" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{loan.status || "Unknown"}</span> },
  ];
  return <div className="space-y-6">
    <div><h2 className="text-2xl font-bold text-slate-900">My Loans</h2><p className="mt-1 text-sm text-slate-500">Review your loan terms, repayment status, and remaining balance.</p></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Total loans (including interest)</p><p className="mt-2 text-2xl font-bold">{loading ? "—" : formatCurrency(total)}</p></div><div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Outstanding loan balance</p><p className="mt-2 text-2xl font-bold text-amber-700">{loading ? "—" : formatCurrency(outstanding)}</p></div></div>
    <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="mb-4 flex items-center gap-2"><HandCoins className="text-blue-600" size={20}/><h3 className="font-semibold">Loan history</h3></div>{loading ? <TableLoading/> : <DataTable data={loans} columns={columns} emptyMessage="You don't have any loans yet."/>}</section>
    <aside className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><Info size={19} className="mt-0.5 shrink-0"/><div><p className="font-semibold">Loan requests</p><p className="mt-1 text-blue-800">Loan requests and available-fund checks need an approval workflow on the admin side. For now, loan records shown here are read-only; only an administrator can create, approve, or delete loan records.</p></div></aside>
  </div>;
}
