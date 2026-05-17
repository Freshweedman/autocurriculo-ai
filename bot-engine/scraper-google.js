const { randomDelay } = require("../utils/delays");
const { log } = require("../utils/logger");

/**
 * Google business scraper - searches for companies and extracts phone/email/site.
 * Uses Google search results (no heavy captcha).
 */
async function scrapeGoogleLeads(browser, config) {
  const { cargo, cidade } = config;
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  const leads = [];

  const queries = [
    `empresa marketing digital ${cidade || ""}`,
    `agencia trafego pago ${cidade || ""}`,
    `empresa ${cargo || "marketing"} ${cidade || ""}`,
  ];

  try {
    for (const query of queries) {
      log(`[GOOGLE] Buscando: "${query}"`);
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
      await randomDelay(2000, 4000);

      // Extract results from Google organic listings
      const results = await page.evaluate(() => {
        const items = [];
        // Google organic result containers
        const blocks = document.querySelectorAll("div.g, div[data-hveid]");
        blocks.forEach((block) => {
          const title = block.querySelector("h3")?.textContent || "";
          const link = block.querySelector("a[href^='http']")?.getAttribute("href") || "";
          const snippet = block.querySelector("div.VwiC3b, span.aCOpRe")?.textContent || "";

          // Extract phone from snippet (Brazilian format)
          const phoneMatch = snippet.match(
            /(\(?\d{2}\)?\s?\d{4,5}-?\d{4})/
          );

          // Extract email from snippet
          const emailMatch = snippet.match(
            /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
          );

          if (title && link && link.startsWith("http")) {
            items.push({
              empresa: title.split(" - ")[0].split(" | ")[0].trim(),
              site: link,
              telefone: phoneMatch ? phoneMatch[1] : "",
              email: emailMatch ? emailMatch[1] : "",
            });
          }
        });
        return items;
      });

      // Deduplicate and add
      for (const r of results) {
        if (!leads.find((l) => l.empresa === r.empresa || l.site === r.site)) {
          leads.push(r);
        }
      }

      log(`[GOOGLE] Extraidos ${results.length} leads da query "${query}"`);
      await randomDelay(3000, 5000);
    }

    log(`[GOOGLE] Total: ${leads.length} leads unicos`);
  } catch (err) {
    log(`[ERRO] Google scraper: ${err.message}`);
    await page.screenshot({ path: "/tmp/google-error.png" });
  } finally {
    await context.close();
  }

  return leads;
}

module.exports = { scrapeGoogleLeads };
