"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Wallet, HandCoins, CircleDollarSign, PiggyBank } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiRequest } from "@/lib/api";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import TableLoading from "@/components/ui/TableLoading";
import { RATE } from "@/lib/constants/member";

type Member = { id: number; name?: string; heads?: number; auth_id?: string };
type Loan = { id: number; borrower_id: number; amount: number | string; interest: number; total: number; monthly: number; months: number; status: string | null };
type Payment = { id: number; amount: number | string; week_start: string };
type LoanPayment = { id: number | string; member_id: number; amount: number | string; paid_at: string; action?: string };
type Summary = { members: Member[]; payments: Payment[]; loans: Loan[]; loanPayments: LoanPayment[] };

const money = (value: number) => `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monthLabel = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", { month: "long", year: "numeric" });

export default function MemberDashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Please sign in again.");
      const { data: profile, error: profileError } = await supabase.from("members").select("id,name,heads,auth_id").eq("auth_id", user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile) throw new Error("Your member profile could not be found.");
      const summary = await apiRequest<Summary>("/api/dashboard");
      setMember(profile as Member); setData(summary);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load your dashboard."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const ownLoans = data?.loans.filter((loan) => loan.borrower_id === member?.id) ?? [];
  const ownLoanPayments = data?.loanPayments.filter((payment) => payment.member_id === member?.id) ?? [];
  const ownWeekly = data?.payments ?? [];
  const totalContributed = ownWeekly.length * Number(member?.heads ?? 0) * RATE;
  const totalLoans = ownLoans.reduce((sum, loan) => sum + Number(loan.total || 0), 0);
  const outstanding = ownLoans.filter((loan) => loan.status?.toLowerCase() !== "paid").reduce((sum, loan) => sum + Number(loan.total || 0), 0);
  const sinkingFundGrowth = ownLoanPayments.filter((p) => !p.action || !/pending|rejected/i.test(p.action)).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const now = new Date();
  const currentMonth = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const monthlyWeeks = ownWeekly.filter((p) => monthLabel(p.week_start) === currentMonth).length;
  const weeklyRows = [...new Set(ownWeekly.map((p) => monthLabel(p.week_start)))].map((month) => ({ month, weeks: ownWeekly.filter((p) => monthLabel(p.week_start) === month).length }));
  const columns: DataTableColumn<{ month: string; weeks: number }>[] = [
    { key: "month", header: "Month", render: (row) => row.month },
    { key: "weeks", header: "Collections", render: (row) => row.weeks },
    { key: "amount", header: "My contribution", render: (row) => money(row.weeks * Number(member?.heads ?? 0) * RATE) },
  ];
  const cards = [
    { label: "Total contributed", value: money(totalContributed), detail: "Weekly sinking fund contributions", icon: Wallet, color: "text-blue-700 bg-blue-50" },
    { label: "Total loans", value: money(totalLoans), detail: "Principal plus interest", icon: HandCoins, color: "text-violet-700 bg-violet-50" },
    { label: "Outstanding loan", value: money(outstanding), detail: "Remaining amount on unpaid loans", icon: CircleDollarSign, color: "text-amber-700 bg-amber-50" },
    { label: "Sinking fund growth", value: money(sinkingFundGrowth), detail: "Confirmed loan repayments recorded", icon: PiggyBank, color: "text-emerald-700 bg-emerald-50" },
  ];

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div><h2 className="text-2xl font-bold text-slate-900">My Dashboard</h2><p className="mt-1 text-sm text-slate-500">Your contributions, loans, and sinking fund activity{member?.name ? ` · ${member.name}` : ""}.</p></div>
      <button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/>{loading ? "Refreshing..." : "Refresh"}</button>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, detail, icon: Icon, color }) => <article key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className={`rounded-lg p-2 ${color}`}><Icon size={20}/></span></div><p className="mt-4 text-2xl font-bold tabular-nums text-slate-900">{loading ? "—" : value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></article>)}
    </section>
    <section className="grid gap-4 lg:grid-cols-3">
      <article className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2"><h3 className="font-semibold text-slate-900">My weekly sinking fund collections</h3><p className="mt-1 text-sm text-slate-500">Monthly summary based on your registered heads and the weekly collection schedule.</p><div className="mt-4">{loading ? <TableLoading/> : <DataTable data={weeklyRows} columns={columns} emptyMessage="No weekly collections have been recorded yet."/>}</div></article>
      <article className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold text-slate-900">This month</h3><p className="mt-4 text-3xl font-bold text-blue-700">{loading ? "—" : money(monthlyWeeks * Number(member?.heads ?? 0) * RATE)}</p><p className="mt-1 text-sm text-slate-500">{monthlyWeeks} weekly collection{monthlyWeeks === 1 ? "" : "s"} recorded this month</p><div className="mt-5 border-t border-slate-100 pt-4"><p className="text-xs text-slate-500">Registered heads</p><p className="mt-1 text-lg font-semibold text-slate-800">{loading ? "—" : member?.heads ?? 0}</p><p className="mt-3 text-xs text-slate-500">Weekly rate per head</p><p className="mt-1 text-lg font-semibold text-slate-800">{money(RATE)}</p></div></article>
    </section>
  </div>;
}
