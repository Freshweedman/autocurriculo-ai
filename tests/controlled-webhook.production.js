/* eslint-disable @typescript-eslint/no-require-imports */
/*
 * Controlled production integration check. It never contacts a recruitment
 * platform: a temporary Supabase user and a test-only URL are created, the
 * protected bot webhook persists a confirmation, then the temporary user is
 * removed. Run only with RUN_PRODUCTION_CONTROLLED_TEST=true.
 */
const crypto = require("crypto");
const fs = require("fs");

if (process.env.RUN_PRODUCTION_CONTROLLED_TEST !== "true") {
  throw new Error("Set RUN_PRODUCTION_CONTROLLED_TEST=true to run this controlled production check.");
}

const env = Object.fromEntries(fs.readFileSync(".env", "utf8").split(/\r?\n/)
  .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
  .map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1).replace(/^['\"]|['\"]$/g, "")]; }));
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const apiUrl = (env.API_URL || "").replace(/\/$/, "");
const botKey = env.BOT_API_KEY;
if (!supabaseUrl || !serviceKey || !apiUrl || !botKey) throw new Error("Required test environment is incomplete.");

const token = crypto.randomUUID();
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
let userId = null;

(async () => {
  try {
    const create = await fetch(`${supabaseUrl}/auth/v1/admin/users`, { method: "POST", headers, body: JSON.stringify({ email: `controlled-${token}@example.invalid`, password: crypto.randomBytes(24).toString("base64url"), email_confirm: true }) });
    if (!create.ok) throw new Error(`Could not create temporary test user (${create.status}).`);
    userId = (await create.json()).id;
    const testUrl = `https://controlled.autocurriculo.test/application/${token}`;
    const webhook = await fetch(`${apiUrl}/api/webhook/bot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: botKey, applications: [{ user_id: userId, empresa: "Ambiente controlado", vaga: "Candidatura de teste", vaga_url: testUrl, plataforma: "ControlledTest", status: "confirmed", confirmationEvidence: { type: "platform_confirmation", reference: testUrl, details: { test: true, receipt: "TEST-APP-001" } } }] }),
    });
    if (!webhook.ok) throw new Error(`Webhook rejected controlled evidence (${webhook.status}).`);
    const body = await webhook.json();
    const applicationId = body.results?.[0]?.id;
    if (!applicationId || body.results?.[0]?.status !== "confirmed") throw new Error("Webhook did not persist a confirmed controlled application.");
    const evidence = await fetch(`${supabaseUrl}/rest/v1/application_evidence?application_id=eq.${applicationId}&select=id,evidence_type,reference`, { headers });
    if (!evidence.ok || (await evidence.json()).length !== 1) throw new Error("Confirmation evidence was not persisted.");
    console.log("controlled webhook: confirmed application and exactly one persisted evidence record");
  } finally {
    if (userId) {
      const removed = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers });
      if (!removed.ok) throw new Error(`Temporary controlled test user cleanup failed (${removed.status}).`);
    }
  }
})().catch((error) => { console.error(error.message); process.exit(1); });
