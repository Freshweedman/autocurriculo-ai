const { randomDelay } = require("../utils/delays");
const { log } = require("../utils/logger");

/**
 * Generic bot for platforms like InfoJobs, Abler, Kenoby, "Trabalhe Conosco" pages.
 * Strategy: search URLs from a list, detect file inputs, auto-attach resume.
 */
async function applyGeneric(browser, config) {
  const { curriculoPath, plataforma, urls } = config;
  const results = [];

  for (const url of urls) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();

    try {
      log(`[${plataforma}] Acessando: ${url}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await randomDelay(2000, 4000);

      // Detect file inputs
      const fileInputs = await page.$$('input[type="file"]');
      if (fileInputs.length > 0) {
        for (const input of fileInputs) {
          try {
            await input.setInputFiles(curriculoPath);
            log(`[${plataforma}] Curriculo anexado em: ${url}`);
            await randomDelay(1000, 2000);

            // Try to submit after upload
            const submitBtn = await page.$(
              'button[type="submit"], input[type="submit"], button:has-text("Enviar"), button:has-text("Candidatar"), button:has-text("Apply")'
            );
            if (submitBtn) {
              await submitBtn.click();
              await randomDelay(2000, 3000);
            }
          } catch (inputErr) {
            log(`[${plataforma}] Erro upload: ${inputErr.message}`);
          }
        }
        results.push({ empresa: plataforma, vaga: url.split("/").pop(), plataforma, status: "enviado" });
      } else {
        log(`[${plataforma}] Nenhum input[type=file] encontrado em: ${url}`);
        results.push({ empresa: plataforma, vaga: url.split("/").pop(), plataforma, status: "sem_file_input" });
      }

    } catch (err) {
      log(`[ERRO] ${plataforma} ${url}: ${err.message}`);
      results.push({ empresa: plataforma, vaga: url.split("/").pop(), plataforma, status: "falhou" });
    } finally {
      await context.close();
    }
  }

  return results;
}

module.exports = { applyGeneric };
