import type { Request, Response, NextFunction } from "express";
import { createUserSupabaseClient } from "../config/supabase-user.js";

function client(req: Request) {
  if (!req.accessToken) throw Object.assign(new Error("Authentication required"), { status: 401 });
  return createUserSupabaseClient(req.accessToken);
}
function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw Object.assign(new Error("Invalid member ID"), { status: 400 });
  return id;
}

export async function getMembers(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await client(req).from("members").select("*").order("id", { ascending: false });
    if (error) throw error;
    res.json({ success: true, data: data ?? [] });
  } catch (error) { next(error); }
}

export async function createMember(req: Request, res: Response, next: NextFunction) {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const heads = Number(req.body?.heads);
    if (!name) throw Object.assign(new Error("Member name is required."), { status: 400 });
    if (name.length > 120) throw Object.assign(new Error("Member name must be 120 characters or fewer."), { status: 400 });
    if (!Number.isSafeInteger(heads) || heads < 1) throw Object.assign(new Error("Heads must be a whole number of at least 1."), { status: 400 });
    const { data, error } = await client(req).from("members").insert({ name, heads }).select("*").single();
    if (error) throw error;
    res.status(201).json({ success: true, data, message: "Member created." });
  } catch (error) { next(error); }
}

export async function updateMember(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    const updates: { name?: string; heads?: number } = {};
    if (req.body?.name !== undefined) {
      if (typeof req.body.name !== "string" || !req.body.name.trim() || req.body.name.trim().length > 120)
        throw Object.assign(new Error("Enter a valid member name (1–120 characters)."), { status: 400 });
      updates.name = req.body.name.trim();
    }
    if (req.body?.heads !== undefined) {
      const heads = Number(req.body.heads);
      if (!Number.isSafeInteger(heads) || heads < 1) throw Object.assign(new Error("Heads must be a whole number of at least 1."), { status: 400 });
      updates.heads = heads;
    }
    if (!Object.keys(updates).length) throw Object.assign(new Error("No valid member changes were provided."), { status: 400 });
    const { data, error } = await client(req).from("members").update(updates).eq("id", id).select("*").maybeSingle();
    if (error) throw error;
    if (!data) throw Object.assign(new Error("Member not found."), { status: 404 });
    res.json({ success: true, data, message: "Member updated." });
  } catch (error) { next(error); }
}

export async function deleteMember(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    const { data, error } = await client(req).from("members").delete().eq("id", id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw Object.assign(new Error("Member not found or could not be deleted."), { status: 404 });
    res.json({ success: true, data, message: "Member deleted." });
  } catch (error) { next(error); }
}
