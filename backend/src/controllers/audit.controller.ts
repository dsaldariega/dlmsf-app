import type { Request, Response, NextFunction } from "express";
import { createUserSupabaseClient } from "../config/supabase-user.js";
function db(req: Request) {
  if (!req.accessToken) throw Object.assign(new Error("Authentication required"), { status: 401 });
  return createUserSupabaseClient(req.accessToken);
}
function validId(value: string | string[]) {
  if (typeof value !== "string") throw Object.assign(new Error("Invalid audit record ID."), { status: 400 });
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw Object.assign(new Error("Invalid audit record ID."), { status: 400 });
  return id;
}
export async function getAuditRecords(req: Request, res: Response, next: NextFunction) {
  try {
    const client = db(req);
    let loanQuery = client.from("loans_audit_log").select("*").order("created_date", { ascending: false });
    if (req.user?.role === "member") {
      const { data: member, error } = await client.from("members").select("id").eq("auth_id", req.user.id).maybeSingle();
      if (error) throw error;
      if (!member) throw Object.assign(new Error("Member profile not found."), { status: 404 });
      loanQuery = loanQuery.eq("member_id", member.id);
    }
    const [loans, payments] = await Promise.all([
      loanQuery,
      req.user?.role === "member"
        ? (async () => {
            const { data: member } = await client.from("members").select("id").eq("auth_id", req.user!.id).maybeSingle();
            if (!member) return { data: [], error: null } as any;
            const { data, error } = await client.from("payment_submissions").select("*").eq("member_id", member.id).order("submitted_at", { ascending: false });
            return {
              data: (data ?? []).map((row: any) => ({
                id: row.id, amount: row.amount, week_start: row.week_start,
                action: (row.payment_type === "Weekly" ? "Weekly contribution " : "Loan repayment ") + String(row.status || "Pending").toLowerCase(),
                remarks: row.admin_remarks || row.reference || null,
                created_date: row.reviewed_at || row.submitted_at
              })),
              error
            };
          })()
        : client.from("payments_audit_log").select("*").order("id", { ascending: false })
    ]);
    if (loans.error) throw loans.error;
    if (payments.error) throw payments.error;
    res.json({ success: true, data: { loans: loans.data ?? [], payments: payments.data ?? [] } });
  } catch (error) { next(error); }
}
export async function deleteLoanAudit(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await db(req).from("loans_audit_log").delete().eq("id", validId(req.params.id)).select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw Object.assign(new Error("Loan audit record not found."), { status: 404 });
    res.json({ success: true, data, message: "Loan audit record deleted." });
  } catch (error) { next(error); }
}
export async function deletePaymentAudit(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await db(req).from("payments_audit_log").delete().eq("id", validId(req.params.id)).select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw Object.assign(new Error("Payment audit record not found."), { status: 404 });
    res.json({ success: true, data, message: "Payment audit record deleted." });
  } catch (error) { next(error); }
}
