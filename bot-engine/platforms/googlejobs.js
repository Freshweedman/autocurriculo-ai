const { randomDelay } = require("../utils/delays");
const { log } = require("../utils/logger");

/**
 * Google Jobs scraper v1
 *
 * Acessa google.com/search?q=...&ibp=htl;jobs para o painel "Vagas"
 * Não tem candidatura direta — redireciona para o site da empresa.
 * Retorna URLs das vagas para o bot genérico processar.
 */
async function scrapeGoogleJobs(browser, config) {
  const { cargo, cidade, limiteDiario = 30 } = config;
  const results = [];
  const seenUrls = new Set();

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    locale: "pt-BR",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const termos = [
    cargo,
    `${cargo} remoto`,
    cidade ? `${cargo} ${cidade}` : null,
  ].filter(Boolean);

  try {
    for (const termo of termos) {
      if (results.length >= limiteDiario) break;

      const query = `${termo} vagas emprego`;
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&ibp=htl;jobs&hl=pt-BR`;
      log(`[GOOGLE JOBS] Buscando: "${query}"`);

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
      await randomDelay(3000, 5000);

      // Clica no primeiro card para expandir o painel de vagas se necessário
      const firstCard = await page.$('[jsname="MQnxld"], [jscontroller*="jobs"], .iFjolb, [data-share-url*="jobs"]');
      if (firstCard) {
        await firstCard.click().catch(() => {});
        await randomDelay(1500, 2500);
      }

      // Scrolla o painel para carregar mais vagas
      for (let s = 0; s < 4; s++) {
        await page.evaluate(() => {
          const panel = document.querySelector('[jsname="UWckNb"], .gws-plugins-horizon-jobs__tl-lvc, [role="list"]');
          if (panel) panel.scrollTop += 600;
          else window.scrollBy(0, 600);
        });
        await randomDelay(1000, 2000);
      }

      const jobsData = await page.evaluate(() => {
        const jobs = [];

        // Tenta os seletores conhecidos do painel Google Jobs
        const selectors = [
          '[jsname="MQnxld"]',
          ".iFjolb",
          "[data-share-url]",
          '.gws-plugins-horizon-jobs__job-card-lcl',
          '.tNxQIb',
          'li[class*="job"]',
        ];

        let cards = [];
        for (const sel of selectors) {
          cards = Array.from(document.querySelectorAll(sel));
          if (cards.length > 0) break;
        }

        cards.forEach((card) => {
          const titulo =
            card.querySelector(".BjJfJf, .sH3zFd, [class*='title'], h3")
              ?.textContent?.trim() || "";
          const empresa =
            card.querySelector(".vNEEBe, [class*='company'], [class*='employer']")
              ?.textContent?.trim() || "";
          const local =
            card.querySelector(".Qk80Jf, [class*='location']")
              ?.textContent?.trim() || "";
          const link =
            card.querySelector("a[href]")?.getAttribute("href") ||
            card.getAttribute("data-share-url") ||
            "";

          if (titulo && (empresa || link)) {
            jobs.push({ titulo, empresa, local, link });
          }
        });

        return jobs;
      });

      log(`[GOOGLE JOBS] ${jobsData.length} vagas encontradas para "${termo}"`);

      for (const job of jobsData) {
        if (results.length >= limiteDiario) break;

        // Normaliza a URL — pode ser relativa
        let vagaUrl = job.link || "";
        if (vagaUrl && !vagaUrl.startsWith("http")) {
          vagaUrl = "https://www.google.com" + vagaUrl;
        }

        if (!vagaUrl || seenUrls.has(vagaUrl)) continue;
        seenUrls.add(vagaUrl);

        results.push({
          empresa: job.empresa || "Google Jobs",
          vaga: job.titulo || vagaUrl,
          vaga_url: vagaUrl,
          local: job.local,
          plataforma: "GoogleJobs",
          status: "coletado", // não aplica direto — precisa de site externo
        });
      }

      await randomDelay(4000, 7000);
    }
  } catch (err) {
    log(`[ERRO] Google Jobs: ${err.message}`);
    await page.screenshot({ path: "/tmp/googlejobs-error.png" }).catch(() => {});
  } finally {
    await context.close();
  }

  log(`[GOOGLE JOBS] Total: ${results.length} vagas coletadas`);
  return results;
}

module.exports = { scrapeGoogleJobs };
