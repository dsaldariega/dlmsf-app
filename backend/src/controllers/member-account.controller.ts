import type { Request, Response, NextFunction } from "express";
import { createSupabaseAdminClient } from "../config/supabase-admin.js";

const DEFAULT_MEMBER_PASSWORD = "Password!123";

function memberEmail(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
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
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const heads = Number(req.body?.heads);
    if (!name) throw Object.assign(new Error("Member name is required."), { status: 400 });
    if (name.length > 120) throw Object.assign(new Error("Member name must be 120 characters or fewer."), { status: 400 });
    if (!Number.isSafeInteger(heads) || heads < 1) throw Object.assign(new Error("Heads must be a whole number of at least 1."), { status: 400 });

    const admin = createSupabaseAdminClient();
    const email = memberEmail(name);
    const { data: usersPage, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;
    const existingUser = usersPage.users.find((user) => user.email?.toLowerCase() === email);
    let authId = existingUser?.id ?? null;

    if (authId) {
      const { data: linkedMember, error: linkedError } = await admin
        .from("members").select("id").eq("auth_id", authId).maybeSingle();
      if (linkedError) throw linkedError;
      if (linkedMember) throw Object.assign(new Error("That login email is already linked to another member."), { status: 409 });
    } else {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password: DEFAULT_MEMBER_PASSWORD,
        email_confirm: true,
        user_metadata: { name }
      });
      if (createError) throw createError;
      if (!created.user) throw new Error("Supabase did not return the created login.");
      authId = created.user.id;
      newlyCreatedAuthId = authId;
    }

    const { data, error } = await admin
      .from("members")
      .insert({ name, heads, roles: ["member"], auth_id: authId })
      .select("*").single();
    if (error) throw error;
    res.status(201).json({ success: true, data, message: "Member and login created.", loginEmail: email });
  } catch (error) {
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
