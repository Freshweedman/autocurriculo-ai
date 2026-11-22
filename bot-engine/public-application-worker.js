/* Public-form worker. Keep console output aggregate only: Actions logs are public. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { chromium } = require("playwright");
const { visit } = require("./platforms/public-form");

const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const runId = process.env.PUBLIC_APPLICATION_RUN_ID;
const lane = process.env.PUBLIC_APPLICATION_LANE;
const secret = process.env.PUBLIC_APPLICATION_WORKER_SECRET;
if (!base || !key || !runId || !lane || !secret) throw Error("Public application worker is not configured.");

async function api(pathname, options = {}) {
  const response = await fetch(base + pathname, { ...options, headers: { apikey: key, Authorization: "Bearer " + key, ...(options.headers || {}) } });
  if (!response.ok) throw Error("Supabase request failed: " + response.status);
  if (options.binary) return response;
  return response.status === 204 ? null : response.json();
}
async function rpc(name, body) { return api("/rest/v1/rpc/" + name, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); }
async function patch(table, query, body) { return api("/rest/v1/" + table + "?" + query, { method: "PATCH", headers: { "content-type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(body) }); }
async function log(run, user, event, message) {
  await api("/rest/v1/automation_run_events", { method: "POST", headers: { "content-type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ run_id: run, user_id: user, event_type: event, message, metadata: {} }) });
}
function expectedLane(user) { return crypto.createHmac("sha256", secret).update("owner:" + user).digest("hex"); }
function same(a, b) { return typeof a === "string" && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
function delay() { return new Promise(resolve => setTimeout(resolve, 1800 + Math.floor(Math.random() * 2600))); }

async function main() {
  const [run] = await api("/rest/v1/automation_runs?id=eq." + encodeURIComponent(runId) + "&select=id,user_id,summary,status");
  if (!run || run.status !== "queued" || !same(lane, expectedLane(run.user_id))) throw Error("Run authorization rejected.");
  const mode = run.summary?.mode;
  if (!["public_form_inspect", "public_form_apply"].includes(mode)) throw Error("Run mode rejected.");
  await patch("automation_runs", "id=eq." + encodeURIComponent(runId) + "&status=eq.queued", { status: "running", started_at: new Date().toISOString() });
  await log(runId, run.user_id, "started", "Processamento de formulários públicos iniciado.");
  const [profile] = await api("/rest/v1/professional_profiles?user_id=eq." + encodeURIComponent(run.user_id) + "&select=full_name,phone,summary");
  const authUser = await api("/auth/v1/admin/users/" + encodeURIComponent(run.user_id));
  const email = authUser?.email || authUser?.user?.email;
  if (!profile?.full_name || !email) throw Error("Candidate profile is incomplete.");
  const [answersRow] = await api("/rest/v1/public_application_answers?user_id=eq." + encodeURIComponent(run.user_id) + "&select=answers");
  let resumePath = null;
  if (mode === "public_form_apply") {
    const [resume] = await api("/rest/v1/resumes?user_id=eq." + encodeURIComponent(run.user_id) + "&is_default=eq.true&select=storage_path,mime_type,size_bytes");
    if (!resume?.storage_path || resume.mime_type !== "application/pdf" || Number(resume.size_bytes || 0) > 10_000_000) throw Error("Default PDF resume is unavailable.");
    const data = await api("/storage/v1/object/curriculos/" + resume.storage_path.replace(/^\/+/, ""), { binary: true });
    const bytes = Buffer.from(await data.arrayBuffer());
    if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw Error("Resume file is not PDF.");
    resumePath = path.join(os.tmpdir(), "resume-" + runId + ".pdf"); fs.writeFileSync(resumePath, bytes, { mode: 0o600 });
  }
  const browser = await chromium.launch({ headless: true });
  let inspected = 0, confirmed = 0, needsAction = 0, uncertain = 0;
  try {
    for (let index = 0; index < 10; index += 1) {
      const rows = await rpc("public_apply_claim", { p_run: runId });
      const job = rows?.[0]; if (!job) break;
      const page = await browser.newPage();
      try {
        const result = await visit(page, job.url, { submit: mode === "public_form_apply", profile: { ...profile, email }, answers: answersRow?.answers || {}, resumePath, reserve: () => rpc("public_apply_reserve", { p_run: runId, p_job: job.id }) });
        if (result.status === "ready") { inspected += 1; await patch("public_application_queue", "id=eq." + job.id, { status: "ready", reason: "form_observed", updated_at: new Date().toISOString() }); }
        else if (result.status === "confirmed") {
          const evidencePath = run.user_id + "/public-" + job.id + ".jpg";
          const image = Buffer.from(result.screenshot, "base64");
          await api("/storage/v1/object/runner-evidence/" + evidencePath, { method: "POST", headers: { "content-type": "image/jpeg", "x-upsert": "true" }, body: image });
          const complete = await rpc("public_apply_complete", { p_run: runId, p_job: job.id, p_path: evidencePath, p_proof: String(result.text).slice(0, 500) });
          if (!complete) throw Error("Evidence completion rejected."); confirmed += 1;
        } else if (result.status === "unconfirmed") { uncertain += 1; await patch("public_application_queue", "id=eq." + job.id, { status: "unconfirmed", reason: result.reason || "provider_uncertain", updated_at: new Date().toISOString() }); }
        else { needsAction += 1; await patch("public_application_queue", "id=eq." + job.id, { status: "needs_action", reason: result.reason || "unknown_form", updated_at: new Date().toISOString() }); }
      } finally { await page.close().catch(() => {}); }
      await delay();
    }
  } finally { await browser.close(); if (resumePath) fs.rmSync(resumePath, { force: true }); }
  await patch("automation_runs", "id=eq." + encodeURIComponent(runId), { status: "succeeded", finished_at: new Date().toISOString(), summary: { mode, inspected, confirmed, needs_action: needsAction, unconfirmed: uncertain } });
  await log(runId, run.user_id, "completed", "Processamento de formulários públicos concluído.");
  console.log(JSON.stringify({ outcome: "completed", inspected, confirmed, needs_action: needsAction, unconfirmed: uncertain }));
}
main().catch(async () => { try {
  await patch("public_application_queue", "run_id=eq." + encodeURIComponent(runId) + "&status=eq.checking", { status: "needs_action", reason: "interrupted", updated_at: new Date().toISOString() });
  await patch("public_application_queue", "run_id=eq." + encodeURIComponent(runId) + "&status=eq.applying", { status: "unconfirmed", reason: "interrupted", updated_at: new Date().toISOString() });
  await patch("automation_runs", "id=eq." + encodeURIComponent(runId), { status: "failed", finished_at: new Date().toISOString(), error_message: "O processamento seguro não foi concluído." });
} catch {} console.log(JSON.stringify({ outcome: "failed" })); process.exitCode = 1; });
