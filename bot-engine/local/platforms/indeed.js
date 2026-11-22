const { listing, detectState } = require("./listing");
const { completeLocalApplication } = require("../../forms/local-application");

const ENDPOINT = "https://br.indeed.com";
const indeed = listing({
  name: "Indeed", host: "indeed.com", path: /^\/viewjob$/,
  searchUrl: (q, l) => ENDPOINT + "/jobs?" + new URLSearchParams({ q, l }),
  selectors: {
    indeed: true, link: "a[data-jk]", card: ".job_seen_beacon, .jobsearch-ResultsList > li",
    title: ".jobTitle, h2", company: '[data-testid="company-name"], .companyName',
    location: '[data-testid="text-location"], .companyLocation',
  },
});

indeed.loginUrl = ENDPOINT + "/account/login";
indeed.loggedIn = async function loggedIn(page) {
  const response = await page.goto(ENDPOINT, { waitUntil: "domcontentloaded", timeout: 20_000 });
  return await detectState(page, response) === "available" && await page
    .locator('.gnav-header-user, [data-testid="header-desktopNavelement-user"], button[aria-label*="Perfil"], button[aria-label*="account" i]').first().isVisible();
};

const trusted = (url) => {
  const candidate = new URL(url);
  return candidate.protocol === "https:" && ["smartapply.indeed.com", "apply.indeed.com", "br.indeed.com", "www.indeed.com"].includes(candidate.hostname);
};

indeed.apply = async function apply(page, job, options) {
  if (!options.dryRun && process.env.AUTOCURRICULO_INDEED_ENVIO_AUTORIZADO !== "1") {
    return { status: "needs_review", detail: "Envio pelo runner depende de autorização do Indeed. Abra a vaga para se candidatar." };
  }
  const response = await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 20_000 });
  if (!trusted(page.url())) return { status: "skipped_external", detail: "A vaga direcionou para outro site." };
  if (await detectState(page, response) !== "available") {
    await options.capture?.(page, "01-login-ou-verificacao");
    return { status: "needs_login", detail: "Abra o perfil local do Indeed e conclua o login ou a verificação." };
  }
  await options.capture?.(page, "01-vaga");
  const hosted = page.locator('a[href^="https://smartapply.indeed.com/"], a[href^="https://apply.indeed.com/"]').first();
  const simple = await hosted.isVisible() ? hosted : page.getByRole("button", { name: /^(?:candidatura simplificada|candidate-se facilmente|easy apply|apply now|candidatar-se agora)$/i }).first();
  if (!await simple.isVisible()) return { status: "skipped_external", detail: "A vaga não oferece um botão de candidatura simplificada reconhecido." };
  const popupPromise = page.waitForEvent("popup", { timeout: 4_000 }).catch(() => null);
  await simple.click({ timeout: 5_000 });
  const popup = await popupPromise;
  const form = popup || page;
  try {
    await form.waitForLoadState("domcontentloaded", { timeout: 10_000 });
    if (["secure.indeed.com", "secure.indeed.net"].includes(new URL(form.url()).hostname)) {
      await options.capture?.(form, "02-login");
      return { status: "needs_login", detail: "A candidatura abriu a tela de login do Indeed." };
    }
    return await completeLocalApplication(form, { ...options, trusted, detectState });
  } finally {
    await popup?.close();
  }
};

module.exports = indeed;
