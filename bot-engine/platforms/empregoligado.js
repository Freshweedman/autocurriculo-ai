const { randomDelay } = require("../utils/delays");
const { log } = require("../utils/logger");

/**
 * Emprego Ligado automation
 * https://www.empregoligado.com.br
 * Sem login obrigatorio para muitas vagas.
 */
async function applyEmpregoLigado(browser, config) {
  const { cargo, cidade, curriculoPath, limiteDiario } = config;
  const results = [];
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: "pt-BR" });
  const page = await context.newPage();

  try {
    const q = encodeURIComponent(cargo || "marketing");
    const loc = cidade ? `/${encodeURIComponent(cidade.toLowerCase().replace(/\s/g, "-"))}` : "";
    const searchUrl = `https://www.empregoligado.com.br/vagas-emprego/${q}${loc}`;
    log(`[EMPREGOLIGADO] Buscando: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await randomDelay(3000, 5000);

    const maxTarget = limiteDiario || 100;
    let applied = 0;
    let pageNum = 1;

    while (applied < maxTarget && pageNum <= 15) {
      log(`[EMPREGOLIGADO] Pagina ${pageNum}...`);

      const jobLinks = await page.$$('a[href*="/vaga/"], a[href*="/emprego/"], .job-title a, h2 a, h3 a');
      const hrefs = [];
      for (const l of jobLinks) {
        const h = await l.getAttribute("href");
        if (h && !hrefs.includes(h)) hrefs.push(h);
      }

      if (hrefs.length === 0) { log("[EMPREGOLIGADO] Fim."); break; }
      log(`[EMPREGOLIGADO] ${hrefs.length} vagas`);

      for (const href of hrefs) {
        if (applied >= maxTarget) break;
        try {
          const jobUrl = href.startsWith("http") ? href : `https://www.empregoligado.com.br${href}`;
          const jobPage = await context.newPage();
          await jobPage.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
          await randomDelay(2000, 4000);

          const applyBtn = await jobPage.$(
            'button:has-text("Candidatar"), a:has-text("Candidatar"), button:has-text("Enviar curriculo"), a:has-text("Enviar curriculo")'
          );
          if (applyBtn) {
            await applyBtn.click();
            await randomDelay(2000, 4000);
            const fileInput = await jobPage.$('input[type="file"]');
            if (fileInput) {
              await fileInput.setInputFiles(curriculoPath);
              await randomDelay(1000, 2000);
              const submitBtn = await jobPage.$('button[type="submit"], button:has-text("Enviar"), button:has-text("Confirmar")');
              if (submitBtn) {
                await submitBtn.click();
                applied++;
                results.push({ empresa: "EmpregoLigado", vaga: jobUrl.split("/").pop() || `vaga-${applied}`, plataforma: "EmpregoLigado", status: "enviado" });
                log(`[OK] EmpregoLigado #${applied}`);
              } else {
                results.push({ empresa: "EmpregoLigado", vaga: jobUrl.split("/").pop(), plataforma: "EmpregoLigado", status: "sem_submit" });
              }
            } else {
              results.push({ empresa: "EmpregoLigado", vaga: jobUrl.split("/").pop(), plataforma: "EmpregoLigado", status: "sem_file_input" });
            }
          } else {
            results.push({ empresa: "EmpregoLigado", vaga: jobUrl.split("/").pop(), plataforma: "EmpregoLigado", status: "nao_suportado" });
          }
          await jobPage.close();
          await randomDelay(2000, 4000);
        } catch (e) {
          log(`[ERRO] EmpregoLigado: ${e.message}`);
          results.push({ empresa: "EmpregoLigado", vaga: "unknown", plataforma: "EmpregoLigado", status: "falhou" });
        }
      }

      if (applied < maxTarget) {
        const next = await page.$('a[rel="next"], a:has-text("Proxima"), .next-page');
        if (next) { await next.click(); await randomDelay(3000, 5000); pageNum++; }
        else { log("[EMPREGOLIGADO] Sem mais paginas."); break; }
      }
    }

    log(`[EMPREGOLIGADO] ${applied} enviadas`);
  } catch (err) {
    log(`[ERRO] EmpregoLigado: ${err.message}`);
    await page.screenshot({ path: "/tmp/empregoligado-error.png" });
  } finally {
    await context.close();
  }
  return results;
}

module.exports = { applyEmpregoLigado };
