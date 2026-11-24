import type { Request, Response, NextFunction } from "express";
import { createUserSupabaseClient } from "../config/supabase-user.js";

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.accessToken) throw Object.assign(new Error("Authentication required"), { status: 401 });
    const client = createUserSupabaseClient(req.accessToken);

    const { data: fiscalYear, error: fiscalYearError } = await client
      .from("fiscal_years").select("id,code,start_date,end_date").eq("status", "active").maybeSingle();
    if (fiscalYearError) throw fiscalYearError;
    if (!fiscalYear) throw Object.assign(new Error("No active fiscal year is available."), { status: 409 });

    if (req.user?.role === "member") {
      const { data: member, error: memberError } = await client
        .from("members").select("id,name,heads").eq("auth_id", req.user.id).maybeSingle();
      if (memberError) throw memberError;
      if (!member) throw Object.assign(new Error("Member profile not found."), { status: 404 });

      const [assignmentResult, payments, loans, loanPayments] = await Promise.all([
        client.from("member_fiscal_years").select("tier_code,assigned_heads")
          .eq("fiscal_year_id", fiscalYear.id).eq("member_id", member.id).maybeSingle(),
        client.from("weekly_contribution_allocations").select("id,week_start,amount")
          .eq("member_id", member.id).eq("fiscal_year_id", fiscalYear.id).order("week_start", { ascending: false }),
        client.from("loans").select("*").eq("borrower_id", member.id),
        client.from("loan_payments").select("*").eq("member_id", member.id).order("paid_at", { ascending: false })
      ]);
      for (const result of [assignmentResult, payments, loans, loanPayments]) if (result.error) throw result.error;
      if (!assignmentResult.data) {
        throw Object.assign(new Error("Your membership tier and head allocation have not been assigned for the active fiscal year. Contact the administrator."), { status: 409 });
      }

      const byWeek = new Map<string, { id: number; week_start: string; amount: number }>();
      for (const row of payments.data ?? []) {
        const week = String(row.week_start);
        const entry = byWeek.get(week) ?? { id: Number(row.id), week_start: week, amount: 0 };
        entry.amount += Number(row.amount || 0);
        byWeek.set(week, entry);
      }
      res.json({ success: true, data: {
        member: { ...member, heads: Number(assignmentResult.data.assigned_heads || 0), tier_code: assignmentResult.data.tier_code },
        fiscalYear,
        payments: [...byWeek.values()].sort((a, b) => b.week_start.localeCompare(a.week_start)),
        loans: loans.data ?? [],
        loanPayments: loanPayments.data ?? []
      } });
      return;
    }

    const [membersResult, assignmentsResult, groupPaymentsResult, confirmedAllocationsResult, loansResult, loanPaymentsResult] = await Promise.all([
      client.from("members").select("id,name").order("id"),
      client.from("member_fiscal_years").select("member_id,tier_code,assigned_heads").eq("fiscal_year_id", fiscalYear.id),
      client.from("payments").select("id,amount,week_start").eq("fiscal_year_id", fiscalYear.id),
      client.from("weekly_contribution_allocations").select("id,amount,week_start").eq("fiscal_year_id", fiscalYear.id),
      // Outstanding contracts may originate in an earlier FY and remain payable.
      client.from("loans").select("*"),
      // Repayments from earlier FYs still contribute to the overall fund position.
      client.from("loan_payments").select("*")
    ]);
    for (const result of [membersResult, assignmentsResult, groupPaymentsResult, confirmedAllocationsResult, loansResult, loanPaymentsResult]) {
      if (result.error) throw result.error;
    }

    const assignmentByMember = new Map<number, { tier_code: string; assigned_heads: number }>();
    for (const assignment of assignmentsResult.data ?? []) {
      assignmentByMember.set(Number(assignment.member_id), {
        tier_code: assignment.tier_code,
        assigned_heads: Number(assignment.assigned_heads || 0)
      });
    }
    const members = (membersResult.data ?? []).map((member: any) => {
      const assignment = assignmentByMember.get(Number(member.id));
      return { ...member, heads: assignment?.assigned_heads ?? 0, tier_code: assignment?.tier_code ?? null, assigned: Boolean(assignment) };
    });

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

    res.json({ success: true, data: { members, fiscalYear, payments, loans: loansResult.data ?? [], loanPayments: loanPaymentsResult.data ?? [] } });
  } catch (error) { next(error); }
}
