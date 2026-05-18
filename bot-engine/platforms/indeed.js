const { randomDelay, humanType } = require("../utils/delays");
const { log } = require("../utils/logger");

async function applyIndeed(browser, config) {
  const { email, senha, cargo, cidade, curriculoPath, limiteDiario } = config;
  const results = [];
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  try {
    log("[INDEED] Acessando br.indeed.com...");
    await page.goto("https://br.indeed.com", { waitUntil: "domcontentloaded" });
    await randomDelay(2000, 4000);

    // Login
    log("[INDEED] Fazendo login...");
    await page.click('a[data-gnav-element-name="SignIn"]');
    await page.waitForSelector('input[name="__email"]', { timeout: 10000 });
    await humanType(page, 'input[name="__email"]', email);
    await humanType(page, 'input[name="__password"]', senha);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/indeed.com/**", { timeout: 15000 }).catch(() => {});
    await randomDelay(3000, 5000);

    log("[INDEED] Login OK");

    // Search
    await page.waitForSelector('input[name="q"]', { timeout: 10000 });
    await page.fill('input[name="q"]', "");
    await humanType(page, 'input[name="q"]', cargo || "gestor de trafego");

    if (cidade) {
      await page.fill('input[name="l"]', "");
      await humanType(page, 'input[name="l"]', cidade);
    }

    await page.keyboard.press("Enter");
    await page.waitForURL("**/jobs**", { timeout: 15000 }).catch(() => {});
    await randomDelay(3000, 5000);

    log("[INDEED] Resultados carregados");

    // Multi-page loop to hit the daily limit
    const maxTarget = limiteDiario || 100;
    let applied = 0;
    let pageNum = 1;

    while (applied < maxTarget && pageNum <= 20) {
      log(`[INDEED] Processando pagina ${pageNum}...`);

      // Find job cards on current page
      const jobCards = await page.$$('[data-jk]');
      log(`[INDEED] ${jobCards.length} cards na pagina ${pageNum}`);

      if (jobCards.length === 0) {
        log("[INDEED] Nenhum card encontrado. Fim dos resultados.");
        break;
      }

      for (let i = 0; i < jobCards.length && applied < maxTarget; i++) {
        try {
          // Re-query cards each time since DOM may change after clicks
          const currentCards = await page.$$('[data-jk]');
          if (i >= currentCards.length) break;
          const card = currentCards[i];

          await card.click();
          await randomDelay(2000, 4000);

          // Look for "Candidatura simplificada" / "Easy Apply" button
          const easyApplyBtn = await page.$(
            'button:has-text("Candidatura simplificada"), span:has-text("Candidatura simplificada"), button:has-text("Aplicar facil"), button:has-text("Easy Apply")'
          );

          if (easyApplyBtn) {
            await easyApplyBtn.click();
            await randomDelay(2000, 4000);

            // Upload resume
            const fileInput = await page.$('input[type="file"]');
            if (fileInput) {
              await fileInput.setInputFiles(curriculoPath);
              log(`[INDEED] Curriculo anexado - vaga #${applied + 1}`);
              await randomDelay(1000, 2000);

              // Submit application
              const submitBtn = await page.$(
                'button:has-text("Enviar"), button:has-text("Concluir"), button:has-text("Finalizar"), button:has-text("Submit"), button:has-text("Apply")'
              );
              if (submitBtn) {
                await submitBtn.click();
                applied++;
                log(`[OK] Indeed vaga #${applied} enviada`);
                results.push({ empresa: "Indeed", vaga: `vaga-p${pageNum}-${i}`, plataforma: "Indeed", status: "enviado" });
              } else {
                // Try closing the easy apply modal and continuing
                const closeBtn = await page.$('button[aria-label="Fechar"], button[aria-label="Close"]');
                if (closeBtn) await closeBtn.click();
                results.push({ empresa: "Indeed", vaga: `vaga-p${pageNum}-${i}`, plataforma: "Indeed", status: "nao_suportado" });
              }
            } else {
              results.push({ empresa: "Indeed", vaga: `vaga-p${pageNum}-${i}`, plataforma: "Indeed", status: "sem_file_input" });
            }
          } else {
            results.push({ empresa: "Indeed", vaga: `vaga-p${pageNum}-${i}`, plataforma: "Indeed", status: "nao_suportado" });
          }

          await randomDelay(2000, 4000);
        } catch (cardErr) {
          log(`[ERRO] Indeed vaga ${i + 1} (pag ${pageNum}): ${cardErr.message}`);
          results.push({ empresa: "Indeed", vaga: `vaga-p${pageNum}-${i}`, plataforma: "Indeed", status: "falhou" });
        }
      }

      // Try to go to next page
      if (applied < maxTarget) {
        const nextBtn = await page.$('a[data-testid="pagination-page-next"], a[aria-label="Proxima"], a[aria-label="Next"]');
        if (nextBtn) {
          await nextBtn.click();
          await page.waitForURL("**/jobs**", { timeout: 10000 }).catch(() => {});
          await randomDelay(3000, 5000);
          pageNum++;
        } else {
          log("[INDEED] Nao ha mais paginas.");
          break;
        }
      }
    }

    log(`[INDEED] Finalizado: ${applied} candidaturas enviadas de ${maxTarget} desejadas`);

  } catch (err) {
    log(`[ERRO CRITICO] Indeed: ${err.message}`);
    await page.screenshot({ path: "/tmp/indeed-error.png" });
  } finally {
    await context.close();
  }

  return results;
}

module.exports = { applyIndeed };
