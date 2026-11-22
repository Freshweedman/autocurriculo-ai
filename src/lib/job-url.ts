const TRACKING_KEYS = new Set(["jk", "vjk", "jobid", "job_id", "vacancyid", "id"]);

export function canonicalJobUrl(value: string | undefined): string | null {
  try {
    const parsed = new URL(String(value));
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) return null;
    if (/\/(?:search|buscar|busca|login|auth|oauth|companies?|empresas?|vagas?-de-emprego|jobs?)\/?$/i.test(parsed.pathname)) return null;
    const knownAtsPath = (parsed.hostname.endsWith("jobs.lever.co") || parsed.hostname.endsWith("jobs.ashbyhq.com")) && /^\/[^/]+\/[^/?#]{4,}/.test(parsed.pathname);
    const infoJobsPath = /(^|\.)infojobs\.com\.br$/.test(parsed.hostname) && /^\/vaga-de-.+__\d+\.aspx$/i.test(parsed.pathname);
    const hasIndividualPath = /\/(?:jobs?|vagas?|vacancies|positions|opportunities)\/(?:view\/)?[^/?#]{4,}/i.test(parsed.pathname) || knownAtsPath || infoJobsPath;
    const hasId = [...parsed.searchParams.keys()].some((key) => TRACKING_KEYS.has(key.toLowerCase()));
    if (!hasIndividualPath && !hasId) return null;
    const clean = new URL(parsed.origin + parsed.pathname.replace(/\/$/, ""));
    for (const [key, item] of parsed.searchParams) if (TRACKING_KEYS.has(key.toLowerCase())) clean.searchParams.set(key.toLowerCase(), item);
    return clean.toString();
  } catch { return null; }
}
