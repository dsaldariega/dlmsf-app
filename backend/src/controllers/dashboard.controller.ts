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
        client.from("weekly_contribution_allocations").select("id,week_start,amount").eq("member_id", member.id).order("week_start", { ascending: false }),
        client.from("loans").select("*").eq("borrower_id", member.id),
        client.from("loan_payments").select("*").eq("member_id", member.id).order("paid_at", { ascending: false })
      ]);
      for (const result of [payments, loans, loanPayments]) if (result.error) throw result.error;
      const byWeek = new Map<string, { id: number; week_start: string; amount: number }>();
      for (const row of payments.data ?? []) {
        const week = String(row.week_start);
        const entry = byWeek.get(week) ?? { id: Number(row.id), week_start: week, amount: 0 };
        entry.amount += Number(row.amount || 0);
        byWeek.set(week, entry);
      }
      res.json({ success: true, data: {
        member,
        payments: [...byWeek.values()].sort((a, b) => b.week_start.localeCompare(a.week_start)),
        loans: loans.data ?? [],
        loanPayments: loanPayments.data ?? []
      } });
      return;
    }

    const [membersResult, groupPaymentsResult, confirmedAllocationsResult, loansResult, loanPaymentsResult] = await Promise.all([
      client.from("members").select("*"),
      client.from("payments").select("id,amount,week_start"),
      client.from("weekly_contribution_allocations").select("id,amount,week_start"),
      client.from("loans").select("*"),
      client.from("loan_payments").select("*")
    ]);
    for (const result of [membersResult, groupPaymentsResult, confirmedAllocationsResult, loansResult, loanPaymentsResult]) {
      if (result.error) throw result.error;
    }

    // Older group-level collections and newer member receipts can describe the
    // same week. Count the larger weekly total rather than double-counting it.
    const weeklyTotals = new Map<string, { group: number; member: number; id: number }>();
    for (const row of groupPaymentsResult.data ?? []) {
      const week = String(row.week_start);
      const entry = weeklyTotals.get(week) ?? { group: 0, member: 0, id: Number(row.id) };
      entry.group += Number(row.amount || 0);
      entry.id = Number(row.id);
      weeklyTotals.set(week, entry);
    }
    for (const row of confirmedAllocationsResult.data ?? []) {
      if (!row.week_start) continue;
      const week = String(row.week_start);
      const entry = weeklyTotals.get(week) ?? { group: 0, member: 0, id: -Date.parse(week) };
      entry.member += Number(row.amount || 0);
      weeklyTotals.set(week, entry);
    }
    const payments = [...weeklyTotals.entries()]
      .map(([week_start, totals]) => ({ id: totals.id, week_start, amount: Math.max(totals.group, totals.member) }))
      .sort((a, b) => b.week_start.localeCompare(a.week_start));

    res.json({ success: true, data: {
      members: membersResult.data ?? [],
      payments,
      loans: loansResult.data ?? [],
      loanPayments: loanPaymentsResult.data ?? []
    } });
  } catch (error) { next(error); }
}
