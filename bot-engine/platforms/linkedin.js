const { randomDelay, humanType } = require("../utils/delays");
const { log } = require("../utils/logger");

/**
 * LinkedIn Jobs automation
 * WARNING: LinkedIn aggressively detects and blocks automation.
 * Use with caution - this is HIGH RISK for account restriction.
 * Recommended: Use a dedicated LinkedIn account, not your main one.
 */
async function applyLinkedIn(browser, config) {
  const { email, senha, cargo, cidade, curriculoPath, limiteDiario } = config;
  const results = [];
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    locale: "pt-BR",
  });
  const page = await context.newPage();

  try {
    log("[LINKEDIN] Acessando linkedin.com/login...");
    await page.goto("https://www.linkedin.com/login?trk=guest_homepage-basic_nav-header-signin", {
      waitUntil: "domcontentloaded",
    });
    await randomDelay(3000, 5000);

    // Login
    log("[LINKEDIN] Fazendo login...");
    await page.waitForSelector("#username", { timeout: 10000 });
    await page.fill("#username", "");
    await humanType(page, "#username", email);
    await randomDelay(1000, 2000);
    await page.fill("#password", "");
    await humanType(page, "#password", senha);
    await randomDelay(500, 1000);

    await page.click('button[type="submit"]');
    await randomDelay(5000, 8000);

    // Check if login succeeded (no error message, no captcha)
    const currentUrl = page.url();
    if (currentUrl.includes("/feed") || currentUrl.includes("/checkpoint")) {
      if (currentUrl.includes("/checkpoint")) {
        log("[LINKEDIN] AVISO: LinkedIn pediu verificacao extra (captcha/2FA). Pulando.");
        await context.close();
        return results;
      }
      log("[LINKEDIN] Login OK");
    } else if (currentUrl.includes("/login")) {
      log("[LINKEDIN] Falha no login - credenciais invalidas ou captcha");
      await context.close();
      return results;
    }

    // Build search URL
    const searchQuery = encodeURIComponent(`${cargo || "marketing"}${cidade ? ` ${cidade}` : ""} Brazil`);
    log(`[LINKEDIN] Buscando vagas: "${cargo || "marketing"}"`);

    await page.goto(`https://www.linkedin.com/jobs/search/?keywords=${searchQuery}&location=Brazil&f_E=2`, {
      waitUntil: "domcontentloaded",
    });
    await randomDelay(4000, 6000);

    // Main application loop
    const maxTarget = Math.min(limiteDiario || 100, 50); // LinkedIn max 50 per run for safety
    let applied = 0;
    let scrollAttempts = 0;

    while (applied < maxTarget && scrollAttempts < 30) {
      // Find job cards
      const jobCards = await page.$$(".job-card-container, .jobs-search-results__list-item, [data-job-id]");

      if (jobCards.length === 0) {
        log("[LINKEDIN] Nenhum card de vaga encontrado");
        break;
      }

      log(`[LINKEDIN] ${jobCards.length} vagas visiveis`);

      for (let i = 0; i < jobCards.length && applied < maxTarget; i++) {
        try {
          // Re-query as DOM changes
          const cards = await page.$$(".job-card-container, .jobs-search-results__list-item, [data-job-id]");
          if (i >= cards.length) break;

          await cards[i].click();
          await randomDelay(2000, 4000);

          // Look for Easy Apply button
          const easyApplyBtn = await page.$(
            'button:has-text("Easy Apply"), button:has-text("Candidatura simplificada"), button:has-text("Candidatura facil")'
          );

          if (easyApplyBtn) {
            await easyApplyBtn.click();
            await randomDelay(2000, 4000);

            // Walk through Easy Apply modal steps
            let steps = 0;
            while (steps < 5) {
              // Check for upload input
              const fileInput = await page.$('input[type="file"]');
              if (fileInput) {
                await fileInput.setInputFiles(curriculoPath);
                log(`[LINKEDIN] Curriculo anexado - vaga #${applied + 1}`);
                await randomDelay(1000, 2000);
              }

              // Look for Next/Submit button
              const nextBtn = await page.$(
                'button:has-text("Next"), button:has-text("Proximo"), button:has-text("Review"), button:has-text("Submit"), button:has-text("Enviar")'
              );

              if (nextBtn) {
                const btnText = await nextBtn.textContent();
                await nextBtn.click();

                if (btnText && (btnText.includes("Submit") || btnText.includes("Enviar"))) {
                  applied++;
                  log(`[OK] LinkedIn vaga #${applied} enviada`);
                  results.push({ empresa: "LinkedIn", vaga: `linkedin-${applied}`, plataforma: "LinkedIn", status: "enviado" });
                  break;
                }
                await randomDelay(1500, 3000);
                steps++;
              } else {
                break;
              }
            }

            // Close modal if still open
            const closeBtn = await page.$('button[aria-label="Dismiss"], button[aria-label="Fechar"], [aria-label="Dismiss"]');
            if (closeBtn) {
              await closeBtn.click();
              await randomDelay(1000, 2000);
            }
          } else {
            results.push({ empresa: "LinkedIn", vaga: `linkedin-${applied + 1}`, plataforma: "LinkedIn", status: "nao_suportado" });
          }

          await randomDelay(2000, 4000);
        } catch (cardErr) {
          log(`[ERRO] LinkedIn vaga ${i}: ${cardErr.message}`);
          results.push({ empresa: "LinkedIn", vaga: `linkedin-${i}`, plataforma: "LinkedIn", status: "falhou" });
        }
      }

      // Scroll to load more jobs
      if (applied < maxTarget) {
        await page.evaluate(() => {
          const list = document.querySelector(".jobs-search-results-list, .jobs-search-results__list");
          if (list) list.scrollTop = list.scrollHeight;
        });
        await randomDelay(3000, 5000);
        scrollAttempts++;
      }
    }

    log(`[LINKEDIN] Finalizado: ${applied} candidaturas enviadas (max 50 por seguranca)`);

  } catch (err) {
    log(`[ERRO CRITICO] LinkedIn: ${err.message}`);
    await page.screenshot({ path: "/tmp/linkedin-error.png" });
  } finally {
    await context.close();
  }

  return results;
}

module.exports = { applyLinkedIn };
