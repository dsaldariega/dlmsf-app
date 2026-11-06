import type { Request, Response, NextFunction } from "express";
import { createUserSupabaseClient } from "../config/supabase-user.js";
const LOAN_DURATIONS = Array.from({ length: 12 }, (_, index) => index + 1);

function db(req: Request) {
  if (!req.accessToken) throw Object.assign(new Error("Authentication required"), { status: 401 });
  return createUserSupabaseClient(req.accessToken);
}
function idParam(value: string) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw Object.assign(new Error("Invalid loan ID."), { status: 400 });
  return id;
}

export async function getLoans(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await db(req).from("loans").select("*, borrower:borrower_id(name)").order("id", { ascending: false });
    if (error) throw error;
    res.json({ success: true, data: data ?? [] });
  } catch (error) { next(error); }
}

export async function createLoan(req: Request, res: Response, next: NextFunction) {
  try {
    const borrowerId = Number(req.body?.borrowerId);
    const amount = Number(req.body?.amount);
    const months = Number(req.body?.months);
    if (!Number.isSafeInteger(borrowerId) || borrowerId < 1) throw Object.assign(new Error("Choose a valid registered borrower."), { status: 400 });
    if (!Number.isFinite(amount) || amount < 500 || amount % 500 !== 0) throw Object.assign(new Error("Loan amount must be at least ₱500 and in increments of ₱500."), { status: 400 });
    if (!Number.isInteger(months) || !LOAN_DURATIONS.includes(months)) throw Object.assign(new Error("Choose a valid repayment duration (1–12 months)."), { status: 400 });

    const client = db(req);
    const { data: created, error: createError } = await client.rpc("create_loan", {
      p_borrower_id: borrowerId, p_amount: amount, p_months: months
    });
    if (createError) throw createError;
    const loanId = (created as { id?: number } | null)?.id;
    if (!loanId) throw new Error("Loan creation did not return a loan ID.");
    const { data, error } = await client.from("loans").select("*, borrower:borrower_id(name)").eq("id", loanId).single();
    if (error) throw error;
    res.status(201).json({ success: true, data, message: "Loan created." });
  } catch (error) { next(error); }
}

export async function updateLoan(req: Request, res: Response, next: NextFunction) {
  try {
    const id = idParam(req.params.id);
    if (req.body?.status !== "Paid") throw Object.assign(new Error("Only the Paid status can be set through this action."), { status: 400 });
    const { data, error } = await db(req).from("loans").update({ status: "Paid" }).eq("id", id).select("*, borrower:borrower_id(name)").maybeSingle();
    if (error) throw error;
    if (!data) throw Object.assign(new Error("Loan not found."), { status: 404 });
    res.json({ success: true, data, message: "Loan marked as paid." });
  } catch (error) { next(error); }
}

export async function deleteLoan(req: Request, res: Response, next: NextFunction) {
  try {
    const id = idParam(req.params.id);
    const client = db(req);
    const { data: loan, error: readError } = await client.from("loans").select("*, borrower:borrower_id(name)").eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!loan) throw Object.assign(new Error("Loan not found."), { status: 404 });

    const { error: auditError } = await client.from("loans_audit_log").insert({
      borrower_name: loan.borrower?.name ?? "Unknown borrower",
      amount: loan.amount, interest: loan.interest, total: loan.total, monthly: loan.monthly,
      action: "Loan Deleted", remarks: "Loan deleted from loan records", created_date: new Date().toISOString()
    });
    if (auditError) throw auditError;

    const { data, error } = await client.from("loans").delete().eq("id", id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw Object.assign(new Error("Loan could not be deleted."), { status: 409 });
    res.json({ success: true, data, message: "Loan deleted and audit record saved." });
  } catch (error) { next(error); }
}
