/*
 * Integration check for Supabase RLS. It deliberately needs two pre-created,
 * disposable users and their access tokens; it never creates, edits or deletes
 * production users. See the environment names below.
 */
const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "RLS_TEST_USER_A_TOKEN", "RLS_TEST_USER_B_TOKEN", "RLS_TEST_USER_A_ID", "RLS_TEST_USER_B_ID"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`RLS test not run: configure ${missing.join(", ")}`);
  process.exitCode = 2;
  return;
}

const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;
const headers = (token) => ({ apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` });

async function readAs(token, table, filter) {
  const response = await fetch(`${base}/${table}?select=*&${filter}`, { headers: headers(token) });
  if (!response.ok) throw new Error(`${table}: HTTP ${response.status}`);
  return response.json();
}

async function expectNoCrossRead(table, ownerColumn = "user_id") {
  const rows = await readAs(process.env.RLS_TEST_USER_A_TOKEN, table, `${ownerColumn}=eq.${process.env.RLS_TEST_USER_B_ID}`);
  if (rows.length) throw new Error(`${table}: user A read user B data`);
}

(async () => {
  for (const table of ["professional_profiles", "resumes", "search_profiles", "user_opportunities", "applications", "application_events", "automation_runs", "platform_connection_status"]) {
    await expectNoCrossRead(table);
  }
  const roles = await readAs(process.env.RLS_TEST_USER_A_TOKEN, "user_roles", `user_id=eq.${process.env.RLS_TEST_USER_B_ID}`);
  if (roles.length) throw new Error("user_roles: user A read user B role");
  console.log("RLS two-user isolation passed.");
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
