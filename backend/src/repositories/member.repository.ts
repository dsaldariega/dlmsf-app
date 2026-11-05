import { supabase } from "../config/supabase.js";

export async function getMembers() {
  const { data, error } = await supabase
    .from("members")
    .select("*");

  if (error) {
    throw error;
  }

  return data;
}