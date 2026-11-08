"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, CheckCircle2, CircleDollarSign, Eye, Plus, X } from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/utils/loans";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import TableLoading from "@/components/ui/TableLoading";
import { tableClass, tdClass, thClass } from "@/components/ui/table-styles";

type MemberWeek = { id: number; name: string; heads: number; due: number; paid: number; remaining: number };
type WeeklyResponse = { weekStart: string; members: MemberWeek[] };
const localDate = (date: Date) => {
  const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, "0"), d = String(date.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
};
const sundayOf = (value: string) => {
  const date = new Date(value + "T00:00:00");
  date.setDate(date.getDate() - date.getDay());
  return localDate(date);
};
const today = localDate(new Date());
const initialWeek = sundayOf(today);

export default function WeeklyContributions() {
  const [weekStart, setWeekStart] = useState(initialWeek);
  const [members, setMembers] = useState<MemberWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MemberWeek | null>(null);
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(today);
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest<WeeklyResponse>("/api/payments/weekly?weekStart=" + weekStart);
      setMembers(result.members);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load weekly contributions.");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(() => members.reduce((total, member) => ({
    due: total.due + member.due,
    paid: total.paid + member.paid,
    paidCount: total.paidCount + (member.remaining <= 0 && member.due > 0 ? 1 : 0),
    partialCount: total.partialCount + (member.paid > 0 && member.remaining > 0 ? 1 : 0),
  }), { due: 0, paid: 0, paidCount: 0, partialCount: 0 }), [members]);

  function openMember(member: MemberWeek) {
    setSelected(member);
    setAmount(member.remaining > 0 ? member.remaining.toFixed(2) : "");
    setPaidOn(today);
    setReference("");
    setError("");
    setNotice("");
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest("/api/payments/weekly", {
        method: "POST",
        body: JSON.stringify({
          memberId: selected.id,
          weekStart,
          amount: Number(amount),
          paidOn,
          reference,
        }),
      });
      setNotice("Weekly contribution recorded for " + selected.name + ".");
      setSelected(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to record contribution.");
    } finally {
      setSaving(false);
    }
  }

  const columns: DataTableColumn<MemberWeek>[] = [
    { key: "member", header: "Member", render: member => <span className="font-semibold text-slate-800">{member.name}</span> },
    { key: "heads", header: "Heads", render: member => member.heads },
    { key: "due", header: "Weekly due", render: member => formatCurrency(member.due) },
    { key: "paid", header: "Recorded", render: member => <span className="font-semibold text-emerald-700">{formatCurrency(member.paid)}</span> },
    { key: "remaining", header: "Balance", render: member => <span className={member.remaining > 0 ? "font-semibold text-amber-700" : "font-semibold text-slate-500"}>{formatCurrency(member.remaining)}</span> },
    { key: "status", header: "Status", render: member => <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + (member.remaining <= 0 && member.due > 0 ? "bg-emerald-50 text-emerald-700" : member.paid > 0 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600")}>{member.remaining <= 0 && member.due > 0 ? "Paid" : member.paid > 0 ? "Partial" : "Unpaid"}</span> },
    { key: "actions", header: "Action", render: member => <button type="button" onClick={() => openMember(member)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"><Eye size={14}/>{member.remaining > 0 ? "Record payment" : "View"}</button> },
  ];

  return <div className="space-y-6">
    <header className="dlmsf-page-header">
      <div>
        <h2 className="dlmsf-page-title">Weekly member contributions</h2>
        <p className="dlmsf-page-subtitle">Record payments received by the administrator for each member.</p>
        <nav className="dlmsf-breadcrumbs" aria-label="Breadcrumb">
          <span>Payments</span><span aria-hidden="true">/</span><span className="font-medium text-slate-900">Weekly contributions</span>
        </nav>
      </div>
    </header>

    <section className="dlmsf-card overflow-visible">
      <div className="dlmsf-card-body">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <CalendarDays size={20} aria-hidden="true" />
              </span>
              <div>
                <label className="dlmsf-form-label mb-0 text-sm text-slate-800" htmlFor="collection-week">
                  Collection week
                </label>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Choose the Sunday that starts the contribution week.
                </p>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-80">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Week start</span>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                Sundays only
              </span>
            </div>
            <div className="dlmsf-datepicker-wrap mt-2">
              <DatePicker
                id="collection-week"
                selected={new Date(weekStart + "T00:00:00")}
                onChange={(date: Date | null) => { if (date && date.getDay() === 0) setWeekStart(localDate(date)); }}
                filterDate={(date: Date) => date.getDay() === 0}
                dateFormat="MMMM d, yyyy"
                popperClassName="!z-[9999]"
                className="dlmsf-datepicker-input"
                wrapperClassName="w-full"
                placeholderText="Select a Sunday"
                aria-label="Collection week, Sundays only"
              />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Monday–Saturday are unavailable because weekly contributions are anchored to Sunday.
            </p>
          </div>
        </div>
      </div>
    </section>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Weekly contribution summary">
      <article className="dlmsf-card dlmsf-stat p-4"><p className="text-sm text-slate-500">Expected this week</p><p className="mt-2 text-xl font-bold text-slate-900">{formatCurrency(summary.due)}</p></article>
      <article className="dlmsf-card dlmsf-stat dlmsf-stat-success p-4"><p className="text-sm text-slate-500">Recorded so far</p><p className="mt-2 text-xl font-bold text-emerald-700">{formatCurrency(summary.paid)}</p></article>
      <article className="dlmsf-card dlmsf-stat dlmsf-stat-success p-4"><p className="text-sm text-slate-500">Fully paid</p><p className="mt-2 text-xl font-bold text-slate-900">{summary.paidCount} / {members.length}</p></article>
      <article className="dlmsf-card dlmsf-stat dlmsf-stat-warning p-4"><p className="text-sm text-slate-500">Partially paid</p><p className="mt-2 text-xl font-bold text-amber-700">{summary.partialCount}</p></article>
    </section>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h3 className="font-semibold text-slate-900">Member payment status</h3><p className="mt-1 text-sm text-slate-500">₱50 per head · Week starting {weekStart}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{members.length} members</span></div>
      <div className="overflow-x-auto"><DataTable data={members} columns={columns} getRowKey={member => member.id} tableClassName={tableClass} thClassName={thClass} tdClassName={tdClass} loading={loading} loadingRow={<TableLoading message="Loading weekly member payments..." colSpan={columns.length}/>} emptyMessage="No members found."/></div>
    </section>
    {selected && <div className="animate-modal-backdrop fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setSelected(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="weekly-record-title" className="animate-modal-panel max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5"><div className="flex items-start gap-3"><span className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><CircleDollarSign size={21}/></span><div><h3 id="weekly-record-title" className="text-lg font-bold text-slate-900">{selected.remaining > 0 ? "Record weekly payment" : "Contribution details"}</h3><p className="mt-1 text-sm text-slate-500">{selected.name} · Week of {weekStart}</p></div></div><button type="button" onClick={() => setSelected(null)} disabled={saving} aria-label="Close dialog" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={19}/></button></div>
        <form onSubmit={recordPayment} className="space-y-5 px-6 py-6">
          <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4 text-sm"><div><p className="text-xs text-slate-500">Heads</p><p className="mt-1 font-semibold text-slate-900">{selected.heads}</p></div><div><p className="text-xs text-slate-500">Weekly due</p><p className="mt-1 font-semibold text-slate-900">{formatCurrency(selected.due)}</p></div><div><p className="text-xs text-slate-500">Recorded</p><p className="mt-1 font-semibold text-emerald-700">{formatCurrency(selected.paid)}</p></div></div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Remaining balance</p><p className="mt-1 text-2xl font-bold tabular-nums text-amber-900">{formatCurrency(selected.remaining)}</p></div>
          {selected.remaining > 0 && <>
            <label className="block text-sm font-semibold text-slate-700">Amount received (₱)<input required type="number" min="0.01" max={selected.remaining} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/></label>
            <label className="block text-sm font-semibold text-slate-700">Date received<input required type="date" max={today} value={paidOn} onChange={event => setPaidOn(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/></label>
            <label className="block text-sm font-semibold text-slate-700">Reference / note (optional)<input value={reference} onChange={event => setReference(event.target.value)} maxLength={160} className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/></label>
            <p className="rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-800">You can record a partial payment. The remaining balance will stay visible until the full weekly contribution is received.</p>
          </>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setSelected(null)} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Close</button>{selected.remaining > 0 && <button type="submit" disabled={saving || !amount || Number(amount) <= 0 || Number(amount) > selected.remaining} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? "Saving..." : <><Plus size={16}/>Record payment</>}</button>}</div>
        </form>
      </section>
    </div>}
  </div>;
}
