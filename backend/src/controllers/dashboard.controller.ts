import type { Request, Response, NextFunction } from "express";
import { createUserSupabaseClient } from "../config/supabase-user.js";

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.accessToken) throw Object.assign(new Error("Authentication required"), { status: 401 });
    const client = createUserSupabaseClient(req.accessToken);
    const results = await Promise.all([
      client.from("members").select("*"),
      client.from("payments").select("*"),
      client.from("loans").select("*"),
      client.from("loan_payments").select("*")
    ]);
    for (const result of results) if (result.error) throw result.error;
    const [members, payments, loans, loanPayments] = results;
    res.json({ success: true, data: {
      members: members.data ?? [], payments: payments.data ?? [],
      loans: loans.data ?? [], loanPayments: loanPayments.data ?? []
    }});
  } catch (error) { next(error); }
}
