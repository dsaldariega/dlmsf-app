"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Wallet, HandCoins, CircleDollarSign, PiggyBank } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiRequest } from "@/lib/api";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import { RATE } from "@/lib/constants/member";

type Member = { id: number; name?: string; heads?: number };
type Loan = { id: number; borrower_id: number; amount: number | string; total: number; months: number; status: string | null };
type Payment = { id: number; week_start: string; amount: number | string };
type LoanPayment = { id: number | string; member_id: number; amount: number | string; paid_at: string; action?: string };
type Data = { payments: Payment[]; loans: Loan[]; loanPayments: LoanPayment[] };
const money = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monthOf = (date: string) => new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });

export default function MemberDashboard() {
  const [member, setMember] = useState<Member | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Please sign in again.");
      const { data: profile, error: profileError } = await supabase.from("members").select("id,name,heads").eq("auth_id", user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile) throw new Error("Your member profile could not be found.");
      const summary = await apiRequest<Data>("/api/dashboard");
      setMember(profile as Member); setData(summary);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load dashboard."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const loans = data?.loans.filter(x => x.borrower_id === member?.id) ?? [];
  const repayments = data?.loanPayments.filter(x => x.member_id === member?.id) ?? [];
  const weeks = data?.payments ?? [];
  const contributed = weeks.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const loanTotal = loans.reduce((s, x) => s + Number(x.total || 0), 0);
  const outstanding = loans.filter(x => x.status?.toLowerCase() !== "paid").reduce((s, x) => s + Number(x.total || 0), 0);
  const fundGrowth = repayments.filter(x => !/pending|rejected/i.test(x.action || "")).reduce((s, x) => s + Number(x.amount || 0), 0);
  const thisMonth = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const currentMonthPayments = weeks.filter(x => monthOf(x.week_start) === thisMonth);
  const monthlyWeeks = currentMonthPayments.length;
  const monthlyContribution = currentMonthPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const months = [...new Set(weeks.map(x => monthOf(x.week_start)))].map(month => { const monthRows = weeks.filter(x => monthOf(x.week_start) === month); return { month, count: monthRows.length, amount: monthRows.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) }; });
  const loanColumns: DataTableColumn<Loan>[] = [
    { key: "amount", header: "Loan amount", render: x => money(Number(x.amount || 0)) },
    { key: "terms", header: "Terms", render: x => String(x.months) + " months" },
    { key: "total", header: "Total incl. interest", render: x => money(Number(x.total || 0)) },
    { key: "status", header: "Status", render: x => x.status || "Unknown" },
  ];
  const columns: DataTableColumn<{month:string;count:number;amount:number}>[] = [
    { key: "month", header: "Month", render: x => x.month },
    { key: "count", header: "Collections", render: x => x.count },
    { key: "share", header: "Confirmed contribution", render: x => money(x.amount) },
  ];
  const cards = [
    { label: "Total contributed", value: money(contributed), hint: "Confirmed weekly payment submissions", Icon: Wallet, color: "text-blue-700 bg-blue-50" },
    { label: "Total loans", value: money(loanTotal), hint: "Loan principal plus interest", Icon: HandCoins, color: "text-violet-700 bg-violet-50" },
    { label: "Outstanding loan", value: money(outstanding), hint: "Total due on unpaid loans", Icon: CircleDollarSign, color: "text-amber-700 bg-amber-50" },
    { label: "Sinking fund growth", value: money(fundGrowth), hint: "Recorded loan repayments", Icon: PiggyBank, color: "text-emerald-700 bg-emerald-50" },
  ];
  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div><h2 className="text-2xl font-bold text-slate-900">My Dashboard</h2><p className="mt-1 text-sm text-slate-500">Your financial overview{member?.name ? " · " + member.name : ""}.</p></div>
      <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/>{loading ? "Refreshing..." : "Refresh"}</button>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({label,value,hint,Icon,color}) => <article key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm text-slate-500">{label}</p><span className={`rounded-lg p-2 ${color}`}><Icon size={20}/></span></div><p className="mt-4 text-2xl font-bold tabular-nums">{loading ? "—" : value}</p><p className="mt-1 text-xs text-slate-500">{hint}</p></article>)}
    </section>
    <section className="grid gap-4 lg:grid-cols-3">
      <article className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2"><h3 className="font-semibold text-slate-900">My weekly sinking fund collections</h3><p className="mt-1 text-sm text-slate-500">Monthly summary of confirmed weekly contributions.</p><div className="mt-4">{loading ? <p className="py-8 text-center text-sm text-slate-500">Loading records...</p> : <DataTable data={months} columns={columns} getRowKey={x => x.month} emptyMessage="No weekly collections have been recorded yet."/>}</div></article>
      <article className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold">This month</h3><p className="mt-4 text-3xl font-bold text-blue-700">{loading ? "—" : money(monthlyContribution)}</p><p className="mt-1 text-sm text-slate-500">{monthlyWeeks} group collection weeks recorded</p><div className="mt-5 border-t border-slate-100 pt-4 text-sm"><p className="text-slate-500">Registered heads</p><p className="mt-1 text-lg font-semibold">{member?.heads ?? "—"}</p></div></article>
    </section>
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-4 font-semibold text-slate-900">My loan records</h3>
      {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading records...</p> : <DataTable data={loans} columns={loanColumns} getRowKey={x => x.id} emptyMessage="No loans available." />}
    </section>
  </div>;
}
