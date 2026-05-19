const { randomDelay } = require("../utils/delays");
const { log } = require("../utils/logger");

/**
 * "Trabalhe Conosco" URL Discoverer
 * 
 * Searches Google for company career pages with file upload forms.
 * Feeds discovered URLs to the generic bot for resume submission.
 * NO LOGIN REQUIRED - finds public career pages.
 */
async function discoverCareerPages(browser, config) {
  const { cargo, cidade } = config;
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  const urls = [];
  let careerUrls = [];

  // Multiple search queries to maximize discovery
  const queries = [
    `"trabalhe conosco" "${cargo || "marketing"}" ${cidade || ""} enviar curriculo`,
    `"trabalhe conosco" ${cidade || "Brasil"} cadastrar curriculo`,
    `"vaga" "${cargo || "marketing"}" ${cidade || ""} "enviar curriculo"`,
    `"trabalhe conosco" ${cidade || ""} site:com.br`,
    `"curriculo" "${cargo || "marketing"}" ${cidade || ""} upload`,
    `"vagas" "${cargo || "marketing"}" ${cidade || ""} "cadastre seu curriculo"`,
    `${cidade || "Brasil"} "trabalhe conosco" curriculo pdf`,
  ];

  try {
    for (const query of queries) {
      log(`[DISCOVER] Buscando: "${query}"`);
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=20`;
      
      try {
        await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
        await randomDelay(2000, 4000);

        // Extract all organic result URLs
        const foundUrls = await page.evaluate(() => {
          const links = new Set();
          // Google organic result links
          const results = document.querySelectorAll("a[href^='http']");
          results.forEach((a) => {
            const href = a.getAttribute("href");
            if (href && !href.includes("google.com") && !href.includes("youtube.com") && !href.includes("linkedin.com")) {
              // Skip known non-job domains
              if (!href.includes("facebook.com") && !href.includes("instagram.com") && !href.includes("twitter.com")) {
                links.add(href);
              }
            }
          });
          return Array.from(links);
        });

        log(`[DISCOVER] Encontrados ${foundUrls.length} URLs na query`);
        for (const url of foundUrls) {
          if (!urls.includes(url)) {
            urls.push(url);
          }
        }
      } catch (queryErr) {
        log(`[DISCOVER] Erro na query: ${queryErr.message}`);
      }

      await randomDelay(3000, 5000);
    }

    log(`[DISCOVER] Total: ${urls.length} URLs unicas descobertas`);

    // Filter URLs likely to have "Trabalhe Conosco" / career pages
    careerUrls = urls.filter((url) => {
      const lower = url.toLowerCase();
      return (
        lower.includes("trabalhe-conosco") ||
        lower.includes("trabalheconosco") ||
        lower.includes("carreira") ||
        lower.includes("careers") ||
        lower.includes("vagas") ||
        lower.includes("vaga") ||
        lower.includes("curriculo") ||
        lower.includes("candidatar") ||
        lower.includes("recrutamento") ||
        lower.includes("selecao") ||
        lower.includes("jobs") ||
        lower.includes("oportunidades") ||
        lower.includes("talentos") ||
        lower.includes("contratacao") ||
        lower.includes("banco-de-talentos") ||
        lower.includes("banco-de-curriculos") ||
        lower.includes("cadastro") ||
        lower.includes("candidatura")
      );
    });

    log(`[DISCOVER] ${careerUrls.length} URLs de carreira filtradas`);

  } catch (err) {
    log(`[ERRO] Discoverer: ${err.message}`);
    await page.screenshot({ path: "/tmp/discoverer-error.png" });
  } finally {
    await context.close();
  }

  return careerUrls;
}

module.exports = { discoverCareerPages };
