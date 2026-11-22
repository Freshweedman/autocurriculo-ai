/**
 * Conservative public job URL validation.
 * Design informed by the MIT-licensed Carreira Guiada registry module; this
 * implementation is independent and only accepts public individual postings.
 */
const TRACKING_KEYS = new Set(["jk", "vjk", "jobid", "job_id", "vacancyid", "id"]);
const BLOCKED_PATHS = /\/(?:search|buscar|busca|login|auth|oauth|companies?|empresas?|vagas?-de-emprego|jobs?)\/?$/i;
const JOB_PATH = /\/(?:jobs?|vagas?|vacancies|positions|opportunities)\/(?:view\/)?[^/?#]{4,}/i;

function canonicalJobUrl(value) {
  try {
    const parsed = new URL(String(value));
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) return null;
    if (BLOCKED_PATHS.test(parsed.pathname)) return null;
    const knownAtsPath = (parsed.hostname.endsWith("jobs.lever.co") || parsed.hostname.endsWith("jobs.ashbyhq.com")) && /^\/[^/]+\/[^/?#]{4,}/.test(parsed.pathname);
    const infoJobsPath = /(^|\.)infojobs\.com\.br$/.test(parsed.hostname) && /^\/vaga-de-.+__\d+\.aspx$/i.test(parsed.pathname);
    const hasIndividualPath = JOB_PATH.test(parsed.pathname) || knownAtsPath || infoJobsPath;
    const id = [...parsed.searchParams.keys()].some((key) => TRACKING_KEYS.has(key.toLowerCase()));
    if (!hasIndividualPath && !id) return null;
    const clean = new URL(parsed.origin + parsed.pathname.replace(/\/$/, ""));
    for (const [key, value] of parsed.searchParams) if (TRACKING_KEYS.has(key.toLowerCase())) clean.searchParams.set(key.toLowerCase(), value);
    return clean.toString();
  } catch { return null; }
}

module.exports = { canonicalJobUrl };
