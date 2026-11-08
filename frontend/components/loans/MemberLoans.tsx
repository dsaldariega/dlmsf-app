"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/utils/loans";
import DataTable from "@/components/ui/DataTable";
import { HandCoins, Info } from "lucide-react";
import type { DataTableColumn, Loan } from "@/lib/types";


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
        if (active) setLoans(rows.filter(x => x.borrower_id === member.id));
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Unable to load your loans."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);
  const total = loans.reduce((s,x) => s + Number(x.total || 0), 0);
  const balance = loans.filter(x => x.status?.toLowerCase() !== "paid").reduce((s,x) => s + Number(x.total || 0), 0);
  const columns: DataTableColumn<Loan>[] = [
    { key: "amount", header: "Loan amount", render: x => formatCurrency(Number(x.amount || 0)) },
    { key: "terms", header: "Terms", render: x => `${x.months} ${x.months === 1 ? "month" : "months"}` },
    { key: "interest", header: "Interest", render: x => formatCurrency(Number(x.interest || 0)) },
    { key: "total", header: "Total incl. interest", render: x => <span className="font-semibold">{formatCurrency(Number(x.total || 0))}</span> },
    { key: "monthly", header: "Monthly due", render: x => formatCurrency(Number(x.monthly || 0)) },
    { key: "status", header: "Status", render: x => <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${x.status?.toLowerCase() === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{x.status || "Unknown"}</span> },
  ];
  return <div className="space-y-6">
    <div><h2 className="text-2xl font-bold text-slate-900">My Loans</h2><p className="mt-1 text-sm text-slate-500">Your loan terms, repayment status, and remaining balance.</p></div>
    {error && <p role="alert" className="dlmsf-alert dlmsf-alert-danger">{error}</p>}
    <div className="grid gap-4 sm:grid-cols-2"><article className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Total loans including interest</p><p className="mt-2 text-2xl font-bold">{loading ? "—" : formatCurrency(total)}</p></article><article className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Outstanding loan balance</p><p className="mt-2 text-2xl font-bold text-amber-700">{loading ? "—" : formatCurrency(balance)}</p></article></div>
    <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="mb-4 flex items-center gap-2"><HandCoins size={20} className="text-blue-600"/><h3 className="font-semibold">Loan history</h3></div>{loading ? <p className="py-8 text-center text-sm text-slate-500">Loading records...</p> : <DataTable data={loans} columns={columns} getRowKey={x => x.id} emptyMessage="No loans available."/>}</section>
    <aside className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><Info size={19} className="mt-0.5 shrink-0"/><div><p className="font-semibold">Loan requests</p><p className="mt-1">The current database workflow creates loans directly from the admin side. Member loan requests, pending-request checks, available-fund validation, and admin approval need a dedicated request/approval record before they can safely be enabled. Existing loans are read-only here.</p></div></aside>
  </div>;
}
