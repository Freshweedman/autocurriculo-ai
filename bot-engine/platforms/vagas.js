const { randomDelay, humanType } = require("../utils/delays");
const { log } = require("../utils/logger");

/**
 * Vagas.com Brasil automation
 * https://www.vagas.com.br
 * 
 * Many listings allow "candidatura rapida" without full registration.
 * Just upload your resume and fill basic info.
 */
async function applyVagas(browser, config) {
  const { cargo, cidade, curriculoPath, limiteDiario } = config;
  const results = [];
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  try {
    // Build search URL
    const searchQuery = encodeURIComponent(cargo || "marketing");
    const cityQuery = cidade ? `&onde=${encodeURIComponent(cidade)}` : "";
    const searchUrl = `https://www.vagas.com.br/vagas-de-${searchQuery}${cityQuery}`;

    log(`[VAGAS] Buscando: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await randomDelay(3000, 5000);

    const maxTarget = limiteDiario || 100;
    let applied = 0;
    let pageNum = 1;

    while (applied < maxTarget && pageNum <= 15) {
      log(`[VAGAS] Processando pagina ${pageNum}...`);

      // Find job listing links
      const jobLinks = await page.$$(
        'a[href*="/vagas/"], a[href*="/vaga-"], .cargo a, .vaga a, .informacoes-vaga a'
      );

      if (jobLinks.length === 0) {
        log("[VAGAS] Nenhuma vaga encontrada.");
        break;
      }

      log(`[VAGAS] ${jobLinks.length} vagas na pagina ${pageNum}`);

      for (const link of jobLinks) {
        if (applied >= maxTarget) break;

        const href = await link.getAttribute("href");
        if (!href || (!href.includes("/vaga") && !href.includes("/vagas/"))) continue;

        try {
          const jobUrl = href.startsWith("http") ? href : `https://www.vagas.com.br${href}`;
          log(`[VAGAS] Acessando: ${jobUrl}`);

          const jobPage = await context.newPage();
          await jobPage.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
          await randomDelay(2000, 4000);

          // Look for apply button
          const applyBtn = await jobPage.$(
            'button:has-text("Candidatar"), a:has-text("Candidatar"), button:has-text("Candidatar-se"), a:has-text("Candidatar-se"), button:has-text("Quero esta vaga"), .btn-candidatar-se, button:has-text("Candidate-se")'
          );

          if (applyBtn) {
            await applyBtn.click();
            await randomDelay(2000, 4000);

            // Upload resume
            const fileInput = await jobPage.$('input[type="file"]');
            if (fileInput) {
              await fileInput.setInputFiles(curriculoPath);
              log(`[VAGAS] Curriculo anexado - vaga #${applied + 1}`);
              await randomDelay(1000, 2000);

              // Submit
              const submitBtn = await jobPage.$(
                'button[type="submit"], input[type="submit"], button:has-text("Enviar"), button:has-text("Finalizar"), button:has-text("Concluir"), button:has-text("Confirmar candidatura")'
              );
              if (submitBtn) {
                await submitBtn.click();
                applied++;
                log(`[OK] Vagas.com vaga #${applied} enviada`);
                results.push({ empresa: "Vagas.com", vaga: jobUrl.split("/").pop() || `vaga-${applied}`, plataforma: "Vagas", status: "enviado" });
              } else {
                results.push({ empresa: "Vagas.com", vaga: jobUrl.split("/").pop() || `vaga-${applied}`, plataforma: "Vagas", status: "sem_submit" });
              }
            } else {
              results.push({ empresa: "Vagas.com", vaga: jobUrl.split("/").pop() || `vaga-${applied}`, plataforma: "Vagas", status: "sem_file_input" });
            }
          } else {
            results.push({ empresa: "Vagas.com", vaga: jobUrl.split("/").pop() || `vaga-${applied}`, plataforma: "Vagas", status: "nao_suportado" });
          }

          await jobPage.close();
          await randomDelay(2000, 4000);
        } catch (jobErr) {
          log(`[ERRO] Vagas.com vaga: ${jobErr.message}`);
          results.push({ empresa: "Vagas.com", vaga: href.split("/").pop() || "unknown", plataforma: "Vagas", status: "falhou" });
        }
      }

      // Next page
      if (applied < maxTarget) {
        const nextBtn = await jobPage.$(
          'a[rel="next"], a:has-text("Proxima"), a:has-text(">"), .pagination .next, .pagination a:has-text(">"), .proxima'
        );
        if (nextBtn) {
          await nextBtn.click();
          await randomDelay(3000, 5000);
          pageNum++;
        } else {
          log("[VAGAS] Sem mais paginas.");
          break;
        }
      }
    }

    log(`[VAGAS] Finalizado: ${applied} candidaturas enviadas`);

  } catch (err) {
    log(`[ERRO CRITICO] Vagas.com: ${err.message}`);
    await page.screenshot({ path: "/tmp/vagas-error.png" });
  } finally {
    await context.close();
  }

  return results;
}

module.exports = { applyVagas };
