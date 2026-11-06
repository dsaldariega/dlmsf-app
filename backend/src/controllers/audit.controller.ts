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
    const isMember = req.user?.role === "member";
    let memberId: number | null = null;
    if (isMember) {
      const { data: member, error } = await client.from("members").select("id").eq("auth_id", req.user!.id).maybeSingle();
      if (error) throw error;
      if (!member) throw Object.assign(new Error("Member profile not found."), { status: 404 });
      memberId = Number(member.id);
    }

    let loanAuditQuery = client.from("loans_audit_log").select("*").order("created_date", { ascending: false });
    let loanRequestQuery = client.from("loan_requests").select("id,member_id,amount,status,requested_at,reviewed_at,admin_remarks,member:members!loan_requests_member_id_fkey(name)").order("requested_at", { ascending: false });
    let paymentSubmissionQuery = client.from("payment_submissions").select("id,member_id,payment_type,amount,paid_on,week_start,status,submitted_at,reviewed_at,admin_remarks,reference").order("submitted_at", { ascending: false });
    if (memberId !== null) {
      loanAuditQuery = loanAuditQuery.eq("member_id", memberId);
      loanRequestQuery = loanRequestQuery.eq("member_id", memberId);
      paymentSubmissionQuery = paymentSubmissionQuery.eq("member_id", memberId);
    }

    const [loanAudit, loanRequests, paymentSubmissions, paymentAudit] = await Promise.all([
      loanAuditQuery,
      loanRequestQuery,
      paymentSubmissionQuery,
      isMember ? Promise.resolve({ data: [], error: null } as any)
        : client.from("payments_audit_log").select("*").order("id", { ascending: false })
    ]);
    for (const result of [loanAudit, loanRequests, paymentSubmissions, paymentAudit]) if (result.error) throw result.error;

    const loanRequestRows = (loanRequests.data ?? []).map((row: any) => ({
      id: -Number(row.id),
      member_id: row.member_id,
      borrower_name: row.member?.name ?? "Member",
      amount: row.amount,
      total: row.amount,
      action: "Loan request " + String(row.status || "Pending").toLowerCase(),
      remarks: row.admin_remarks || null,
      created_date: row.reviewed_at || row.requested_at
    }));
    const paymentSubmissionRows = (paymentSubmissions.data ?? []).map((row: any) => ({
      id: -Number(row.id),
      member_id: row.member_id,
      amount: row.amount,
      week_start: row.week_start,
      action: (row.payment_type === "Weekly" ? "Weekly contribution " : "Loan repayment ") + String(row.status || "Pending").toLowerCase(),
      remarks: row.admin_remarks || row.reference || null,
      created_date: row.reviewed_at || row.submitted_at
    }));

    res.json({ success: true, data: {
      loans: [...(loanAudit.data ?? []), ...loanRequestRows],
      payments: [...(paymentAudit.data ?? []), ...paymentSubmissionRows]
    } });
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
