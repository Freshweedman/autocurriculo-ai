const { randomDelay, humanType } = require("../utils/delays");
const { log } = require("../utils/logger");

/**
 * LinkedIn Jobs automation (v2 - supports session mode)
 * WARNING: LinkedIn detects bots. Use a dedicated account and session mode recommended.
 */
async function applyLinkedIn(browser, authContext, config) {
  const { email, senha, session, cargo, cidade, curriculoPath, limiteDiario } = config;
  const results = [];

  let context = authContext;
  let shouldCloseContext = false;
  if (!context) {
    context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      locale: "pt-BR",
    });
    shouldCloseContext = true;
  }
  const page = await context.newPage();

  try {
    if (session) {
      log("[LINKEDIN] Modo sessao - verificando...");
      await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });
      await randomDelay(3000, 5000);

      if (page.url().includes("/login") || page.url().includes("/checkpoint")) {
        log("[LINKEDIN] Sessao expirada! Fallback email/senha...");
        if (email && senha) {
          await doLinkedInLogin(page, email, senha);
          if (page.url().includes("/checkpoint")) {
            log("[LINKEDIN] Verificacao extra pedida. Pulando LinkedIn.");
            return results;
          }
        } else {
          log("[LINKEDIN] Sem fallback. Pulando.");
          return results;
        }
      } else {
        log("[LINKEDIN] Sessao Google ativa!");
      }
    } else {
      log("[LINKEDIN] Acessando...");
      await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded" });
      await randomDelay(3000, 5000);
      await doLinkedInLogin(page, email, senha);
      if (page.url().includes("/checkpoint") || page.url().includes("/login")) {
        log("[LINKEDIN] Falha no login. Pulando.");
        return results;
      }
    }

    // Search
    const searchQuery = encodeURIComponent(`${cargo || "marketing"}${cidade ? ` ${cidade}` : ""} Brazil`);
    await page.goto(`https://www.linkedin.com/jobs/search/?keywords=${searchQuery}&location=Brazil&f_E=2`, {
      waitUntil: "domcontentloaded",
    });
    await randomDelay(4000, 6000);

    const maxTarget = Math.min(limiteDiario || 100, 50);
    let applied = 0;
    let scrollAttempts = 0;

    while (applied < maxTarget && scrollAttempts < 30) {
      const jobCards = await page.$$(".job-card-container, .jobs-search-results__list-item, [data-job-id]");
      if (jobCards.length === 0) { log("[LINKEDIN] Nenhum card."); break; }

      for (let i = 0; i < jobCards.length && applied < maxTarget; i++) {
        try {
          const cards = await page.$$(".job-card-container, .jobs-search-results__list-item, [data-job-id]");
          if (i >= cards.length) break;
          await cards[i].click();
          await randomDelay(2000, 4000);

          const easyApplyBtn = await page.$(
            'button:has-text("Easy Apply"), button:has-text("Candidatura simplificada"), button:has-text("Candidatura facil")'
          );

          if (easyApplyBtn) {
            await easyApplyBtn.click();
            await randomDelay(2000, 4000);

            let steps = 0;
            while (steps < 5) {
              const fileInput = await page.$('input[type="file"]');
              if (fileInput) {
                await fileInput.setInputFiles(curriculoPath);
                log(`[LINKEDIN] CV #${applied + 1}`);
                await randomDelay(1000, 2000);
              }

              const nextBtn = await page.$(
                'button:has-text("Next"), button:has-text("Proximo"), button:has-text("Review"), button:has-text("Submit"), button:has-text("Enviar")'
              );

              if (nextBtn) {
                const btnText = await nextBtn.textContent();
                await nextBtn.click();
                if (btnText && (btnText.includes("Submit") || btnText.includes("Enviar"))) {
                  applied++;
                  results.push({ empresa: "LinkedIn", vaga: `linkedin-${applied}`, plataforma: "LinkedIn", status: "enviado" });
                  break;
                }
                await randomDelay(1500, 3000);
                steps++;
              } else { break; }
            }

            const closeBtn = await page.$('button[aria-label="Dismiss"], button[aria-label="Fechar"]');
            if (closeBtn) { await closeBtn.click(); await randomDelay(1000, 2000); }
          } else {
            results.push({ empresa: "LinkedIn", vaga: `linkedin-${applied + 1}`, plataforma: "LinkedIn", status: "nao_suportado" });
          }
          await randomDelay(2000, 4000);
        } catch (cardErr) {
          log(`[ERRO] LinkedIn: ${cardErr.message}`);
          results.push({ empresa: "LinkedIn", vaga: `linkedin-error`, plataforma: "LinkedIn", status: "falhou" });
        }
      }

      if (applied < maxTarget) {
        await page.evaluate(() => {
          const list = document.querySelector(".jobs-search-results-list, .jobs-search-results__list");
          if (list) list.scrollTop = list.scrollHeight;
        });
        await randomDelay(3000, 5000);
        scrollAttempts++;
      }
    }

    log(`[LINKEDIN] ${applied} enviadas`);
  } catch (err) {
    log(`[ERRO] LinkedIn: ${err.message}`);
    await page.screenshot({ path: "/tmp/linkedin-error.png" });
  } finally {
    if (shouldCloseContext) await context.close();
    else await page.close();
  }

  return results;
}

async function doLinkedInLogin(page, email, senha) {
  log("[LINKEDIN] Login email/senha...");
  // Tenta varios seletores — LinkedIn muda o layout
  const emailSelectors = ["#username", 'input[name="session_key"]', 'input[autocomplete="username"]', 'input[type="email"]'];
  let filled = false;
  for (const sel of emailSelectors) {
    const el = await page.$(sel);
    if (el) {
      await page.fill(sel, email);
      filled = true;
      break;
    }
  }
  if (!filled) { log("[LINKEDIN] Campo email nao encontrado."); return; }

  const senhaSelectors = ["#password", 'input[name="session_password"]', 'input[type="password"]'];
  for (const sel of senhaSelectors) {
    const el = await page.$(sel);
    if (el) { await page.fill(sel, senha); break; }
  }

  await page.click('button[type="submit"]').catch(() => {});
  await randomDelay(5000, 8000);
}

module.exports = { applyLinkedIn };
