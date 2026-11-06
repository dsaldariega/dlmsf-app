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
    const [members, payments, loanPayments] = await Promise.all([
      isMember ? client.from("members").select("id,heads").eq("id", memberId) : client.from("members").select("id, heads"),
      client.from("payments").select("*").order("week_start", { ascending: false }),
      (() => {
        let query = client.from("loan_payments").select("*, borrower:members!loan_payments_member_id_fkey(name)").order("paid_at", { ascending: false });
        if (memberId !== null) query = query.eq("member_id", memberId);
        return query;
      })()
    ]);
    if (members.error) throw members.error;
    if (payments.error) throw payments.error;
    if (loanPayments.error) throw loanPayments.error;
    res.json({ success: true, data: {
      members: members.data ?? [], payments: payments.data ?? [],
      loanPayments: (loanPayments.data ?? []).map((p: any) => ({ ...p, borrower: p.borrower?.name ?? "—" }))
    }});
  } catch (error) { next(error); }
}
export async function createWeeklyPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const weekStart = req.body?.weekStart;
    if (!validSunday(weekStart)) throw Object.assign(new Error("Choose a valid Sunday collection date."), { status: 400 });
    const client = db(req);
    const { data: existing, error: existingError } = await client.from("payments").select("id").eq("week_start", weekStart).maybeSingle();
    if (existingError) throw existingError;
    if (existing) throw Object.assign(new Error(`A weekly payment for Sunday, ${weekStart}, already exists.`), { status: 409 });
    const { data: members, error: membersError } = await client.from("members").select("heads");
    if (membersError) throw membersError;
    const totalHeads = (members ?? []).reduce((sum, member) => sum + Number(member.heads || 0), 0);
    const amount = totalHeads * RATE;
    const { data: payment, error } = await client.from("payments").insert({ amount, week_start: weekStart }).select("*").single();
    if (error) throw error;
    const { error: auditError } = await client.from("payments_audit_log").insert({
      ref_id: payment.id, amount, week_start: weekStart, action: "Weekly Payment Created",
      remarks: `Weekly sinking fund collection generated for Sunday, ${weekStart}. Total member heads: ${totalHeads}. Rate per head: ${RATE}.`,
      created_date: new Date().toISOString()
    });
    res.status(201).json({ success: true, data: { ...payment, auditWarning: auditError?.message ?? null }, message: auditError ? "Payment created, but its audit record could not be saved." : "Weekly payment generated." });
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
