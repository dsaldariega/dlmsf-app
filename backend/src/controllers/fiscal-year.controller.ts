import type { Request, Response, NextFunction } from "express";
import { createUserSupabaseClient } from "../config/supabase-user.js";
import xlsx from "node-xlsx";

function db(req: Request) {
  if (!req.accessToken) throw Object.assign(new Error("Authentication required"), { status: 401 });
  return createUserSupabaseClient(req.accessToken);
}
function idParam(value: string | string[]) {
  const id = typeof value === "string" ? Number(value) : NaN;
  if (!Number.isSafeInteger(id) || id < 1) throw Object.assign(new Error("Invalid fiscal year ID."), { status: 400 });
  return id;
}
function dateValue(value: unknown, label: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Object.assign(new Error(label + " must use YYYY-MM-DD."), { status: 400 });
  return value;
}
function integerValue(value: unknown, label: string, min = 0) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min) throw Object.assign(new Error(label + " must be a whole number of at least " + min + "."), { status: 400 });
  return n;
}
function numericValue(value: unknown, label: string, min = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min) throw Object.assign(new Error(label + " must be a valid number of at least " + min + "."), { status: 400 });
  return n;
}

export async function getActiveFiscalYear(req: Request, res: Response, next: NextFunction) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
    const today = `${part("year")}-${part("month")}-${part("day")}`;
    // This is a normal authenticated read. Use the caller's JWT and RLS;
    // the service-role client is reserved for Auth account administration.
    const { data, error } = await db(req)
      .from("fiscal_years")
      .select("id,code,start_date,end_date,status")
      .eq("status", "active")
      .lte("start_date", today)
      .gte("end_date", today)
      .maybeSingle();
    if (error) throw error;
    res.json({ success: true, data: data ?? null });
  } catch (error) { next(error); }
}

export async function listFiscalYears(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await db(req).from("fiscal_years").select("*").order("start_date", { ascending: false });
    if (error) throw error;
    res.json({ success: true, data: data ?? [] });
  } catch (error) { next(error); }
}

export async function createFiscalYear(req: Request, res: Response, next: NextFunction) {
  try {
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    const startDate = dateValue(req.body?.startDate, "Start date");
    const endDate = dateValue(req.body?.endDate, "End date");
    const maxTotalHeads = req.body?.maxTotalHeads === null || req.body?.maxTotalHeads === undefined || req.body?.maxTotalHeads === "" ? null : integerValue(req.body.maxTotalHeads, "Maximum total heads");
    const maxHeadsPerMember = req.body?.maxHeadsPerMember === null || req.body?.maxHeadsPerMember === undefined || req.body?.maxHeadsPerMember === "" ? null : integerValue(req.body.maxHeadsPerMember, "Maximum heads per member");
    const retentionMonths = req.body?.retentionMonths === undefined ? 3 : integerValue(req.body.retentionMonths, "Retention months", 3);
    if (retentionMonths > 60) throw Object.assign(new Error("Retention months cannot exceed 60."), { status: 400 });
    const tierInput = Array.isArray(req.body?.tiers) ? req.body.tiers : null;
    if (!code || code.length > 40) throw Object.assign(new Error("Fiscal year code is required and must be 40 characters or fewer."), { status: 400 });
    if (startDate > endDate) throw Object.assign(new Error("Start date must be before or equal to end date."), { status: 400 });

    const client = db(req);
    const { data: fy, error } = await client.from("fiscal_years").insert({
      code, start_date: startDate, end_date: endDate, max_total_heads: maxTotalHeads,
      max_heads_per_member: maxHeadsPerMember, head_restrictions_enabled: req.body?.headRestrictionsEnabled !== false,
      retention_months: retentionMonths
    }).select("*").single();
    if (error) throw error;

    const defaults = [
      { tierCode: "bronze", displayName: "Bronze", enabled: true, loanEligible: true, loanLimitMode: "member_contribution" },
      { tierCode: "silver", displayName: "Silver", enabled: true, loanEligible: true, loanLimitMode: "member_contribution" },
      { tierCode: "gold", displayName: "Gold", enabled: true, loanEligible: true, loanLimitMode: "total_contribution" }
    ];
    const configured = tierInput ?? defaults;
    const codes = ["bronze", "silver", "gold"];
    if (configured.length !== 3 || codes.some((code) => !configured.some((tier: any) => tier?.tierCode === code))) {
      await client.from("fiscal_years").delete().eq("id", fy.id);
      throw Object.assign(new Error("Bronze, Silver, and Gold must each be configured exactly once."), { status: 400 });
    }
    const tiers = configured.map((tier: any) => {
      if (!codes.includes(tier.tierCode) || !["member_contribution", "total_contribution"].includes(tier.loanLimitMode)) throw Object.assign(new Error("Invalid tier configuration."), { status: 400 });
      return {
        fiscal_year_id: fy.id, tier_code: tier.tierCode, display_name: tier.displayName,
        enabled: Boolean(tier.enabled),
        max_heads_per_member: tier.maxHeadsPerMember === null || tier.maxHeadsPerMember === "" || tier.maxHeadsPerMember === undefined ? maxHeadsPerMember : integerValue(tier.maxHeadsPerMember, "Tier maximum heads"),
        loan_eligible: Boolean(tier.loanEligible), loan_limit_mode: tier.loanLimitMode
      };
    });
    const { error: tierError } = await client.from("tier_settings").insert(tiers);
    if (tierError) {
      await client.from("fiscal_years").delete().eq("id", fy.id);
      throw tierError;
    }
    const { data: settings, error: settingsError } = await client.from("tier_settings").select("*").eq("fiscal_year_id", fy.id).order("tier_code");
    if (settingsError) throw settingsError;
    res.status(201).json({ success: true, data: { fiscalYear: fy, tiers: settings }, message: "Draft fiscal year created with configured Bronze, Silver, and Gold settings." });
  } catch (error) { next(error); }
}

export async function updateFiscalYear(req: Request, res: Response, next: NextFunction) {
  try {
    const id = idParam(req.params.id);
    const client = db(req);
    const { data: existing, error: existingError } = await client.from("fiscal_years").select("status").eq("id", id).maybeSingle();
    if (existingError) throw existingError;
    if (!existing) throw Object.assign(new Error("Fiscal year not found."), { status: 404 });
    if (existing.status !== "draft") throw Object.assign(new Error("Only draft fiscal years can be edited. Activated and closed fiscal years are preserved as historical snapshots."), { status: 409 });
    const updates: Record<string, unknown> = {};
    if (req.body?.code !== undefined) {
      if (typeof req.body.code !== "string" || !req.body.code.trim() || req.body.code.trim().length > 40) throw Object.assign(new Error("Enter a valid fiscal year code."), { status: 400 });
      updates.code = req.body.code.trim();
    }
    if (req.body?.startDate !== undefined) updates.start_date = dateValue(req.body.startDate, "Start date");
    if (req.body?.endDate !== undefined) updates.end_date = dateValue(req.body.endDate, "End date");
    if (req.body?.maxTotalHeads !== undefined) updates.max_total_heads = req.body.maxTotalHeads === null || req.body.maxTotalHeads === "" ? null : integerValue(req.body.maxTotalHeads, "Maximum total heads");
    if (req.body?.maxHeadsPerMember !== undefined) updates.max_heads_per_member = req.body.maxHeadsPerMember === null || req.body.maxHeadsPerMember === "" ? null : integerValue(req.body.maxHeadsPerMember, "Maximum heads per member");
    if (req.body?.headRestrictionsEnabled !== undefined) updates.head_restrictions_enabled = Boolean(req.body.headRestrictionsEnabled);
    if (req.body?.retentionMonths !== undefined) {
      const months = integerValue(req.body.retentionMonths, "Retention months", 3);
      if (months > 60) throw Object.assign(new Error("Retention months cannot exceed 60."), { status: 400 });
      updates.retention_months = months;
    }
    if (!Object.keys(updates).length) throw Object.assign(new Error("No fiscal year changes were provided."), { status: 400 });
    const { data, error } = await db(req).from("fiscal_years").update(updates).eq("id", id).select("*").maybeSingle();
    if (error) throw error;
    if (!data) throw Object.assign(new Error("Fiscal year not found."), { status: 404 });
    res.json({ success: true, data, message: "Fiscal year updated." });
  } catch (error) { next(error); }
}

export async function activateFiscalYear(req: Request, res: Response, next: NextFunction) {
  try {
    const id = idParam(req.params.id);
    const client = db(req);
    const { data: fy, error: fyError } = await client.from("fiscal_years").select("*").eq("id", id).maybeSingle();
    if (fyError) throw fyError;
    if (!fy) throw Object.assign(new Error("Fiscal year not found."), { status: 404 });
    const { data: active, error: activeError } = await client.from("fiscal_years").select("id").eq("status", "active").maybeSingle();
    if (activeError) throw activeError;
    if (active && Number(active.id) !== id) throw Object.assign(new Error("Another fiscal year is already active. Close it before activating this fiscal year."), { status: 409 });
    const { data, error } = await client.from("fiscal_years").update({ status: "active", activated_at: new Date().toISOString() }).eq("id", id).select("*").single();
    if (error) throw error;
    res.json({ success: true, data, message: "Fiscal year activated." });
  } catch (error) { next(error); }
}

export async function closeFiscalYear(req: Request, res: Response, next: NextFunction) {
  try {
    const id = idParam(req.params.id);
    const { data, error } = await db(req).from("fiscal_years").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", id).select("*").maybeSingle();
    if (error) throw error;
    if (!data) throw Object.assign(new Error("Fiscal year not found."), { status: 404 });
    res.json({ success: true, data, message: "Fiscal year closed." });
  } catch (error) { next(error); }
}

export async function listFiscalYearSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const id = idParam(req.params.id);
    const client = db(req);
    const [fyResult, tiersResult, assignmentsResult] = await Promise.all([
      client.from("fiscal_years").select("*").eq("id", id).maybeSingle(),
      client.from("tier_settings").select("*").eq("fiscal_year_id", id).order("tier_code"),
      client.from("member_fiscal_years").select("*, member:members!member_fiscal_years_member_id_fkey(id,name,heads)").eq("fiscal_year_id", id).order("member_id")
    ]);
    for (const result of [fyResult, tiersResult, assignmentsResult]) if (result.error) throw result.error;
    if (!fyResult.data) throw Object.assign(new Error("Fiscal year not found."), { status: 404 });
    res.json({ success: true, data: { fiscalYear: fyResult.data, tiers: tiersResult.data ?? [], assignments: assignmentsResult.data ?? [] } });
  } catch (error) { next(error); }
}

export async function updateTierSetting(req: Request, res: Response, next: NextFunction) {
  try {
    const fiscalYearId = idParam(req.params.id);
    const tierCode = typeof req.params.tierCode === "string" ? req.params.tierCode.trim().toLowerCase() : "";
    const updates: Record<string, unknown> = {};
    if (req.body?.enabled !== undefined) updates.enabled = Boolean(req.body.enabled);
    if (req.body?.maxHeadsPerMember !== undefined) updates.max_heads_per_member = req.body.maxHeadsPerMember === null || req.body.maxHeadsPerMember === "" ? null : integerValue(req.body.maxHeadsPerMember, "Tier maximum heads");
    if (req.body?.loanEligible !== undefined) updates.loan_eligible = Boolean(req.body.loanEligible);
    if (req.body?.loanLimitMode !== undefined) {
      if (!["member_contribution", "total_contribution"].includes(req.body.loanLimitMode)) throw Object.assign(new Error("Invalid loan limit mode."), { status: 400 });
      updates.loan_limit_mode = req.body.loanLimitMode;
    }
    if (!Object.keys(updates).length) throw Object.assign(new Error("No tier changes were provided."), { status: 400 });
    const client = db(req);
    const { data: fy, error: fyError } = await client.from("fiscal_years").select("status").eq("id", fiscalYearId).maybeSingle();
    if (fyError) throw fyError;
    if (!fy) throw Object.assign(new Error("Fiscal year not found."), { status: 404 });
    if (fy.status !== "draft") throw Object.assign(new Error("Tier settings are locked after the fiscal year is activated."), { status: 409 });
    const { data, error } = await client.from("tier_settings").update(updates).eq("fiscal_year_id", fiscalYearId).eq("tier_code", tierCode).select("*").maybeSingle();
    if (error) throw error;
    if (!data) throw Object.assign(new Error("Tier setting not found."), { status: 404 });
    res.json({ success: true, data, message: data.display_name + " tier settings updated." });
  } catch (error) { next(error); }
}

export async function assignMemberToFiscalYear(req: Request, res: Response, next: NextFunction) {
  try {
    const fiscalYearId = idParam(req.params.id);
    const memberId = Number(req.params.memberId);
    if (!Number.isSafeInteger(memberId) || memberId < 1) throw Object.assign(new Error("Invalid member ID."), { status: 400 });
    const tierCode = typeof req.body?.tierCode === "string" ? req.body.tierCode.trim().toLowerCase() : "";
    if (!tierCode) throw Object.assign(new Error("Choose a membership tier."), { status: 400 });
    const assignedHeads = integerValue(req.body?.assignedHeads, "Assigned heads", 0);
    const client = db(req);
    const { data: member, error: memberError } = await client.from("members").select("id").eq("id", memberId).maybeSingle();
    if (memberError) throw memberError;
    if (!member) throw Object.assign(new Error("Member not found."), { status: 404 });
    const { data, error } = await client.from("member_fiscal_years").upsert({
      fiscal_year_id: fiscalYearId, member_id: memberId, tier_code: tierCode, assigned_heads: assignedHeads
    }, { onConflict: "fiscal_year_id,member_id" }).select("*, member:members!member_fiscal_years_member_id_fkey(id,name,heads)").single();
    if (error) throw error;
    res.json({ success: true, data, message: "Member tier and head allocation updated." });
  } catch (error) { next(error); }
}

export async function exportFiscalYear(req: Request, res: Response, next: NextFunction) {
  try {
    const fiscalYearId = idParam(req.params.id);
    const client = db(req);
    const { data: fy, error: fyError } = await client.from("fiscal_years").select("*").eq("id", fiscalYearId).maybeSingle();
    if (fyError) throw fyError;
    if (!fy) throw Object.assign(new Error("Fiscal year not found."), { status: 404 });

    const start = String(fy.start_date);
    const end = String(fy.end_date);
    const [members, assignments, tiers, payments, allocations, loans, loanPayments, loanRequests, paymentSubmissions, loanAudit, paymentAudit, requestAudit] = await Promise.all([
      client.from("members").select("id,name,heads").order("id"),
      client.from("member_fiscal_years").select("member_id,tier_code,assigned_heads,assigned_at").eq("fiscal_year_id", fiscalYearId),
      client.from("tier_settings").select("tier_code,display_name,enabled,max_heads_per_member,loan_eligible,loan_limit_mode").eq("fiscal_year_id", fiscalYearId).order("tier_code"),
      client.from("payments").select("id,fiscal_year_id,member_id,amount,week_start,created_at").eq("fiscal_year_id", fiscalYearId).order("week_start"),
      client.from("weekly_contribution_allocations").select("id,fiscal_year_id,payment_submission_id,member_id,week_start,amount,created_at").eq("fiscal_year_id", fiscalYearId).order("week_start"),
      client.from("loans").select("id,fiscal_year_id,borrower_id,amount,interest,total,monthly,status,months,created_at").eq("fiscal_year_id", fiscalYearId).order("id"),
      client.from("loan_payments").select("id,fiscal_year_id,loan_id,member_id,amount,paid_at,created_at").eq("fiscal_year_id", fiscalYearId).order("paid_at"),
      client.from("loan_requests").select("id,fiscal_year_id,member_id,amount,months,status,requested_at,reviewed_at,admin_remarks,loan_id").eq("fiscal_year_id", fiscalYearId).order("requested_at"),
      client.from("payment_submissions").select("id,fiscal_year_id,member_id,payment_type,amount,paid_on,week_start,loan_id,reference,status,submitted_at,reviewed_at,admin_remarks").eq("fiscal_year_id", fiscalYearId).order("submitted_at"),
      client.from("loans_audit_log").select("*").eq("fiscal_year_id", fiscalYearId).order("created_date"),
      client.from("payments_audit_log").select("*").eq("fiscal_year_id", fiscalYearId).order("created_date"),
      client.from("loan_request_audit_events").select("*").eq("fiscal_year_id", fiscalYearId).order("created_at")
    ]);
    for (const result of [members, assignments, tiers, payments, allocations, loans, loanPayments, loanRequests, paymentSubmissions, loanAudit, paymentAudit, requestAudit]) if (result.error) throw result.error;

    const memberMap = new Map<number, string>((members.data ?? []).map((m: any) => [Number(m.id), String(m.name ?? "Member")]));
    const assignmentMap = new Map<number, any>((assignments.data ?? []).map((a: any) => [Number(a.member_id), a]));

    const sheets: Array<{ name: string; data: unknown[][] }> = [
      { name: "Summary", data: [
        ["Fiscal Year", fy.code], ["Period", start + " to " + end], ["Status", fy.status],
        ["Members", members.data?.length ?? 0],
        ["Assigned Heads", (assignments.data ?? []).reduce((s: number, a: any) => s + Number(a.assigned_heads || 0), 0)],
        ["Weekly Contributions", (allocations.data ?? []).reduce((s: number, a: any) => s + Number(a.amount || 0), 0)],
        ["Loan Payments", (loanPayments.data ?? []).reduce((s: number, a: any) => s + Number(a.amount || 0), 0)],
        ["Loan Requests", loanRequests.data?.length ?? 0],
        ["Loan Request Events", requestAudit.data?.length ?? 0]
      ]},
      { name: "Members", data: [
        ["Member ID","Name","Current Heads","FY Tier","FY Heads","Assigned At"],
        ...(members.data ?? []).map((m: any) => [m.id,m.name,m.heads,assignmentMap.get(Number(m.id))?.tier_code ?? "",assignmentMap.get(Number(m.id))?.assigned_heads ?? "",assignmentMap.get(Number(m.id))?.assigned_at ?? ""])
      ]},
      { name: "Tier Settings", data: [
        ["Tier","Display Name","Enabled","Max Heads","Loan Eligible","Loan Limit Basis"],
        ...(tiers.data ?? []).map((t: any) => [t.tier_code,t.display_name,t.enabled,t.max_heads_per_member,t.loan_eligible,t.loan_limit_mode])
      ]},
      { name: "Contributions", data: [
        ["ID","Submission ID","Member","Member ID","Week Start","Amount","Created At"],
        ...(allocations.data ?? []).map((r: any) => [r.id,r.payment_submission_id,memberMap.get(Number(r.member_id)),r.member_id,r.week_start,r.amount,r.created_at])
      ]},
      { name: "Payments", data: [
        ["ID","Member","Member ID","Amount","Week Start","Created At"],
        ...(payments.data ?? []).map((r: any) => [r.id,memberMap.get(Number(r.member_id)),r.member_id,r.amount,r.week_start,r.created_at])
      ]},
      { name: "Loans", data: [
        ["ID","Borrower","Member ID","Principal","Interest","Total","Monthly","Status","Months"],
        ...(loans.data ?? []).map((r: any) => [r.id,memberMap.get(Number(r.borrower_id)),r.borrower_id,r.amount,r.interest,r.total,r.monthly,r.status,r.months])
      ]},
      { name: "Loan Payments", data: [
        ["ID","Loan ID","Member","Member ID","Amount","Paid At","Created At"],
        ...(loanPayments.data ?? []).map((r: any) => [r.id,r.loan_id,memberMap.get(Number(r.member_id)),r.member_id,r.amount,r.paid_at,r.created_at])
      ]},
      { name: "Loan Requests", data: [
        ["ID","Member","Member ID","Amount","Months","Status","Requested At","Reviewed At","Remarks","Loan ID"],
        ...(loanRequests.data ?? []).map((r: any) => [r.id,memberMap.get(Number(r.member_id)),r.member_id,r.amount,r.months,r.status,r.requested_at,r.reviewed_at,r.admin_remarks,r.loan_id])
      ]},
      { name: "Payment Submissions", data: [
        ["ID","Member","Member ID","Type","Amount","Paid On","Week Start","Loan ID","Reference","Status","Submitted At","Reviewed At","Remarks"],
        ...(paymentSubmissions.data ?? []).map((r: any) => [r.id,memberMap.get(Number(r.member_id)),r.member_id,r.payment_type,r.amount,r.paid_on,r.week_start,r.loan_id,r.reference,r.status,r.submitted_at,r.reviewed_at,r.admin_remarks])
      ]},
      { name: "Loan Audit", data: [
        ["ID","Action","Member ID","Borrower","Amount","Interest","Total","Monthly","Months","Created Date","Ref ID","Remarks"],
        ...(loanAudit.data ?? []).map((r: any) => [r.id,r.action,r.member_id,r.borrower_name,r.amount,r.interest,r.total,r.monthly,r.months,r.created_date,r.ref_id,r.remarks])
      ]},
      { name: "Payment Audit", data: [
        ["ID","Action","Member ID","Amount","Week Start","Created Date","Ref ID","Remarks"],
        ...(paymentAudit.data ?? []).map((r: any) => [r.id,r.action,r.member_id,r.amount,r.week_start,r.created_date,r.ref_id,r.remarks])
      ]},
      { name: "Loan Request Audit", data: [
        ["ID","Request ID","Member ID","Amount","Months","Action","Actor Role","Remarks","Created At"],
        ...(requestAudit.data ?? []).map((r: any) => [r.id,r.loan_request_id,r.member_id,r.amount,r.months,r.action,r.actor_role,r.remarks,r.created_at])
      ]}
    ];

    const workbook = xlsx.build(sheets.map((sheet) => ({ name: sheet.name, data: sheet.data })));
    const { error: exportMarkError } = await client.from("fiscal_years").update({ exported_at: new Date().toISOString() }).eq("id", fiscalYearId);
    if (exportMarkError) throw exportMarkError;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=\"DLMSF-" + String(fy.code).replace(/[^A-Za-z0-9_-]/g, "_") + "-Activities.xlsx\"");
    res.send(workbook);
  } catch (error) { next(error); }
}


export async function purgeFiscalYear(req: Request, res: Response, next: NextFunction) {
  try {
    const fiscalYearId = idParam(req.params.id);
    const confirmation = typeof req.body?.confirmation === "string" ? req.body.confirmation.trim() : "";
    if (!confirmation) throw Object.assign(new Error("Type the required purge confirmation phrase."), { status: 400 });
    const { data, error } = await db(req).rpc("purge_fiscal_year_transactions", {
      p_fiscal_year_id: fiscalYearId,
      p_confirmation: confirmation,
    });
    if (error) throw error;
    res.json({ success: true, data, message: "Fiscal-year transaction cleanup completed." });
  } catch (error) { next(error); }
}
