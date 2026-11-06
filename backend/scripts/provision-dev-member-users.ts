import { createClient } from "@supabase/supabase-js";

const expectedProjectRef = "edbtjhifjtvmjvljculd";
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your local environment.");
if (!url.includes(expectedProjectRef)) throw new Error("Safety stop: this script only runs against the approved dlmsf-dev project.");

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const { data: members, error: membersError } = await supabase
  .from("members")
  .select("id, name, auth_id, roles")
  .gte("id", 1)
  .lte("id", 35)
  .order("id", { ascending: true });

if (membersError) throw membersError;
if (!members || members.length !== 35 || members.some((m, i) => m.id !== i + 1)) {
  throw new Error("Safety stop: expected exactly the 35 seeded member rows with IDs 1 through 35.");
}

const users = [];
for (let page = 1; ; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  users.push(...data.users);
  if (data.users.length < 1000) break;
}

let createdCount = 0;
let linkedCount = 0;
for (const member of members) {
  const email = member.id === 1 ? "admin@test.com" : `member${member.id}@test.com`;
  let authId = member.auth_id as string | null;

  if (authId) {
    const { data, error } = await supabase.auth.admin.getUserById(authId);
    if (error || !data.user || data.user.email?.toLowerCase() !== email) {
      throw new Error(`Safety stop: member ${member.id} is already linked to a different or unavailable login.`);
    }
  } else {
    const existing = users.find((user) => user.email?.toLowerCase() === email);
    if (existing) {
      const { data: otherMember, error: otherError } = await supabase
        .from("members").select("id").eq("auth_id", existing.id).maybeSingle();
      if (otherError) throw otherError;
      if (otherMember && otherMember.id !== member.id) {
        throw new Error(`Safety stop: ${email} is linked to another member.`);
      }
      authId = existing.id;
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: "Password!123",
        email_confirm: true,
        user_metadata: { name: member.name }
      });
      if (error) throw error;
      if (!data.user) throw new Error(`Supabase did not return a user for member ${member.id}.`);
      authId = data.user.id;
      createdCount++;
    }

    const { error: linkError } = await supabase
      .from("members").update({ auth_id: authId }).eq("id", member.id).is("auth_id", null);
    if (linkError) throw linkError;
    linkedCount++;
  }

  console.log(`Prepared member ${member.id}: ${email}`);
}

const { count, error: countError } = await supabase
  .from("members").select("id", { count: "exact", head: true }).not("auth_id", "is", null);
if (countError) throw countError;
if (count !== 35) throw new Error(`Verification failed: expected 35 linked accounts, found ${count}.`);

console.log(JSON.stringify({ success: true, members: 35, linkedAuthAccounts: count, createdAuthUsers: createdCount, linkedExistingUsers: linkedCount }));
