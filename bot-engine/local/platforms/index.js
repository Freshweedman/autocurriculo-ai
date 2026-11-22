const { listing, detectState } = require("./listing");
const { normalize } = require("../../platforms/publicboards");
const { canonicalJobUrl } = require("../../utils/job-url");
const indeed = require("./indeed");

const slug = (name) => normalize(name).replace(/\s+/g, "-");
const publicSources = [
  listing({
    name: "Vagas.com", host: "vagas.com.br", path: /^\/vagas\/v\d+/i,
    searchUrl: (term, location) => `https://www.vagas.com.br/vagas-de-${slug(term)}${location ? "-em-" + slug(location) : ""}`,
    selectors: { link: "a.link-detalhes-vaga, a[href^='/vagas/v']", card: "li.vaga, .vaga, [data-testid=job-card]", title: ".cargo, h2", company: ".emprVaga, .empresa", location: ".vaga-local, .localidade, [class*=local]" },
  }),
  listing({
    name: "Catho", host: "catho.com.br", path: /^\/vagas\/[^/]+\/\d+\/?$/,
    searchUrl: (term) => `https://www.catho.com.br/vagas/${slug(term)}/`,
    selectors: { link: "a[href*='/vagas/']", card: "article, [data-testid=job-card], [class*=jobCard]", title: "h2, h3", company: "[class*=companyName], [class*=CompanyName], [data-testid*=company]", location: "[class*=location], [class*=Location], [data-testid*=location]" },
  }),
  listing({
    name: "InfoJobs", host: "infojobs.com.br", path: /^\/vaga-de-.+__\d+\.aspx$/i,
    searchUrl: (term, location) => {
      const portoAlegre = slug(location) === "porto-alegre";
      const place = portoAlegre ? "porto-alegre%2C-rs" : slug(location);
      return `https://www.infojobs.com.br/vagas-de-emprego-${encodeURIComponent(term.replace(/\s+/g, "+"))}${place ? "-em-" + place : ""}.aspx${portoAlegre ? "?provincia=176" : ""}`;
    },
    selectors: { link: ".js_rowCard a[href^='/vaga-de-']", card: ".js_rowCard", title: ".js_vacancyTitle", company: ".js_cardLink div.text-body > a, .js_cardLink div.text-body", location: ".js_cardLink > .mb-8", mode: ".js_cardLink div:has(> svg.icon-buildings)" },
  }),
  listing({
    name: "Gupy", host: "gupy.io", path: /^\/jobs\/\d+/,
    searchUrl: (term) => "https://portal.gupy.io/job-search/term%3D" + encodeURIComponent(term),
    ready: `a[href*=".gupy.io/job/"]`,
    selectors: {
      link: "a[href*='.gupy.io/job/'], a[href*='.gupy.io/jobs/']", card: "a", title: "h3",
      company: ".MuiCard-root p", location: '[data-testid="job-location"]', mode: '[aria-label="Job Model Icon"] + span',
    },
    transform(job) {
      try {
        const url = new URL(job.url);
        if (!url.hostname.endsWith(".gupy.io") || !url.pathname.startsWith("/job/")) return job;
        const id = JSON.parse(Buffer.from(decodeURIComponent(url.pathname.slice(5)), "base64").toString()).jobId;
        if (!Number.isSafeInteger(id) || id < 1) return job;
        return { ...job, url: url.origin + "/jobs/" + id, location: job.location + ", Brasil" };
      } catch { return job; }
    },
  }),
  listing({
    name: "Trabalha Brasil", host: "trabalhabrasil.com.br", path: /^\/vagas-empregos\/.*\/\d+\/?$/,
    searchUrl: (term) => `https://www.trabalhabrasil.com.br/vagas-empregos/${slug(term)}`,
    selectors: { link: "a[href*='/vagas-empregos/']", card: "article, .vaga, .job", title: "h2, h3", company: "[class*=company], [class*=empresa]", location: "[class*=city], [class*=location], [class*=local]" },
  }),
];

function board(name, envKey, defaults, endpoint, jobList, fields) {
  return {
    name,
    detectState: (response) => response.ok ? "available" : "unavailable",
    parseJob(raw, company) {
      const job = fields(raw, company);
      const canonical = canonicalJobUrl(job.url);
      if (!canonical || !job.title || !job.location) return null;
      return { ...job, company: job.company || company, platform: name, url: canonical };
    },
    async search() {
      const companyBoards = (process.env[envKey] || defaults).split(",").map((item) => item.trim()).filter((item) => /^[\w-]+$/.test(item));
      const jobs = [];
      const errors = [];
      for (const company of companyBoards) {
        try {
          const response = await fetch(endpoint(company), { signal: AbortSignal.timeout(12_000) });
          if (this.detectState(response) !== "available") throw Error(`HTTP ${response.status}`);
          jobs.push(...jobList(await response.json()).map((raw) => this.parseJob(raw, company)).filter(Boolean));
        } catch (error) {
          errors.push(`${company}: ${error.message}`);
        }
      }
      if (errors.length && !jobs.length) throw Error(errors.join(" · "));
      return { state: "available", jobs, warning: errors.join(" · ") };
    },
    apply: async () => ({ status: "skipped_external", detail: "Abra o formulário no portal de carreiras da empresa." }),
    once: true,
  };
}

const locationList = (...pieces) => pieces.flat().filter((value) => typeof value === "string" && value.trim()).join(", ");
const boards = [
  board("Greenhouse", "AUTOCURRICULO_GREENHOUSE", "arenaim,exadelinc,capco,bees",
    (id) => `https://boards-api.greenhouse.io/v1/boards/${id}/jobs`, (data) => data.jobs || [],
    (job) => ({ url: job.absolute_url, title: job.title, location: job.location?.name })),
  {
    name: "Lever", once: true, usesPage: true, detectState,
    async search(page) {
      const jobs = [];
      const errors = [];
      const keys = (process.env.AUTOCURRICULO_LEVER || "jobgether,weloglobal").split(",").map((id) => id.trim()).filter((id) => /^[\w-]+$/.test(id));
      for (const id of keys) {
        const source = listing({
          name: this.name, host: "jobs.lever.co", path: /^\/[^/]+\/[a-f\d-]{36}$/i,
          searchUrl: () => `https://jobs.lever.co/${id}/?location=Brazil`,
          selectors: { link: "a.posting-title", card: ".posting", title: "h5", company: "none", companyFallback: id, location: ".posting-category.location", mode: ".workplaceTypes" },
        });
        try {
          const result = await source.search(page);
          if (result.state !== "available") errors.push(`${id}: ${result.state}`);
          jobs.push(...result.jobs);
        } catch (error) { errors.push(`${id}: ${error.message.slice(0, 160)}`); }
      }
      return { state: errors.length && !jobs.length ? "unavailable" : "available", jobs, warning: errors.join(" · ") };
    },
    apply: async () => ({ status: "skipped_external", detail: "Abra o formulário no portal de carreiras da empresa." }),
  },
  board("Ashby", "AUTOCURRICULO_ASHBY", "Skydropx,puzzle-consulting-services",
    (id) => `https://api.ashbyhq.com/posting-api/job-board/${id}`, (data) => data.jobs || [],
    (job) => ({ url: job.jobUrl, title: job.title, location: locationList(job.location, job.secondaryLocations?.map((entry) => entry.location), job.address?.postalAddress?.addressCountry, job.workplaceType, job.isRemote ? "Remoto" : "") })),
];

module.exports = { sources: [indeed, ...publicSources, ...boards], indeed };
