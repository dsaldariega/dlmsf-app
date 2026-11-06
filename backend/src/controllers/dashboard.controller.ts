import type { Request, Response, NextFunction } from "express";
import { createUserSupabaseClient } from "../config/supabase-user.js";

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.accessToken) throw Object.assign(new Error("Authentication required"), { status: 401 });
    const client = createUserSupabaseClient(req.accessToken);

    if (req.user?.role === "member") {
      const { data: member, error: memberError } = await client.from("members").select("id,name,heads").eq("auth_id", req.user.id).maybeSingle();
      if (memberError) throw memberError;
      if (!member) throw Object.assign(new Error("Member profile not found."), { status: 404 });
      const [payments, loans, loanPayments] = await Promise.all([
        client.from("payment_submissions").select("id,week_start,amount").eq("member_id", member.id).eq("payment_type", "Weekly").eq("status", "Confirmed"),
        client.from("loans").select("*").eq("borrower_id", member.id),
        client.from("loan_payments").select("*").eq("member_id", member.id)
      ]);
      for (const result of [payments, loans, loanPayments]) if (result.error) throw result.error;
      res.json({ success: true, data: { member, payments: payments.data ?? [], loans: loans.data ?? [], loanPayments: loanPayments.data ?? [] } });
      return;
    }

    const results = await Promise.all([
      client.from("members").select("*"),
      client.from("payments").select("*"),
      client.from("loans").select("*"),
      client.from("loan_payments").select("*")
    ]);
    for (const result of results) if (result.error) throw result.error;
    const [members, payments, loans, loanPayments] = results;
    res.json({ success: true, data: { members: members.data ?? [], payments: payments.data ?? [], loans: loans.data ?? [], loanPayments: loanPayments.data ?? [] } });
  } catch (error) { next(error); }
}
