import type { Request, Response, NextFunction } from "express";
import { createUserSupabaseClient } from "../config/supabase-user.js";
const RATE = 50;
function db(req: Request) {
  if (!req.accessToken) throw Object.assign(new Error("Authentication required"), { status: 401 });
  return createUserSupabaseClient(req.accessToken);
}
function validSunday(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.getDay() === 0 && date.toISOString().slice(0, 10) === value;
}
export async function getPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const client = db(req);
    const isMember = req.user?.role === "member";
    let memberId: number | null = null;
    if (isMember) {
      const { data: member, error: memberError } = await client.from("members").select("id,heads").eq("auth_id", req.user!.id).maybeSingle();
      if (memberError) throw memberError;
      if (!member) throw Object.assign(new Error("Member profile not found."), { status: 404 });
      memberId = Number(member.id);
    }
    const [members, payments, loanPayments, allocations] = await Promise.all([
      isMember ? client.from("members").select("id,heads").eq("id", memberId) : client.from("members").select("id,name,heads"),
      isMember ? Promise.resolve({ data: [], error: null } as any) : client.from("payments").select("*").order("week_start", { ascending: false }),
      (() => {
        let query = client.from("loan_payments").select("*, borrower:members!loan_payments_member_id_fkey(name)").order("paid_at", { ascending: false });
        if (memberId !== null) query = query.eq("member_id", memberId);
        return query;
      })(),
      isMember ? Promise.resolve({ data: [], error: null } as any) : client.from("weekly_contribution_allocations").select("member_id,amount,week_start")
    ]);
    if (members.error) throw members.error;
    if (payments.error) throw payments.error;
    if (loanPayments.error) throw loanPayments.error;
    if (allocations.error) throw allocations.error;
    const weekly = new Map<string, { id: number; group: number; member: number }>();
    for (const row of payments.data ?? []) {
      const week = String(row.week_start);
      const item = weekly.get(week) ?? { id: Number(row.id), group: 0, member: 0 };
      item.group += Number(row.amount || 0);
      item.id = Number(row.id);
      weekly.set(week, item);
    }
    for (const row of allocations.data ?? []) {
      const week = String(row.week_start);
      const item = weekly.get(week) ?? { id: -Date.parse(week), group: 0, member: 0 };
      item.member += Number(row.amount || 0);
      weekly.set(week, item);
    }
    const weeklyPayments = [...weekly.entries()]
      .map(([week_start, item]) => ({ id: item.id, week_start, amount: Math.max(item.group, item.member) }))
      .sort((a, b) => b.week_start.localeCompare(a.week_start));
    res.json({ success: true, data: {
      members: members.data ?? [], payments: weeklyPayments,
      loanPayments: (loanPayments.data ?? []).map((p: any) => ({ ...p, borrower: p.borrower?.name ?? "—" }))
    }});
  } catch (error) { next(error); }
}

export async function getWeeklyContributions(req: Request, res: Response, next: NextFunction) {
  try {
    const weekStart = req.query.weekStart;
    if (!validSunday(weekStart)) throw Object.assign(new Error("Choose a valid Sunday collection week."), { status: 400 });
    const client = db(req);
    const [membersResult, allocationsResult] = await Promise.all([
      client.from("members").select("id,name,heads").order("name", { ascending: true }),
      client.from("weekly_contribution_allocations").select("member_id,amount").eq("week_start", weekStart)
    ]);
    if (membersResult.error) throw membersResult.error;
    if (allocationsResult.error) throw allocationsResult.error;
    const paidByMember = new Map<number, number>();
    for (const row of allocationsResult.data ?? []) {
      const id = Number(row.member_id);
      paidByMember.set(id, (paidByMember.get(id) ?? 0) + Number(row.amount || 0));
    }
    const members = (membersResult.data ?? []).map((member: any) => {
      const due = Number(member.heads || 0) * RATE;
      const paid = paidByMember.get(Number(member.id)) ?? 0;
      return { id: Number(member.id), name: member.name, heads: Number(member.heads || 0), due, paid, remaining: Math.max(due - paid, 0) };
    });
    res.json({ success: true, data: { weekStart, members } });
  } catch (error) { next(error); }
}

export async function recordWeeklyContribution(req: Request, res: Response, next: NextFunction) {
  try {
    const memberId = Number(req.body?.memberId);
    const amount = Number(req.body?.amount);
    const weekStart = req.body?.weekStart;
    const paidOn = req.body?.paidOn;
    const reference = typeof req.body?.reference === "string" ? req.body.reference.trim().slice(0, 160) : null;
    if (!Number.isSafeInteger(memberId) || memberId < 1) throw Object.assign(new Error("Choose a valid member."), { status: 400 });
    if (!validSunday(weekStart)) throw Object.assign(new Error("Choose a valid Sunday collection week."), { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) throw Object.assign(new Error("Enter an amount greater than zero."), { status: 400 });
    if (typeof paidOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) throw Object.assign(new Error("Choose a valid payment date."), { status: 400 });
    const { data, error } = await db(req).rpc("admin_record_weekly_contribution", {
      p_member_id: memberId, p_week_start: weekStart, p_amount: amount, p_paid_on: paidOn, p_reference: reference
    });
    if (error) throw error;
    res.status(201).json({ success: true, data, message: "Weekly contribution recorded." });
  } catch (error) { next(error); }
}

export async function deleteWeeklyPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw Object.assign(new Error("Invalid payment ID."), { status: 400 });
    const client = db(req);
    const { data: payment, error: readError } = await client.from("payments").select("*").eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!payment) throw Object.assign(new Error("Weekly payment not found."), { status: 404 });

    const { data: deleted, error: deleteError } = await client.from("payments").delete().eq("id", id).select("id").maybeSingle();
    if (deleteError) throw deleteError;
    if (!deleted) throw Object.assign(new Error("Payment could not be deleted."), { status: 409 });

    const amount = Number(payment.amount || 0);
    const { error: auditError } = await client.from("payments_audit_log").insert({
      ref_id: payment.id, amount, week_start: payment.week_start, action: "Weekly Payment Deleted",
      remarks: `Weekly sinking fund payment deleted for Sunday, ${payment.week_start}. Deleted payment ID: ${payment.id}. Amount: ${amount}.`,
      created_date: new Date().toISOString()
    });
    res.json({
      success: true, data: deleted,
      message: auditError ? "Payment deleted, but its audit record could not be saved." : "Payment deleted and audit entry saved.",
      auditWarning: auditError?.message ?? null
    });
  } catch (error) { next(error); }
}
