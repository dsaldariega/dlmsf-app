import { randomBytes } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { createSupabaseAdminClient } from "../config/supabase-admin.js";


function memberEmail(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/^\.+|\.+$/g, "");
  if (!slug) throw Object.assign(new Error("Member name cannot be converted into a login email."), { status: 400 });
  return `${slug}@test.com`;
}

function parseId(value: string | string[]): number {
  if (typeof value !== "string") throw Object.assign(new Error("Invalid member ID"), { status: 400 });
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw Object.assign(new Error("Invalid member ID"), { status: 400 });
  return id;
}

export async function createMemberWithLogin(req: Request, res: Response, next: NextFunction) {
  let newlyCreatedAuthId: string | null = null;
  let newlyCreatedMemberId: number | null = null;
  let temporaryPassword: string | null = null;
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const heads = Number(req.body?.heads);
    const requestedTierCode = typeof req.body?.tierCode === "string" ? req.body.tierCode.trim().toLowerCase() : "";
    if (!name) throw Object.assign(new Error("Member name is required."), { status: 400 });
    if (name.length > 120) throw Object.assign(new Error("Member name must be 120 characters or fewer."), { status: 400 });
    if (!Number.isSafeInteger(heads) || heads < 1) throw Object.assign(new Error("Heads must be a whole number of at least 1."), { status: 400 });

    const admin = createSupabaseAdminClient();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
    const today = `${part("year")}-${part("month")}-${part("day")}`;
    const { data: activeFiscalYear, error: fiscalYearError } = await admin
      .from("fiscal_years")
      .select("id,code,max_total_heads")
      .eq("status", "active")
      .maybeSingle();
    if (fiscalYearError) throw fiscalYearError;
    if (!activeFiscalYear) {
      throw Object.assign(new Error("Create and activate a fiscal year before adding members."), { status: 409 });
    }
    const { data: tierRows, error: tierError } = await admin
      .from("tier_settings")
      .select("tier_code,display_name,enabled,max_heads_per_member")
      .eq("fiscal_year_id", activeFiscalYear.id)
      .eq("enabled", true);
    if (tierError) throw tierError;
    if (!tierRows?.length) {
      throw Object.assign(new Error("Enable at least one membership tier in the active fiscal year before adding members."), { status: 409 });
    }
    const tier = tierRows.find((item) => item.tier_code.toLowerCase() === requestedTierCode) ?? (requestedTierCode ? null : tierRows[0]);
    if (!tier) {
      throw Object.assign(new Error("The selected membership tier is not enabled for the active fiscal year."), { status: 409 });
    }
    if (tier.max_heads_per_member != null && heads > Number(tier.max_heads_per_member)) {
      const limitLabel = `${tier.max_heads_per_member} ${Number(tier.max_heads_per_member) === 1 ? "head" : "heads"}`;
      throw Object.assign(new Error(`${tier.display_name} allows a maximum of ${limitLabel} per member in FY ${activeFiscalYear.code}.`), { status: 409 });
    }
    if (activeFiscalYear.max_total_heads != null) {
      const { data: assignedRows, error: assignedError } = await admin
        .from("member_fiscal_years")
        .select("assigned_heads")
        .eq("fiscal_year_id", activeFiscalYear.id);
      if (assignedError) throw assignedError;
      const assignedTotal = (assignedRows ?? []).reduce((sum, row) => sum + Number(row.assigned_heads || 0), 0);
      if (assignedTotal + heads > Number(activeFiscalYear.max_total_heads)) {
        throw Object.assign(new Error(`Adding this member would exceed the FY ${activeFiscalYear.code} total head limit of ${activeFiscalYear.max_total_heads}.`), { status: 409 });
      }
    }
    const email = memberEmail(name);
    const generatedPassword = randomBytes(24).toString("base64url");
    temporaryPassword = generatedPassword;
    const { data: authUsers, error: authUsersError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authUsersError) throw authUsersError;
    const existingAuth = authUsers.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (existingAuth) {
      const { data: linkedMember, error: linkedMemberError } = await admin
        .from("members")
        .select("id")
        .eq("auth_id", existingAuth.id)
        .maybeSingle();
      if (linkedMemberError) throw linkedMemberError;
      if (linkedMember) {
        throw Object.assign(new Error("A member with this generated login email already exists."), { status: 409 });
      }
      const { error: orphanDeleteError } = await admin.auth.admin.deleteUser(existingAuth.id);
      if (orphanDeleteError) throw orphanDeleteError;
    }
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: { name }
    });
    if (createError) throw createError;
    if (!created.user) throw new Error("Supabase did not return the created login.");
    newlyCreatedAuthId = created.user.id;

    const { data, error } = await admin
      .from("members")
      .insert({ name, heads, roles: ["member"], auth_id: newlyCreatedAuthId })
      .select("*").single();
    if (error) throw error;
    newlyCreatedMemberId = Number(data.id);

    const { error: assignmentError } = await admin
      .from("member_fiscal_years")
      .insert({
        fiscal_year_id: activeFiscalYear.id,
        member_id: newlyCreatedMemberId,
        tier_code: tier.tier_code,
        assigned_heads: heads,
      });
    if (assignmentError) throw assignmentError;

    res.status(201).json({ success: true, data: { member: data, loginEmail: email, temporaryPassword }, message: "Member created. Share the one-time temporary password securely." });
  } catch (error) {
    if (newlyCreatedMemberId) {
      try {
        const admin = createSupabaseAdminClient();
        const { error: rollbackMemberError } = await admin.from("members").delete().eq("id", newlyCreatedMemberId);
        if (rollbackMemberError) console.error("Failed to roll back newly created member:", rollbackMemberError);
      } catch (rollbackMemberError) {
        console.error("Failed to roll back newly created member:", rollbackMemberError);
      }
    }
    if (newlyCreatedAuthId) {
      try {
        const admin = createSupabaseAdminClient();
        const { error: rollbackError } = await admin.auth.admin.deleteUser(newlyCreatedAuthId);
        if (rollbackError) console.error("Failed to roll back newly created Auth user:", rollbackError);
      } catch (rollbackError) {
        console.error("Failed to roll back newly created Auth user:", rollbackError);
      }
    }
    next(error);
  }
}

export async function deleteMemberWithLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    const admin = createSupabaseAdminClient();
    const { data: member, error: lookupError } = await admin
      .from("members").select("id, auth_id, roles").eq("id", id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!member) throw Object.assign(new Error("Member not found."), { status: 404 });

    const roles = Array.isArray(member.roles) ? member.roles : [];
    if (roles.some((role: unknown) => typeof role === "string" && role.trim().toLowerCase() === "admin")) {
      throw Object.assign(new Error("The admin member account cannot be deleted."), { status: 403 });
    }
    if (member.auth_id && member.auth_id === req.user?.id) {
      throw Object.assign(new Error("You cannot delete your own signed-in account."), { status: 403 });
    }

    if (member.auth_id) {
      const { error: authDeleteError } = await admin.auth.admin.deleteUser(member.auth_id);
      if (authDeleteError) throw Object.assign(new Error("The linked login could not be deleted; the member record was left unchanged."), { status: 502, cause: authDeleteError });
    }

    const { data: deleted, error: deleteError } = await admin
      .from("members").delete().eq("id", id).select("id").maybeSingle();
    if (deleteError || !deleted) {
      console.error("Member row deletion failed after linked Auth deletion:", deleteError);
      throw Object.assign(new Error("The login was deleted, but the member record could not be deleted. Contact support to reconcile this member."), { status: 500 });
    }
    res.json({ success: true, data: deleted, message: "Member and linked login deleted." });
  } catch (error) { next(error); }
}
