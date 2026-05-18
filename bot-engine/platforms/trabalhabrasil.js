const { randomDelay, humanType } = require("../utils/delays");
const { log } = require("../utils/logger");

/**
 * Trabalha Brasil automation
 * https://www.trabalhabrasil.com.br
 * 
 * NO LOGIN REQUIRED for many listings - direct "Candidatar" button.
 * This platform is one of Brazil's largest job boards.
 */
async function applyTrabalhaBrasil(browser, config) {
  const { cargo, cidade, curriculoPath, limiteDiario } = config;
  const results = [];
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  try {
    // Build search URL
    const searchQuery = encodeURIComponent(cargo || "marketing");
    const cityQuery = cidade ? encodeURIComponent(cidade) : "";
    const searchUrl = cidade
      ? `https://www.trabalhabrasil.com.br/vagas-empregos-em-${cityQuery}/${searchQuery}`
      : `https://www.trabalhabrasil.com.br/vagas-empregos/${searchQuery}`;

    log(`[TRABALHA_BRASIL] Buscando: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await randomDelay(3000, 5000);

    const maxTarget = limiteDiario || 100;
    let applied = 0;
    let pageNum = 1;

    while (applied < maxTarget && pageNum <= 15) {
      log(`[TRABALHA_BRASIL] Processando pagina ${pageNum}...`);

      // Find job cards - Trabalha Brasil uses various selectors
      const jobLinks = await page.$$(
        'a[href*="/vagas-empregos/"], a[href*="/vaga-"], .job-card a, .vaga-card a, .card-vaga a'
      );

      if (jobLinks.length === 0) {
        log("[TRABALHA_BRASIL] Nenhuma vaga encontrada. Fim.");
        break;
      }

      log(`[TRABALHA_BRASIL] ${jobLinks.length} vagas na pagina ${pageNum}`);

      for (const link of jobLinks) {
        if (applied >= maxTarget) break;

        const href = await link.getAttribute("href");
        if (!href || !href.includes("/vaga")) continue;

        try {
          const jobUrl = href.startsWith("http") ? href : `https://www.trabalhabrasil.com.br${href}`;
          log(`[TRABALHA_BRASIL] Acessando: ${jobUrl}`);

          const jobPage = await context.newPage();
          await jobPage.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
          await randomDelay(2000, 4000);

          // Look for "Candidatar" / "Candidatar-se" button
          const candidatarBtn = await jobPage.$(
            'button:has-text("Candidatar"), a:has-text("Candidatar"), button:has-text("Candidatar-se"), a:has-text("Candidatar-se"), button:has-text("Quero me candidatar"), .btn-candidatar, .candidatar-btn'
          );

          if (candidatarBtn) {
            await candidatarBtn.click();
            await randomDelay(2000, 4000);

            // Look for file input to upload CV
            const fileInput = await jobPage.$('input[type="file"]');
            if (fileInput) {
              await fileInput.setInputFiles(curriculoPath);
              log(`[TRABALHA_BRASIL] Curriculo anexado - vaga #${applied + 1}`);
              await randomDelay(1000, 2000);

              // Submit
              const submitBtn = await jobPage.$(
                'button[type="submit"], input[type="submit"], button:has-text("Enviar"), button:has-text("Finalizar"), button:has-text("Concluir"), button:has-text("Confirmar")'
              );
              if (submitBtn) {
                await submitBtn.click();
                applied++;
                log(`[OK] Trabalha Brasil vaga #${applied} enviada`);
                results.push({ empresa: "TrabalhaBrasil", vaga: jobUrl.split("/").pop() || `vaga-${applied}`, plataforma: "TrabalhaBrasil", status: "enviado" });
              } else {
                results.push({ empresa: "TrabalhaBrasil", vaga: jobUrl.split("/").pop() || `vaga-${applied}`, plataforma: "TrabalhaBrasil", status: "sem_submit" });
              }
            } else {
              // Some listings may have a redirect to external site or email application
              results.push({ empresa: "TrabalhaBrasil", vaga: jobUrl.split("/").pop() || `vaga-${applied}`, plataforma: "TrabalhaBrasil", status: "sem_file_input" });
            }
          } else {
            // No direct apply button - may be an external listing
            results.push({ empresa: "TrabalhaBrasil", vaga: jobUrl.split("/").pop() || `vaga-${applied}`, plataforma: "TrabalhaBrasil", status: "nao_suportado" });
          }

          await jobPage.close();
          await randomDelay(2000, 4000);
        } catch (jobErr) {
          log(`[ERRO] Trabalha Brasil vaga: ${jobErr.message}`);
          results.push({ empresa: "TrabalhaBrasil", vaga: href.split("/").pop() || "unknown", plataforma: "TrabalhaBrasil", status: "falhou" });
        }
      }

      // Next page
      if (applied < maxTarget) {
        const nextBtn = await page.$(
          'a[rel="next"], a:has-text("Proxima"), a:has-text(">"), .pagination .next, .pagination a:has-text(">")'
        );
        if (nextBtn) {
          await nextBtn.click();
          await randomDelay(3000, 5000);
          pageNum++;
        } else {
          log("[TRABALHA_BRASIL] Sem mais paginas.");
          break;
        }
      }
    }

    log(`[TRABALHA_BRASIL] Finalizado: ${applied} candidaturas enviadas`);

  } catch (err) {
    log(`[ERRO CRITICO] Trabalha Brasil: ${err.message}`);
    await page.screenshot({ path: "/tmp/trabalhabrasil-error.png" });
  } finally {
    await context.close();
  }

  return results;
}

module.exports = { applyTrabalhaBrasil };
