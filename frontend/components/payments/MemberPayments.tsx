"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { apiRequest } from "@/lib/api";
import { RATE } from "@/lib/constants/member";
import { formatCurrency } from "@/lib/utils/loans";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import { CreditCard, Info } from "lucide-react";

type Weekly = { id: number; amount: number | string; week_start: string };
type LoanPayment = { id: number | string; member_id: number; amount: number | string; paid_at: string; remarks?: string; action?: string };
type PaymentData = { payments: Weekly[]; loanPayments: LoanPayment[] };
export default function MemberPayments() {
  const [rows, setRows] = useState<LoanPayment[]>([]);
  const [weekly, setWeekly] = useState<Weekly[]>([]);
  const [heads, setHeads] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("Please sign in again.");
        const { data: member, error: memberError } = await supabase.from("members").select("id,heads").eq("auth_id", user.id).maybeSingle();
        if (memberError) throw memberError;
        if (!member) throw new Error("Your member profile could not be found.");
        const data = await apiRequest<PaymentData>("/api/payments");
        if (active) { setRows(data.loanPayments.filter(x => x.member_id === member.id)); setWeekly(data.payments); setHeads(Number(member.heads || 0)); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Unable to load payment history."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);
  const weeklyColumns: DataTableColumn<Weekly>[] = [
    { key: "week_start", header: "Collection week", render: x => x.week_start },
    { key: "amount", header: "Group collection", render: x => formatCurrency(Number(x.amount || 0)) },
    { key: "share", header: "My scheduled share", render: () => formatCurrency(heads * RATE) },
  ];
  const loanColumns: DataTableColumn<LoanPayment>[] = [
    { key: "paid_at", header: "Date recorded", render: x => x.paid_at ? new Date(x.paid_at).toLocaleDateString("en-PH") : "—" },
    { key: "amount", header: "Amount", render: x => <span className="font-semibold">{formatCurrency(Number(x.amount || 0))}</span> },
    { key: "remarks", header: "Reference / remarks", render: x => x.remarks || "—" },
    { key: "action", header: "Confirmation", render: x => <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${/confirm|paid|approved/i.test(x.action || "") ? "bg-emerald-50 text-emerald-700" : /reject/i.test(x.action || "") ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{x.action || "Recorded"}</span> },
  ];
  return <div className="space-y-6">
    <div><h2 className="text-2xl font-bold text-slate-900">My Payments</h2><p className="mt-1 text-sm text-slate-500">Review weekly sinking fund collections and your loan repayment records.</p></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="mb-4 flex items-center gap-2"><CreditCard size={19} className="text-blue-600"/><h3 className="font-semibold">Weekly sinking fund collections</h3></div>{loading ? <p className="py-8 text-center text-sm text-slate-500">Loading records...</p> : <DataTable data={weekly} columns={weeklyColumns} getRowKey={x => x.id} emptyMessage="No weekly collections recorded yet."/>}<p className="mt-3 text-xs text-slate-500">Your scheduled share is calculated at ₱{RATE} per registered head. A group collection record is not proof that your individual payment was received.</p></section>
    <section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="mb-4 font-semibold">Loan payment records</h3>{loading ? <TableLoading/> : <DataTable data={rows} columns={loanColumns} getRowKey={x => x.id} emptyMessage="No loan payment records are linked to your account."/>}</section>
    <aside className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><Info size={19} className="mt-0.5 shrink-0"/><div><p className="font-semibold">Payment submission is not enabled yet</p><p className="mt-1">The current schema stores group weekly collections and recorded loan payments, but does not provide a member-submission record for weekly or loan payments. A submission table plus admin acknowledge/reject actions are required before a member can safely submit payment claims. No payment is marked as received from this page.</p></div></aside>
  </div>;
}
