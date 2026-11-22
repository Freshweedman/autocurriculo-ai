const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { createInterface } = require("node:readline/promises");
const { setTimeout: delay } = require("node:timers/promises");
const { expand, rank } = require("./discovery");
const { canonicalJobUrl } = require("../utils/job-url");
const { sources, indeed } = require("./platforms");
const { randomDelay } = require("../utils/delays");

const HOME_DIR = path.join(process.env.LOCALAPPDATA || os.homedir(), "AutoCurriculo");
const PROFILE = path.join(HOME_DIR, "browser-profile");
const ARTIFACTS = path.join(HOME_DIR, "evidence");
const CREDENTIAL = path.join(HOME_DIR, "runner.json");
const INSTANCE = randomUUID();
const TARGET = 25;
const args = process.argv.slice(2);
const requestedUrl = args.find((argument) => argument.startsWith("--vaga="))?.slice(7);
let stopping = false;
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

async function openBrowser() {
  await fs.mkdir(HOME_DIR, { recursive: true });
  return chromium.launchPersistentContext(PROFILE, {
    channel: "chrome", headless: false, locale: "pt-BR", viewport: { width: 1366, height: 900 },
  });
}

function apiBase(value) {
  const url = new URL(value || "https://autocurriculo-ai.vercel.app");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost")) {
    throw Error("Use HTTPS para o painel.");
  }
  return url.origin;
}

async function connection() {
  if (args.includes("vincular")) {
    const terminal = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const base = apiBase((await terminal.question("URL do painel [https://autocurriculo-ai.vercel.app]: ")).trim());
      const token = (await terminal.question("Código de vínculo da Central de Automação: ")).trim();
      if (!/^[a-f0-9]{64}$/i.test(token)) throw Error("Código de vínculo inválido.");
      await fs.mkdir(HOME_DIR, { recursive: true });
      await fs.writeFile(CREDENTIAL, JSON.stringify({ base, token }), { mode: 0o600 });
      console.log("Vínculo salvo neste computador.");
    } finally { terminal.close(); }
  }
  try { return JSON.parse(await fs.readFile(CREDENTIAL, "utf8")); }
  catch { throw Error("Execute runner.bat vincular e use o código do painel."); }
}

function client({ base, token }) {
  return async (action, payload = {}) => {
    const response = await fetch(apiBase(base) + "/api/local-runner", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Runner-Instance": INSTANCE },
      body: JSON.stringify({ action, ...payload }), signal: AbortSignal.timeout(25_000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(Error(body.error || `Painel respondeu HTTP ${response.status}.`), { status: response.status });
    return body;
  };
}

async function captureFor(job) {
  const directory = path.join(ARTIFACTS, job);
  await fs.mkdir(directory, { recursive: true });
  return (page, name) => page.screenshot({ path: path.join(directory, name + ".png"), timeout: 5000 });
}

async function downloadResume(post, directory) {
  const { url } = await post("resume");
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok || Number(response.headers.get("content-length")) > 10_485_760) throw Error("PDF indisponível ou acima de 10 MB.");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 10_485_760 || buffer.subarray(0, 5).toString() !== "%PDF-") throw Error("O currículo selecionado não é um PDF válido de até 10 MB.");
  const file = path.join(directory, "Curriculo.pdf");
  await fs.writeFile(file, buffer);
  return file;
}

async function flushProof(api, outbox) {
  await fs.mkdir(outbox, { recursive: true });
  for (const file of await fs.readdir(outbox)) {
    if (!/^[a-f0-9-]+\.json$/.test(file)) continue;
    const target = path.join(outbox, file);
    await api("finish", JSON.parse(await fs.readFile(target, "utf8")));
    await fs.unlink(target);
  }
}

async function processJob({ source, page, job, state, post, api, dryRun, outbox }) {
  const authorized = state.profile?.direct_submission_enabled === true
    && process.env.AUTOCURRICULO_INDEED_ENVIO_AUTORIZADO === "1";
  if (source === indeed && !dryRun && !authorized) {
    return { status: "needs_review", detail: "Habilite o consentimento no perfil e confirme a permissão do Indeed para envio automatizado, ou candidate-se no portal." };
  }
  if (source !== indeed) return source.apply(page, job);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "autocurriculo-"));
  let reserved = false;
  let outcome;
  try {
    const resume = await downloadResume(post, directory);
    const capture = await captureFor(job.id);
    outcome = await source.apply(page, job, {
      profile: state.applicant, answers: state.answers, resumePath: resume, dryRun, capture,
      beforeSubmit: async () => {
        if (stopping) return false;
        const decision = await post("reserve", { id: job.id });
        reserved = decision.allowed;
        return reserved;
      },
    });
  } catch (error) {
    if (error.status === 409) throw error;
    outcome = { status: error.status === 404 ? "needs_review" : "failed", detail: error.message.slice(0, 500) };
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
  if (reserved) {
    const proof = outcome.status === "applied_confirmed"
      ? { id: job.id, text: outcome.text, url: outcome.url, screenshot: outcome.screenshot }
      : { id: job.id };
    const target = path.join(outbox, job.id + ".json");
    const temporary = target + ".tmp";
    await fs.writeFile(temporary, JSON.stringify(proof), { mode: 0o600 });
    await fs.rename(temporary, target);
    const saved = await api("finish", proof);
    await fs.unlink(target);
    return { status: saved.confirmed ? "applied_confirmed" : "applied_unconfirmed", detail: proof.text || "Confira o histórico na plataforma." };
  }
  return outcome;
}

const blocked = new Set();
const backoff = new Map();

async function scan(context, state, api, outbox) {
  const post = (action, payload) => api(action, { ...payload, generation: state.generation });
  const dryRun = args.includes("--dry-run");
  const filters = expand(state.profile, state.applicant, state.search);
  const found = new Map();
  const titles = new Set();
  const boardCache = new Map();
  const singleJob = requestedUrl ? canonicalJobUrl(requestedUrl) : null;
  if (requestedUrl && !singleJob) throw Error("Passe a URL individual da vaga em --vaga.");
  const target = singleJob ? 1 : Math.min(TARGET, state.profile?.limite_diario || TARGET);
  const qualifying = new Map();
  const firstStage = new Map();

  for (const [index, stage] of filters.stages.entries()) {
    if (stopping || qualifying.size >= target) break;
    if (index > 0) await post("event", { message: `A busca encontrou ${qualifying.size} compatíveis. Ampliando para ${stage.name}.` });
    for (const source of sources) {
      if (stopping || qualifying.size >= target) break;
      if (blocked.has(source.name) || (backoff.get(source.name)?.until || 0) > Date.now()) continue;
      const page = source.once && !source.usesPage ? null : await context.newPage();
      let raw = [];
      try {
        if (source.once) {
          if (!boardCache.has(source.name)) boardCache.set(source.name, await source.search(page));
          const { jobs, warning } = boardCache.get(source.name);
          raw = jobs;
          if (warning && index === 0) await post("event", { platform: source.name, message: warning });
        } else {
          const terms = index === 0 ? filters.synonyms.slice(0, 3) : filters.synonyms;
          const locations = ["Catho", "Trabalha Brasil"].includes(source.name) ? [""] : stage.locations;
          search: for (const term of terms) {
            for (const location of locations) {
              if (stopping) break search;
              await post("event", { platform: source.name, message: `Busca por ${term} · ${location || stage.name}.` });
              const result = await source.search(page, term, location);
              if (result.state === "needs_login") {
                blocked.add(source.name);
                await post("event", { platform: source.name, message: "needs_login · Resolva o login ou a verificação no perfil local. Reinicie o runner depois." });
                break search;
              }
              raw.push(...result.jobs);
              await randomDelay(800, 1800);
            }
          }
        }
        for (const job of raw) {
          if (!job.title || !job.company || !job.location) continue;
          const match = rank(job, filters, stage);
          if (!found.has(job.url)) {
            found.set(job.url, { ...job, ...match });
            firstStage.set(job.url, source);
          }
          if (!match.score || qualifying.has(job.url) || singleJob && singleJob !== job.url) continue;
          const key = [job.title, job.company].join("|").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
          if (titles.has(key)) continue;
          titles.add(key);
          qualifying.set(job.url, { ...job, ...match });
        }
        backoff.delete(source.name);
        await post("event", { platform: source.name, message: `${new Set(raw.map((job) => job.url)).size} vagas identificadas em ${stage.name}.` });
      } catch (error) {
        if (error.status) throw error;
        const failures = (backoff.get(source.name)?.failures || 0) + 1;
        const minutes = Math.min(180, 2 ** failures);
        backoff.set(source.name, { failures, until: Date.now() + minutes * 60_000 });
        await post("event", { platform: source.name, message: `${error.message.slice(0, 200)} · nova tentativa em ${minutes} min.` });
      } finally { await page?.close(); }
    }
  }

  const ranked = [...qualifying.values()].sort((left, right) => right.score - left.score);
  await post("event", { message: `${ranked.length} vagas compatíveis encontradas · meta diária de ${target}.` });
  for (const job of [...found.values()].filter((job) => !job.score && !qualifying.has(job.url)).slice(0, 15)) {
    if (stopping) return;
    await post("job", { ...job, status: "skipped_filter" });
  }
  let ready = 0;
  const byPlatform = new Map();
  for (const job of ranked) {
    if (stopping || ready >= target) break;
    const source = firstStage.get(job.url);
    if (blocked.has(source.name)) continue;
    const current = byPlatform.get(job.platform) || 0;
    if (current >= (state.limits[job.platform] || 30)) continue;
    const row = await post("job", { ...job, status: "queued" });
    if (!row.id || row.status !== "queued") continue;
    const page = source === indeed ? await context.newPage() : null;
    try {
      const outcome = await processJob({ source, page, job: { ...job, id: row.id }, state, post, api, dryRun, outbox });
      if (outcome.status === "needs_login") blocked.add(source.name);
      if (["needs_login", "needs_review", "skipped_external", "failed"].includes(outcome.status)) {
        await post("update", { id: row.id, status: outcome.status, detail: outcome.detail });
      }
      if (outcome.status !== "queued") {
        await post("event", { platform: job.platform, message: `${outcome.status} · ${job.title} · ${outcome.detail || ""}` });
      }
      if (outcome.status === "applied_confirmed" || outcome.status === "applied_unconfirmed" || outcome.status === "dry_run") {
        ready += 1;
        byPlatform.set(job.platform, current + 1);
      }
      if (outcome.status === "dry_run") return;
    } finally { await page?.close(); }
  }
}

async function probe(context, loginOnly) {
  const page = context.pages()[0] || await context.newPage();
  if (loginOnly) {
    await page.goto(indeed.loginUrl, { waitUntil: "domcontentloaded", timeout: 25_000 }).catch((error) => console.error(error.message));
    console.log("Entre no Indeed usando o seu método de login. Feche o Chrome dedicado quando terminar.");
    await new Promise((resolve) => context.once("close", resolve));
    return;
  }
  if (args.includes("verificar-login")) {
    const signedIn = await indeed.loggedIn(page);
    if (signedIn) {
      const capture = await captureFor("sessao-indeed");
      await capture(page, "login-reutilizado");
    }
    console.log(signedIn ? "Sessão do Indeed reconhecida e captura salva." : "Sessão do Indeed não reconhecida neste perfil.");
    return;
  }
  const filters = expand({ cargo: args[1], cidade: args[2] });
  for (const source of sources) {
    const raw = new Map();
    const compatible = new Map();
    let state = "available";
    let warning = "";
    let cached;
    try {
      outer: for (const stage of filters.stages) {
        for (const term of filters.quality ? [...filters.synonyms.slice(0, 3), "qualidade"] : filters.synonyms.slice(0, 3)) {
          const { state: result, jobs, warning: note } = cached || await source.search(page, term, stage.locations[0]);
          if (source.once) cached = { state: result, jobs, warning: note };
          state = result;
          warning = note || warning;
          if (state !== "available") break outer;
          for (const job of jobs) {
            raw.set(job.url, job);
            if (rank(job, filters, stage).score) compatible.set(job.url, job);
          }
          if (source.once || compatible.size >= 5) break;
          await randomDelay(800, 1600);
        }
        if (compatible.size >= 5) break;
      }
    } catch (error) { state = "failed"; warning = error.message.slice(0, 250); }
    console.log(JSON.stringify({ source: source.name, state, total: raw.size, compatible: compatible.size, warning,
      urls: [...compatible.keys()].slice(0, 5), sample: [...raw.keys()].slice(0, 2) }));
  }
}

async function main() {
  const standalone = ["login", "verificar-login", "buscar"].includes(args[0]);
  const api = standalone ? null : client(await connection());
  const context = await openBrowser();
  context.on("close", () => { stopping = true; });
  try {
    if (standalone) return await probe(context, args[0] === "login");
    const outbox = path.join(HOME_DIR, "outbox");
    let nextScan = 0;
    let generation = "";
    let failureWait = 5_000;
    let activeScan = null;
    console.log("Runner local aberto. Use START e STOP na Central de Automação.");
    while (!stopping) {
      try {
        const state = await api("poll");
        if (!activeScan) await flushProof(api, outbox);
        failureWait = 5_000;
        if (generation !== state.generation) {
          nextScan = 0;
          generation = state.generation;
          if (state.enabled) blocked.clear();
        }
        if (state.enabled && !activeScan && Date.now() >= nextScan) {
          nextScan = Date.now() + 30 * 60_000;
          activeScan = scan(context, state, api, outbox)
            .catch((error) => { if (error.status !== 409) console.error("Busca interrompida:", error.message); })
            .finally(() => { activeScan = null; });
        }
      } catch (error) {
        console.error(error.message);
        if (error.status === 401) break;
        failureWait = Math.min(failureWait * 2, 60_000);
      }
      if (!stopping) await delay(failureWait);
    }
    stopping = true;
    await activeScan;
  } finally { await context.close(); }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
