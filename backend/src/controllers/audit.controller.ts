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
    const [loans, payments] = await Promise.all([
      client.from("loans_audit_log").select("*").order("created_date", { ascending: false }),
      client.from("payments_audit_log").select("*").order("id", { ascending: false })
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
