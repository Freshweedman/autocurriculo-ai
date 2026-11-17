const fetch = require("node-fetch");
const { log } = require("../utils/logger");

const TIMEOUT_MS = 12_000;

function containsTerm(value, terms) {
  const normalized = String(value || "").toLocaleLowerCase("pt-BR");
  return terms.some((term) => normalized.includes(term));
}

function keywordsFor(cargo) {
  const aliases = { qualidade: ["quality", "qa", "q.a."], analista: ["analyst"], desenvolvedor: ["developer", "engineer"], tecnologia: ["tech"], vendas: ["sales"], designer: ["design"], tráfego: ["traffic", "media buyer"], trafego: ["traffic", "media buyer"] };
  const ignored = new Set(["de", "da", "do", "e", "em", "para", "com", "junior", "pleno", "senior"]);
  const words = String(cargo || "").toLocaleLowerCase("pt-BR").split(/[^\p{L}\p{N}.]+/u).filter((word) => word.length > 2 && !ignored.has(word));
  return [...new Set(words.flatMap((word) => [word, ...(aliases[word] || [])]))];
}

async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } finally { clearTimeout(timer); }
}

async function discoverPublicBoards({ cargo, limiteDiario = 30 }) {
  const terms = keywordsFor(cargo);
  const sources = await Promise.allSettled([
    getJson("https://remotive.com/api/remote-jobs").then((data) => (data.jobs || []).map((job) => ({ empresa: job.company_name, vaga: job.title, vaga_url: job.url, local: job.candidate_required_location || "Remoto", plataforma: "Remotive", raw: `${job.title} ${(job.tags || []).join(" ")}` }))),
    getJson("https://www.arbeitnow.com/api/job-board-api").then((data) => (data.data || []).map((job) => ({ empresa: job.company_name, vaga: job.title, vaga_url: job.url, local: job.location || (job.remote ? "Remoto" : ""), plataforma: "Arbeitnow", raw: job.title }))),
    getJson("https://remoteok.com/api").then((data) => (Array.isArray(data) ? data.slice(1) : []).map((job) => ({ empresa: job.company, vaga: job.position, vaga_url: job.url, local: job.location || "Remoto", plataforma: "Remote OK", raw: `${job.position || ""} ${(job.tags || []).join(" ")}` }))),
  ]);
  const unique = new Map();
  for (const source of sources) {
    if (source.status === "rejected") { log(`[PUBLIC BOARDS] Fonte indisponível: ${source.reason.message}`); continue; }
    for (const job of source.value) {
      if (!job.vaga || !job.vaga_url || (terms.length && !containsTerm(job.raw, terms))) continue;
      unique.set(job.vaga_url, { empresa: job.empresa || job.plataforma, vaga: job.vaga, vaga_url: job.vaga_url, local: job.local, plataforma: job.plataforma, status: "coletado" });
      if (unique.size >= limiteDiario) break;
    }
  }
  const results = [...unique.values()].slice(0, limiteDiario);
  log(`[PUBLIC BOARDS] ${results.length} vaga(s) pública(s) encontradas.`);
  return results;
}

module.exports = { discoverPublicBoards };
