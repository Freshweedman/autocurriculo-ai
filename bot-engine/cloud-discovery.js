const { chromium } = require("playwright");
const crypto = require("crypto");
const { expand, rank } = require("./local/discovery");
const { sources } = require("./local/platforms");

const base = (process.env.API_URL || "https://autocurriculo-ai.vercel.app").replace(/\/$/, "");
const database = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.BOT_API_KEY;
const runId = process.env.AUTOMATION_RUN_ID;
const activeSources = sources.filter((source) => !["Indeed", "Trabalha Brasil"].includes(source.name));

async function json(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw Error(`HTTP ${response.status} em ${new URL(url).pathname}`);
  return response.json();
}

const read = (table, params) => json(`${database}/rest/v1/${table}?${new URLSearchParams(params)}`, {
  headers: { apikey: key, authorization: `Bearer ${key}` },
});
const report = (route, body) => json(base + "/api/webhook/" + route, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiKey, ...body }),
});
const classifyFlow = (source) => ["Greenhouse", "Lever", "Ashby", "Workable", "Recruitee"].includes(source) ? "public_form" : ["InfoJobs", "Gupy", "Catho", "Vagas.com"].includes(source) ? "login_required" : "assisted";

async function discover(browser, profile) {
  const id = profile.user_id;
  let currentRun = runId;
  async function event(eventType, message, runStatus) {
    const result = await report("automation-runs", { userId: id, runId: currentRun, eventType, message, runStatus });
    currentRun = result.runId;
  }

  await event("started", "Busca de vagas iniciada.", "running");
  try {
    const [[applicant], [preferences]] = await Promise.all([
      read("professional_profiles", { user_id: "eq." + id, select: "city,state,country_code", limit: 1 }),
      read("search_profiles", { user_id: "eq." + id, active: "eq.true", select: "remote_only,work_modes", limit: 1 }),
    ]);
    const filters = expand(profile, applicant, preferences || { remote_only: !profile.cidade });
    const terms = [...new Set([...filters.base.slice(0, 3), ...(filters.quality ? ["QA", "qualidade"] : [])])];
    const context = await browser.newContext({ locale: "pt-BR" });
    const jobs = new Map();
    let successfulSources = 0;
    try {
      for (const source of activeSources) {
        const page = !source.once || source.usesPage ? await context.newPage() : null;
        try {
          const searches = source.once ? [undefined] : terms;
          const results = [];
          for (const term of searches) {
            const result = await source.search(page, term, source.name === "Vagas.com" || source.name === "InfoJobs" ? (filters.remoteOnly ? "" : filters.city) : "");
            if (result.state !== "available") throw Error("Fonte indisponível nesta execução.");
            results.push(...result.jobs);
          }
          for (const listing of results) {
            const match = filters.stages.map((stage) => rank(listing, filters, stage)).sort((a, b) => b.score - a.score)[0];
            if (!match?.score || jobs.has(listing.url)) continue;
            jobs.set(listing.url, { vaga: listing.title, empresa: listing.company, vaga_url: listing.url,
              plataforma: listing.platform, local: listing.location, compatibility_score: match.score, match_reasons: [match.detail] });
          }
          successfulSources++;
          await event("source_finished", `${source.name}: ${new Set(results.map((job) => job.url)).size} anúncios consultados.`);
        } catch (error) {
          await event("source_finished", `${source.name}: ${error.message.slice(0, 180)}`);
        } finally { await page?.close(); }
      }
    } finally { await context.close(); }
    if (!successfulSources) throw Error("Nenhuma fonte respondeu à consulta.");
    const opportunities = [...jobs.values()].sort((a, b) => b.compatibility_score - a.compatibility_score).slice(0, 40);
    const result = await report("opportunities", { userId: id, runId: currentRun, opportunities });
    if (currentRun) {
      const items = opportunities.map((item) => ({ run_id: currentRun, user_id: id, source: item.plataforma, url_hash: crypto.createHash("sha256").update(item.vaga_url).digest("hex"), title: item.vaga, company: item.empresa, flow_type: classifyFlow(item.plataforma), compatible: true }));
      await json(`${database}/rest/v1/search_items?on_conflict=user_id%2Curl_hash`, { method: "POST", headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(items) });
    }
    await event("completed", `${result.linkedToUser ?? 0} vagas compatíveis disponíveis para candidatura.`, "succeeded");
  } catch (error) {
    await event("failed", `Busca interrompida. ${error.message.slice(0, 180)}`, "failed");
    throw error;
  }
}

async function main() {
  if (!database || !key || !apiKey) throw Error("Configuração da busca incompleta.");
  const [request] = runId ? await read("automation_runs", { id: "eq." + runId, status: "eq.queued", trigger_type: "eq.manual", select: "user_id", limit: 1 }) : [];
  if (runId && !request) throw Error("Busca solicitada não está mais na fila.");
  const criteria = request ? { user_id: "eq." + request.user_id } : { bot_ativo: "is.true" };
  const profiles = await read("profiles", { ...criteria, select: "user_id,cargo,cidade,seniority_level", "cargo": "not.is.null" });
  const eligible = profiles.filter((profile) => profile.cargo?.trim());
  if (!eligible.length) return;
  const browser = await chromium.launch({ headless: true });
  try {
    for (const profile of eligible) {
      try { await discover(browser, profile); }
      catch (error) { console.error(error.message); process.exitCode = 1; }
    }
  } finally { await browser.close(); }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
