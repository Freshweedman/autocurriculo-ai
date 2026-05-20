const { randomDelay } = require("./utils/delays");
const { log } = require("./utils/logger");

/**
 * Google Business + Leads Scraper v3
 *
 * Foco: empresas que CONTRATAM gestor de trafego/marketing
 * Nao coleta: freelancers oferecendo servico, plataformas de emprego
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

  const cargoBase = cargo || "marketing digital";
  const loc = cidade || "Brasil";

  // ── Queries focadas em EMPRESAS QUE CONTRATAM ─────────────────────────────
  const searchQueries = [
    // Agencias de marketing que contratam
    `agencia marketing digital ${loc} "fale conosco" contato`,
    `agencia trafego pago ${loc} site:com.br contato`,
    `empresa marketing digital ${loc} equipe contato email`,
    `agencia google ads facebook ads ${loc} contato`,

    // E-commerces e empresas que precisam de gestor
    `ecommerce ${loc} marketing digital contato`,
    `loja online ${loc} "gestor de trafego" contato`,
    `startup ${loc} marketing performance contato`,
    `empresa e-commerce ${loc} "marketing digital" email`,

    // Empresas com vagas abertas
    `empresa ${loc} "vaga" "${cargoBase}" contato`,
    `"contratamos" "${cargoBase}" ${loc}`,
    `"procuramos" "gestor de trafego" OR "marketing digital" ${loc}`,

    // Agencias especificas
    `agencia performance ${loc} contato telefone`,
    `agencia social media ${loc} contato`,
    `consultoria marketing digital ${loc} email`,
  ];

  // Dominios a ignorar (plataformas de emprego, freelancers oferecendo servico)
  const dominiosIgnorar = [
    "linkedin.com", "indeed.com", "catho.com", "infojobs.com",
    "vagas.com", "trabalhabrasil.com", "sine.com", "empregoligado.com",
    "workana.com", "99freelas.com", "getninjas.com", "freelancer.com",
    "upwork.com", "fiverr.com", "trampos.co", "glassdoor.com",
    "gupy.io", "kenoby.com", "abler.com.br",
    "youtube.com", "facebook.com", "instagram.com", "twitter.com",
    "reddit.com", "quora.com", "medium.com", "wikipedia.org",
  ];

  function deveIgnorar(url) {
    return dominiosIgnorar.some(d => url.includes(d));
  }

  try {
    log(`[GOOGLE] Buscando empresas que contratam (${searchQueries.length} queries)...`);

    for (const query of searchQueries) {
      try {
        log(`[GOOGLE] Query: "${query}"`);
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=pt-BR&num=10`;
        await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
        await randomDelay(2000, 4000);

        const results = await page.evaluate(() => {
          const items = [];
          const blocks = document.querySelectorAll("div.g, div[data-hveid], div.MjjYud > div");
          blocks.forEach((block) => {
            const titleEl = block.querySelector("h3");
            const linkEl  = block.querySelector("a[href^='http']");
            const snippet = block.querySelector("div.VwiC3b, span.aCOpRe, div[data-sncf]")?.textContent || "";
            if (!titleEl || !linkEl) return;
            const title = titleEl.textContent || "";
            const link  = linkEl.getAttribute("href") || "";
            if (!link.startsWith("http") || link.includes("google.com")) return;

            const phoneMatch = snippet.match(/(\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4})/);
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
          if (deveIgnorar(r.site)) continue;
          // Ignora resultados que parecem freelancers oferecendo servico
          const snippetLower = r.snippet.toLowerCase();
          if (snippetLower.includes("ofereço") || snippetLower.includes("oferecer") ||
              snippetLower.includes("meu servico") || snippetLower.includes("meu trabalho")) continue;

          seenEmpresas.add(r.empresa);
          leads.push({ ...r, fonte: "google_search", tipo: "empresa_contratante" });
        }

        log(`[GOOGLE] +${results.length} resultados filtrados (total: ${leads.length})`);
        await randomDelay(3000, 5000);

        if (searchQueries.indexOf(query) % 4 === 3) {
          log("[GOOGLE] Pausa anti-captcha...");
          await randomDelay(8000, 12000);
        }
      } catch (queryErr) {
        log(`[GOOGLE] Erro: ${queryErr.message}`);
      }
    }

    // ── Google Maps — agencias locais ────────────────────────────────────────
    if (cidade) {
      log(`[GOOGLE MAPS] Buscando agencias em ${cidade}...`);
      const mapsQueries = [
        `agencia marketing digital ${cidade}`,
        `agencia trafego pago ${cidade}`,
        `agencia publicidade ${cidade}`,
        `empresa marketing ${cidade}`,
        `consultoria marketing digital ${cidade}`,
      ];

      for (const mq of mapsQueries) {
        try {
          await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(mq)}`, {
            waitUntil: "domcontentloaded", timeout: 25000,
          });
          await randomDelay(4000, 6000);

          for (let s = 0; s < 3; s++) {
            await page.evaluate(() => {
              const panel = document.querySelector('[role="feed"]');
              if (panel) panel.scrollTop += 800;
            });
            await randomDelay(1500, 2500);
          }

          const mapResults = await page.evaluate(() => {
            const items = [];
            const cards = document.querySelectorAll('[data-result-index], .Nv2PK');
            cards.forEach((card) => {
              const name  = card.querySelector('.qBF1Pd, .fontHeadlineSmall, h3')?.textContent || "";
              const phone = card.querySelector('[data-tooltip*="Ligar"], [aria-label*="Telefone"], .UsdlK')?.textContent || "";
              const addr  = card.querySelector('.W4Efsd, .fontBodyMedium')?.textContent || "";
              const site  = card.querySelector('a[data-value="Website"]')?.getAttribute("href") || "";
              if (name && name.length > 2) {
                items.push({
                  empresa: name.trim().slice(0, 80),
                  telefone: phone.replace(/[^\d\s\(\)\-\+]/g, "").trim().slice(0, 20),
                  cidade: addr.trim().slice(0, 60),
                  site: site || "",
                  email: "",
                });
              }
            });
            return items;
          });

          for (const r of mapResults) {
            if (!r.empresa || seenEmpresas.has(r.empresa)) continue;
            seenEmpresas.add(r.empresa);
            leads.push({ ...r, fonte: "google_maps", tipo: "agencia" });
          }

          log(`[GOOGLE MAPS] +${mapResults.length} agencias (total: ${leads.length})`);
          await randomDelay(5000, 8000);
        } catch (e) {
          log(`[GOOGLE MAPS] Erro: ${e.message}`);
        }
      }
    }

    log(`[GOOGLE] Total: ${leads.length} empresas/agencias coletadas`);

  } catch (err) {
    log(`[ERRO] Google scraper: ${err.message}`);
    await page.screenshot({ path: "/tmp/google-error.png" });
  } finally {
    await context.close();
  }

  return leads;
}

module.exports = { scrapeGoogleLeads };
