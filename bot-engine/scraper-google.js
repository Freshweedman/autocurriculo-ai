const { randomDelay } = require("./utils/delays");
const { log } = require("./utils/logger");

/**
 * Google Business + Leads Scraper v2
 *
 * Busca empresas e contatos via:
 *  1. Google Search organico (snippets com telefone/email)
 *  2. Google Maps (empresas locais com telefone direto)
 *  3. Queries especificas para freelancer (agencias que contratam PJ/freelancer)
 */
async function scrapeGoogleLeads(browser, config) {
  const { cargo, cidade } = config;
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    locale: "pt-BR",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  const leads = [];
  const seenEmpresas = new Set();

  // ── Queries Google Search ──────────────────────────────────────────────────
  const cargoBase = cargo || "marketing digital";
  const loc = cidade || "Brasil";

  const searchQueries = [
    // Empresas CLT
    `empresa ${cargoBase} ${loc} contato telefone`,
    `agencia ${cargoBase} ${loc} site:com.br`,
    `empresa contratando ${cargoBase} ${loc}`,
    `"gestor de trafego" OR "marketing digital" empresa ${loc} contato`,

    // Freelancer / PJ
    `empresa contratando freelancer ${cargoBase} ${loc}`,
    `agencia marketing digital ${loc} freelancer PJ`,
    `"trabalho remoto" ${cargoBase} ${loc} contato`,
    `startup ${cargoBase} ${loc} contratando`,
    `"prestador de servico" ${cargoBase} ${loc}`,

    // Contatos diretos
    `${cargoBase} ${loc} "fale conosco" email`,
    `agencia publicidade ${loc} contato email telefone`,
    `empresa e-commerce ${loc} marketing contato`,
  ];

  try {
    // ── 1. Google Search organico ────────────────────────────────────────────
    log(`[GOOGLE] Iniciando scraping de leads (${searchQueries.length} queries)...`);

    for (const query of searchQueries) {
      try {
        log(`[GOOGLE] Query: "${query}"`);
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=pt-BR&num=20`;
        await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
        await randomDelay(2000, 4000);

        const results = await page.evaluate(() => {
          const items = [];
          // Blocos de resultado organico
          const blocks = document.querySelectorAll("div.g, div[data-hveid], div.MjjYud > div");
          blocks.forEach((block) => {
            const titleEl = block.querySelector("h3");
            const linkEl  = block.querySelector("a[href^='http']");
            const snippet = block.querySelector("div.VwiC3b, span.aCOpRe, div[data-sncf]")?.textContent || "";

            if (!titleEl || !linkEl) return;
            const title = titleEl.textContent || "";
            const link  = linkEl.getAttribute("href") || "";
            if (!link.startsWith("http") || link.includes("google.com")) return;

            // Telefone brasileiro: (11) 99999-9999 ou 11 9999-9999
            const phoneMatch = snippet.match(/(\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4})/);
            // Email
            const emailMatch = snippet.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);

            items.push({
              empresa: title.split(" - ")[0].split(" | ")[0].trim().slice(0, 80),
              site: link,
              telefone: phoneMatch ? phoneMatch[1].trim() : "",
              email: emailMatch ? emailMatch[1].trim() : "",
              snippet: snippet.slice(0, 200),
            });
          });
          return items;
        });

        for (const r of results) {
          if (!r.empresa || seenEmpresas.has(r.empresa)) continue;
          seenEmpresas.add(r.empresa);
          leads.push({ ...r, fonte: "google_search" });
        }

        log(`[GOOGLE] +${results.length} leads (total: ${leads.length})`);
        await randomDelay(3000, 6000);

        // Anti-captcha: pausa maior a cada 4 queries
        if (searchQueries.indexOf(query) % 4 === 3) {
          log("[GOOGLE] Pausa anti-captcha...");
          await randomDelay(8000, 15000);
        }
      } catch (queryErr) {
        log(`[GOOGLE] Erro na query: ${queryErr.message}`);
      }
    }

    // ── 2. Google Maps (empresas locais com telefone) ────────────────────────
    if (cidade) {
      log(`[GOOGLE MAPS] Buscando empresas locais em ${cidade}...`);
      const mapsQueries = [
        `agencia marketing digital ${cidade}`,
        `empresa publicidade ${cidade}`,
        `agencia social media ${cidade}`,
      ];

      for (const mq of mapsQueries) {
        try {
          const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(mq)}`;
          await page.goto(mapsUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
          await randomDelay(4000, 7000);

          // Scroll para carregar mais resultados
          for (let s = 0; s < 3; s++) {
            await page.evaluate(() => {
              const panel = document.querySelector('[role="feed"]');
              if (panel) panel.scrollTop += 800;
            });
            await randomDelay(2000, 3000);
          }

          const mapResults = await page.evaluate(() => {
            const items = [];
            // Cards do Maps
            const cards = document.querySelectorAll('[data-result-index], .Nv2PK, a[href*="/maps/place/"]');
            cards.forEach((card) => {
              const name  = card.querySelector('.qBF1Pd, .fontHeadlineSmall, h3')?.textContent || "";
              const phone = card.querySelector('[data-tooltip*="Ligar"], [aria-label*="Telefone"]')?.textContent ||
                            card.querySelector('.UsdlK')?.textContent || "";
              const addr  = card.querySelector('.W4Efsd, .fontBodyMedium')?.textContent || "";

              if (name && name.length > 2) {
                items.push({
                  empresa: name.trim().slice(0, 80),
                  telefone: phone.replace(/\D/g, "").length >= 8 ? phone.trim() : "",
                  cidade: addr.trim().slice(0, 60),
                  site: "",
                  email: "",
                });
              }
            });
            return items;
          });

          for (const r of mapResults) {
            if (!r.empresa || seenEmpresas.has(r.empresa)) continue;
            seenEmpresas.add(r.empresa);
            leads.push({ ...r, fonte: "google_maps" });
          }

          log(`[GOOGLE MAPS] +${mapResults.length} leads do Maps (total: ${leads.length})`);
          await randomDelay(5000, 9000);
        } catch (mapsErr) {
          log(`[GOOGLE MAPS] Erro: ${mapsErr.message}`);
        }
      }
    }

    // ── 3. Busca especifica de freelancer ────────────────────────────────────
    log("[GOOGLE] Buscando contatos para freelancer...");
    const freelancerQueries = [
      `"contratamos freelancer" ${cargoBase} ${loc} email`,
      `"trabalho remoto" ${cargoBase} ${loc} "envie seu curriculo"`,
      `agencia marketing ${loc} "banco de talentos" email`,
      `empresa ${cargoBase} ${loc} "vagas para freelancer"`,
    ];

    for (const fq of freelancerQueries) {
      try {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(fq)}&hl=pt-BR&num=10`;
        await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
        await randomDelay(2000, 4000);

        const results = await page.evaluate(() => {
          const items = [];
          const blocks = document.querySelectorAll("div.g, div[data-hveid]");
          blocks.forEach((block) => {
            const titleEl = block.querySelector("h3");
            const linkEl  = block.querySelector("a[href^='http']");
            const snippet = block.querySelector("div.VwiC3b, span.aCOpRe")?.textContent || "";
            if (!titleEl || !linkEl) return;
            const link = linkEl.getAttribute("href") || "";
            if (!link.startsWith("http") || link.includes("google.com")) return;
            const emailMatch = snippet.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
            const phoneMatch = snippet.match(/(\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4})/);
            items.push({
              empresa: (titleEl.textContent || "").split(" - ")[0].trim().slice(0, 80),
              site: link,
              email: emailMatch ? emailMatch[1] : "",
              telefone: phoneMatch ? phoneMatch[1] : "",
              snippet: snippet.slice(0, 200),
            });
          });
          return items;
        });

        for (const r of results) {
          if (!r.empresa || seenEmpresas.has(r.empresa)) continue;
          seenEmpresas.add(r.empresa);
          leads.push({ ...r, fonte: "google_freelancer" });
        }

        log(`[GOOGLE FREELANCER] +${results.length} leads (total: ${leads.length})`);
        await randomDelay(4000, 7000);
      } catch (fqErr) {
        log(`[GOOGLE FREELANCER] Erro: ${fqErr.message}`);
      }
    }

    log(`[GOOGLE] Scraping finalizado. Total: ${leads.length} leads unicos`);

  } catch (err) {
    log(`[ERRO] Google scraper: ${err.message}`);
    await page.screenshot({ path: "/tmp/google-error.png" });
  } finally {
    await context.close();
  }

  return leads;
}

module.exports = { scrapeGoogleLeads };
