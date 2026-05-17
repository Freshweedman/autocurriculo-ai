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

    // Find job cards
    const jobCards = await page.$$('[data-jk]');
    log(`[INDEED] Encontrados ${jobCards.length} cards de vaga`);

    const maxToApply = Math.min(limiteDiario || 5, jobCards.length);

    for (let i = 0; i < maxToApply; i++) {
      try {
        const card = jobCards[i];
        await card.click();
        await randomDelay(2000, 4000);

        // Look for "Candidatura simplificada" button
        const easyApplyBtn = await page.$(
          'button:has-text("Candidatura simplificada"), span:has-text("Candidatura simplificada"), button:has-text("Aplicar facil")'
        );

        if (easyApplyBtn) {
          await easyApplyBtn.click();
          await randomDelay(2000, 4000);

          // Upload resume
          const fileInput = await page.$('input[type="file"]');
          if (fileInput) {
            await fileInput.setInputFiles(curriculoPath);
            log(`[INDEED] Curriculo anexado vaga ${i + 1}`);
            await randomDelay(1000, 2000);

            // Submit
            const submitBtn = await page.$(
              'button:has-text("Enviar"), button:has-text("Concluir"), button:has-text("Finalizar")'
            );
            if (submitBtn) {
              await submitBtn.click();
              log(`[OK] Indeed vaga ${i + 1} enviada`);
              results.push({ empresa: "Indeed", vaga: `vaga-${i + 1}`, plataforma: "Indeed", status: "enviado" });
            }
          }
        } else {
          log(`[INDEED] Vaga ${i + 1} nao tem candidatura simplificada`);
          results.push({ empresa: "Indeed", vaga: `vaga-${i + 1}`, plataforma: "Indeed", status: "nao_suportado" });
        }

        await randomDelay(2000, 4000);
      } catch (cardErr) {
        log(`[ERRO] Indeed vaga ${i + 1}: ${cardErr.message}`);
        results.push({ empresa: "Indeed", vaga: `vaga-${i + 1}`, plataforma: "Indeed", status: "falhou" });
      }
    }

  } catch (err) {
    log(`[ERRO CRITICO] Indeed: ${err.message}`);
    await page.screenshot({ path: "/tmp/indeed-error.png" });
  } finally {
    await context.close();
  }

  return results;
}

module.exports = { applyIndeed };
