const { completeLocalApplication } = require("../forms/local-application");
const { detectState } = require("../local/platforms/listing");
const { randomDelay } = require("../utils/delays");

const SUBMIT = /^(?:submit application|send application|enviar candidatura|enviar sua candidatura|enviar inscrição|finalizar candidatura|submit)$/i;

function describe(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const segments = url.pathname.split("/").filter(Boolean);
    const host = url.hostname;
    if (["boards.greenhouse.io", "job-boards.greenhouse.io", "boards.eu.greenhouse.io", "job-boards.eu.greenhouse.io"].includes(host)
      && segments[1] === "jobs" && /^\d+$/.test(segments[2] || "")) return { name: "Greenhouse", url, prefix: "/" + segments.slice(0, 3).join("/") };
    if (["jobs.lever.co", "jobs.eu.lever.co", "jobs.ashbyhq.com"].includes(host) && /^[\da-f-]{36}$/i.test(segments[1] || "")) {
      const name = host === "jobs.ashbyhq.com" ? "Ashby" : "Lever";
      return { name, url, prefix: "/" + segments.slice(0, 2).join("/"), tail: name === "Lever" ? "/apply" : "/application" };
    }
    if (host === "apply.workable.com" && segments[1] === "j" && /^[A-Z\d]+$/i.test(segments[2] || ""))
      return { name: "Workable", url, prefix: "/" + segments.slice(0, 3).join("/"), tail: "/apply" };
    if (/^[a-z\d-]+\.recruitee\.com$/.test(host) && segments[0] === "o" && /^[a-z\d-]+$/i.test(segments[1] || ""))
      return { name: "Recruitee", url, prefix: "/" + segments.slice(0, 2).join("/"), tail: "/new" };
  } catch { /* This URL remains for assisted review. */ }
  return null;
}

function classify(state, detail) {
  if (state === "captcha") return { status: "needs_action", reason: "captcha" };
  if (state === "needs_login") return { status: "needs_action", reason: "authentication" };
  if (/perguntas|campo/i.test(detail || "")) return { status: "needs_action", reason: "required_answers" };
  return { status: "needs_action", reason: "unknown_form" };
}

async function browserState(page, response) {
  const captcha = page.locator('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="challenges.cloudflare.com"], [data-sitekey], input[name="cf-turnstile-response"]');
  const challengeTitle = await page.title().catch(() => "");
  if (/just a moment|checking your browser|verify.*human|captcha/i.test(challengeTitle) ||
    await captcha.count() || await page.getByText(/verify (?:that )?you are human|verifique se voc[eê] [eé] humano/i).first().isVisible().catch(() => false))
    return "captcha";
  if (response && [401, 403, 429].includes(response.status())) return "needs_login";
  return detectState(page, response).catch(() => "unknown_form");
}

async function visit(page, jobUrl, opts = {}) {
  const adapter = describe(jobUrl);
  if (!adapter) return { status: "needs_action", reason: "unsupported" };
  const { url, prefix, tail } = adapter;
  const trusted = (value) => {
    try {
      const other = new URL(value);
      return other.origin === url.origin && (other.pathname === prefix || other.pathname.startsWith(prefix + "/"));
    } catch { return false; }
  };
  await page.route("**/*", route => {
    const req = route.request();
    if (["GET", "HEAD", "OPTIONS"].includes(req.method())) return route.fallback();
    try {
      const target = new URL(req.url());
      if (target.origin === url.origin && (req.resourceType() !== "document" || trusted(target.href))) return route.fallback();
    } catch { /* Refuse credentials or data on unrelated domains. */ }
    return route.abort("blockedbyclient");
  });
  let response = await page.goto(new URL(prefix + (tail || ""), url).href, { waitUntil: "domcontentloaded", timeout: 16_000 });
  let state = await browserState(page, response);
  if (state !== "available") return classify(state);
  if (!trusted(page.url())) return classify("needs_login");
  const file = page.locator('input[type="file"]').first();
  if (!await file.count() && adapter.name === "Greenhouse") {
    const open = page.getByRole("button", { name: /^(?:apply|apply now|candidatar-se)$/i }).first();
    if (await open.isVisible() && !await open.evaluate(el => Boolean(el.form) && el.type === "submit")) {
      await open.click({ timeout: 5000 });
      await file.waitFor({ state: "attached", timeout: 4000 }).catch(() => {});
    }
  }
  state = await browserState(page);
  if (state !== "available") return classify(state);
  if (!trusted(page.url()) || !await file.count()) return classify("unknown_form");
  const submit = page.getByRole("button", { name: SUBMIT }).first();
  if (!await submit.isVisible()) return classify("unknown_form");
  if (!opts.submit) return { status: "ready", reason: "form_observed" };

  let reserved = false;
  try {
    await randomDelay(1000, 2300);
    const result = await completeLocalApplication(page, {
      profile: opts.profile, answers: opts.answers, resumePath: opts.resumePath, dryRun: false,
      trusted, detectState: browserState,
      beforeSubmit: async () => {
        if (await browserState(page) !== "available") return false;
        reserved = await opts.reserve();
        return reserved;
      },
    });
    if (result.status === "applied_confirmed" && reserved && result.screenshot)
      return { status: "confirmed", text: result.text, screenshot: result.screenshot };
    if (reserved) return { status: "unconfirmed", reason: await browserState(page) === "captcha" ? "captcha" : "provider_uncertain" };
    if (result.status === "queued") return { status: "needs_action", reason: "reservation_denied" };
    return classify(await browserState(page), result.detail);
  } catch {
    return reserved ? { status: "unconfirmed", reason: "provider_uncertain" } : classify("unknown_form");
  }
}

module.exports = { describe, visit };
