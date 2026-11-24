import { supabase } from "./supabase";

export type MemberRole = "admin" | "member";

function parseRoles(value: unknown): MemberRole[] {
  let parsed: unknown = value;

  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = value.split(",");
    }
  }

  const values = Array.isArray(parsed) ? parsed : [parsed];

  return values
    .filter((role): role is string => typeof role === "string")
    .map((role) => role.trim().toLowerCase())
    .filter((role): role is MemberRole => role === "admin" || role === "member");
}

/**
 * Resolve authorization from the existing members.roles column.
 * User-editable auth metadata is intentionally not used for role checks.
 */
export async function getMemberRole(userId: string): Promise<MemberRole> {
  const { data: member, error } = await supabase
    .from("members")
    .select("roles")
    .eq("auth_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to verify your DLMSF member profile. Please try again.");
  }

  if (!member) {
    throw new Error("No DLMSF member profile is linked to this account.");
  }

  const roles = parseRoles(member.roles);
  if (roles.includes("admin")) return "admin";
  if (roles.includes("member")) return "member";

  throw new Error("This account does not have a valid DLMSF role.");
}
