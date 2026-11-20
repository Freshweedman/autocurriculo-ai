const fetch = require("node-fetch");
const { log } = require("../utils/logger");
const { canonicalJobUrl } = require("../utils/job-url");

const TIMEOUT_MS = 12_000;
const STOP_WORDS = new Set(["de", "da", "do", "das", "dos", "e", "em", "para", "com", "por", "uma", "um"]);
const COUNTRY_NAMES = { BR: ["brasil", "brazil", "br"], PT: ["portugal", "pt"], US: ["united states", "usa", "us", "estados unidos"], CA: ["canada", "canadá"] };

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^\p{L}\p{N}+#.]+/gu, " ").trim();
}

function tokenize(value) {
  return normalize(value).split(" ").filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function keywordsFor(cargo) {
  const aliases = { qualidade: ["quality", "qa", "q.a."], analista: ["analyst"], desenvolvedor: ["developer", "engineer"], tecnologia: ["tech"], vendas: ["sales"], designer: ["design"], trafego: ["traffic", "media buyer", "performance"], marketing: ["growth", "digital marketing", "marketing digital"] };
  return [...new Set(tokenize(cargo).flatMap((word) => [word, ...(aliases[word] || [])]))];
}

function locationAllowsJob(jobLocation, preferences) {
  const location = normalize(jobLocation);
  const country = String(preferences.countryCode || "BR").toUpperCase();
  const wantsInternational = preferences.internationalOnly === true || preferences.allowInternational === true;
  const remote = /remote|remoto|worldwide|anywhere|global/.test(location);
  if (!wantsInternational) {
    const allowedCountryNames = COUNTRY_NAMES[country] || [country.toLowerCase()];
    const latinAmerica = /latin america|latam|america latina/.test(location);
    if (country === "BR" && !(allowedCountryNames.some((name) => location.includes(name)) || latinAmerica || remote && /brazil|brasil|latam/.test(location))) return { allowed: false, reason: "A localização da vaga não confirma elegibilidade no Brasil." };
    if (country !== "BR" && !allowedCountryNames.some((name) => location.includes(name))) return { allowed: false, reason: "A localização não corresponde ao país configurado." };
  }
  const city = normalize(preferences.city);
  if (city && !preferences.remoteOnly && !remote && !location.includes(city)) return { allowed: false, reason: "A localização não corresponde à cidade configurada." };
  if (preferences.remoteOnly && !remote) return { allowed: false, reason: "A vaga não é remota." };
  return { allowed: true, remote };
}

function scoreJob(job, preferences) {
  const title = normalize(job.vaga);
  const body = normalize(`${job.vaga} ${job.raw || ""}`);
  const requested = keywordsFor(preferences.cargo || "");
  const titleMatches = requested.filter((term) => title.includes(normalize(term)));
  const bodyMatches = requested.filter((term) => body.includes(normalize(term)));
  const uniqueTitle = new Set(titleMatches).size;
  const uniqueBody = new Set(bodyMatches).size;
  const location = locationAllowsJob(job.local, preferences);
  if (!location.allowed) return { accepted: false, score: 0, reasons: [location.reason] };
  const titleScore = Math.min(30, uniqueTitle * 15);
  const skillScore = Math.min(25, Math.max(0, uniqueBody - uniqueTitle) * 8 + (uniqueTitle ? 8 : 0));
  if (titleScore < 15 && uniqueBody < 2) return { accepted: false, score: 0, reasons: ["O título e os requisitos não correspondem suficientemente ao cargo desejado."] };
  const locationScore = location.remote ? 14 : 20;
  const score = Math.min(100, titleScore + skillScore + locationScore);
  return { accepted: score >= 45, score, reasons: [titleScore ? `${uniqueTitle} termo(s) do cargo no título` : "termos relacionados nos requisitos", location.remote ? "modalidade remota compatível" : "localização compatível"] };
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

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&ccedil;/gi, "ç").replace(/&atilde;/gi, "ã").replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é").replace(/&iacute;/gi, "í").replace(/&oacute;/gi, "ó").replace(/&uacute;/gi, "ú");
}

function vagasSlug(value) {
  return normalize(value).replace(/\s+/g, "-");
}

async function discoverVagasBrasil({ cargo, city }) {
  const term = String(cargo || "").split(",")[0].trim();
  const locationLabel = String(city || "").trim();
  const location = locationLabel.split(",")[0].trim();
  if (!term || !location) return [];
  const fallbackTerms = tokenize(term).filter((word) => !["analista", "vaga", "emprego"].includes(word)).slice(0, 1);
  const terms = [...new Set([term, ...fallbackTerms])];
  const results = new Map();
  for (const currentTerm of terms) {
    const url = `https://www.vagas.com.br/vagas-de-${vagasSlug(currentTerm)}-em-${vagasSlug(location)}?ordenar_por=mais_relevantes`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, { headers: { "User-Agent": "AutoCurriculoAI/1.0 (+https://autocurriculo-ai.vercel.app)", Accept: "text/html" }, signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const matches = [...html.matchAll(/<a\s+class="link-detalhes-vaga"[^>]*title="([^"]+)"[^>]*href="([^"]+)"/gi)];
      for (const match of matches.slice(0, 25)) {
        const vaga = decodeHtml(match[1]).trim();
        const canonicalUrl = canonicalJobUrl(`https://www.vagas.com.br${decodeHtml(match[2])}`);
        if (vaga && canonicalUrl) results.set(canonicalUrl, { empresa: "Vagas.com", vaga, vaga_url: canonicalUrl, local: `${locationLabel}, Brasil`, plataforma: "Vagas.com", raw: vaga });
      }
    } finally { clearTimeout(timer); }
  }
  return [...results.values()];
}

async function discoverPublicBoards({ cargo, limiteDiario = 30, preferences = {} }) {
  const mergedPreferences = { countryCode: "BR", cargo, allowInternational: false, ...preferences };
  const sources = await Promise.allSettled([
    getJson("https://remotive.com/api/remote-jobs").then((data) => (data.jobs || []).map((job) => ({ empresa: job.company_name, vaga: job.title, vaga_url: job.url, local: job.candidate_required_location || "Remoto", plataforma: "Remotive", raw: `${job.title} ${(job.tags || []).join(" ")}` }))),
    getJson("https://www.arbeitnow.com/api/job-board-api").then((data) => (data.data || []).map((job) => ({ empresa: job.company_name, vaga: job.title, vaga_url: job.url, local: job.location || (job.remote ? "Remoto" : ""), plataforma: "Arbeitnow", raw: `${job.title || ""} ${job.description || ""}` }))),
    getJson("https://remoteok.com/api").then((data) => (Array.isArray(data) ? data.slice(1) : []).map((job) => ({ empresa: job.company, vaga: job.position, vaga_url: job.url, local: job.location || "Remoto", plataforma: "Remote OK", raw: `${job.position || ""} ${(job.tags || []).join(" ")} ${job.description || ""}` }))),
    discoverVagasBrasil({ cargo, city: mergedPreferences.city }),
  ]);
  const unique = new Map();
  for (const source of sources) {
    if (source.status === "rejected") { log(`[PUBLIC BOARDS] Fonte indisponível: ${source.reason.message}`); continue; }
    log(`[PUBLIC BOARDS] Fonte retornou ${source.value.length} registro(s) brutos.`);
    for (const job of source.value) {
      const canonicalUrl = canonicalJobUrl(job.vaga_url);
      if (!job.vaga || !canonicalUrl) continue;
      const match = scoreJob(job, mergedPreferences);
      if (!match.accepted) continue;
      unique.set(canonicalUrl, { empresa: job.empresa || job.plataforma, vaga: job.vaga, vaga_url: canonicalUrl, local: job.local, plataforma: job.plataforma, status: "coletado", compatibility_score: match.score, match_reasons: match.reasons });
    }
  }
  const results = [...unique.values()].sort((a, b) => b.compatibility_score - a.compatibility_score).slice(0, limiteDiario);
  log(`[PUBLIC BOARDS] ${results.length} vaga(s) pública(s) encontradas.`);
  return results;
}

module.exports = { discoverPublicBoards, discoverVagasBrasil, scoreJob, locationAllowsJob, normalize };
