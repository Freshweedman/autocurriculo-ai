const { canonicalJobUrl } = require("../../utils/job-url");

const LOGIN = /\b(?:login|signin|sign-in|checkpoint|challenge|captcha)\b/i;
const BLOCKED = /verify (?:that )?you are human|verifique se você é humano|atividade incomum|unusual activity|just a moment|access denied|complete the security check/i;

async function detectState(page, response) {
  if ([401, 403].includes(response?.status()) || LOGIN.test(new URL(page.url()).pathname)) return "needs_login";
  const title = await page.title().catch(() => "");
  const challenges = page.locator('iframe[src*="captcha"], iframe[src*="turnstile"], [id^="cf-chl-"], form[action*="challenge"]');
  const loginForm = page.locator("input[type=password]").first();
  const security = page.getByRole("heading", { name: BLOCKED }).first();
  if (BLOCKED.test(title) || await security.isVisible() || await loginForm.isVisible() || await challenges.first().isVisible()) return "needs_login";
  if (response && !response.ok()) throw Error(`HTTP ${response.status()}`);
  return "available";
}

function parseJob(data, platform, host, pathPattern) {
  if (!data?.title || !data.company || !data.location || !data.url) return null;
  let url;
  try { url = new URL(data.url); } catch { return null; }
  if (!(url.hostname === host || url.hostname.endsWith("." + host)) || !pathPattern.test(url.pathname)) return null;
  const canonical = canonicalJobUrl(url.href);
  if (!canonical) return null;
  return { platform, url: canonical, title: data.title.trim(), company: data.company.trim(), location: data.location.trim() };
}

async function readListing(page, config) {
  return page.evaluate(({ link, card, title, company, location, mode, companyFallback, indeed }) => {
    const text = (node) => node?.textContent?.trim()?.replace(/\s+/g, " ") || "";
    const address = (value) => {
      const a = value?.address || value;
      return typeof a === "string" ? a : [a?.addressLocality, a?.addressRegion, a?.addressCountry?.name || a?.addressCountry].filter((part) => typeof part === "string").join(", ");
    };
    const structured = [];
    function walk(value) {
      if (!value || typeof value !== "object") return;
      if (value["@type"] === "JobPosting") {
        structured.push({
          url: value.url || value.mainEntityOfPage?.["@id"] || document.querySelector('link[rel="canonical"]')?.href,
          title: value.title,
          company: value.hiringOrganization?.name,
          location: [Array.isArray(value.jobLocation) ? value.jobLocation.map(address).join("; ") : address(value.jobLocation), value.jobLocationType === "TELECOMMUTE" && "Remoto", value.applicantLocationRequirements?.name].filter(Boolean).join(", "),
        });
        return;
      }
      Object.values(value).forEach(walk);
    }
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try { walk(JSON.parse(script.textContent)); } catch { /* Ignore malformed site metadata. */ }
    }
    const cards = Array.from(document.querySelectorAll(link)).slice(0, 180).map((anchor) => {
      const root = anchor.closest(card) || anchor.parentElement;
      const key = indeed && (anchor.getAttribute("data-jk") || root?.querySelector("[data-jk]")?.getAttribute("data-jk"));
      return {
        url: key ? new URL("/viewjob?jk=" + encodeURIComponent(key), document.location.origin).href : anchor.href,
        title: text(root?.querySelector(title)) || anchor.getAttribute("title") || text(anchor),
        company: text(root?.querySelector(company)) || companyFallback,
        location: [text(root?.querySelector(location)), mode && text(root?.querySelector(mode))].filter(Boolean).join(", "),
      };
    });
    return [...structured, ...cards];
  }, config);
}

function listing({ name, host, path, searchUrl, selectors, transform = (job) => job }) {
  return {
    name,
    detectState,
    parseJob(raw) { return parseJob(transform(raw), name, host, path); },
    async search(page, term, location) {
      const response = await page.goto(searchUrl(term, location), { waitUntil: "domcontentloaded", timeout: 18_000 });
      const state = await this.detectState(page, response);
      if (state !== "available") return { state, jobs: [] };
      const rows = await readListing(page, selectors);
      return { state, jobs: rows.map((raw) => this.parseJob(raw)).filter(Boolean) };
    },
    async apply() {
      return { status: "needs_review", detail: "Abra a vaga para revisar o formulário no portal." };
    },
  };
}

module.exports = { listing, detectState };
