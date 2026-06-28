const { randomDelay } = require("../utils/delays");
const { log } = require("../utils/logger");

/**
 * LinkedIn Jobs automation (v3 - fixed Easy Apply flow, vaga_url tracking, dedup-safe)
 */
async function applyLinkedIn(browser, authContext, config) {
  const { email, senha, session, cargo, cidade, curriculoPath, limiteDiario } = config;
  const results = [];

  let context = authContext;
  let shouldCloseContext = false;
  if (!context) {
    context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      locale: "pt-BR",
    });
    shouldCloseContext = true;
  }
  const page = await context.newPage();

  try {
    if (session) {
      log("[LINKEDIN] Modo sessao - verificando...");
      await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 30000 });
      await randomDelay(3000, 5000);

      const currentUrl = page.url();
      if (currentUrl.includes("/login") || currentUrl.includes("/checkpoint") || currentUrl.includes("/authwall")) {
        log("[LINKEDIN] Sessao expirada! Fallback email/senha...");
        if (email && senha) {
          await doLinkedInLogin(page, email, senha);
          if (page.url().includes("/checkpoint") || page.url().includes("/login")) {
            log("[LINKEDIN] Login bloqueado. Pulando.");
            return results;
          }
        } else {
          log("[LINKEDIN] Sem fallback. Pulando.");
          return results;
        }
      } else {
        log("[LINKEDIN] Sessao ativa!");
      }
    } else {
      log("[LINKEDIN] Login email/senha...");
      await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded", timeout: 30000 });
      await randomDelay(3000, 5000);
      await doLinkedInLogin(page, email, senha);
      if (page.url().includes("/checkpoint") || page.url().includes("/login")) {
        log("[LINKEDIN] Falha no login. Pulando.");
        return results;
      }
    }

    // Search — use Easy Apply filter (f_LF=f_AL)
    const searchQuery = encodeURIComponent(cargo || "marketing");
    const locQuery = cidade ? `&location=${encodeURIComponent(cidade)}` : "&location=Brazil";
    await page.goto(
      `https://www.linkedin.com/jobs/search/?keywords=${searchQuery}${locQuery}&f_LF=f_AL&sortBy=DD`,
      { waitUntil: "domcontentloaded", timeout: 30000 }
    );
    await randomDelay(4000, 6000);

    const maxTarget = Math.min(limiteDiario || 100, 50); // LinkedIn blocks aggressive bot behavior
    let applied = 0;
    let scrollAttempts = 0;
    const processedUrls = new Set();

    while (applied < maxTarget && scrollAttempts < 25) {
      const jobCards = await page.$$(".job-card-container, .jobs-search-results__list-item, [data-job-id], .scaffold-layout__list-item");
      if (jobCards.length === 0) { log("[LINKEDIN] Nenhum card encontrado."); break; }

      for (let i = 0; i < jobCards.length && applied < maxTarget; i++) {
        try {
          const currentCards = await page.$$(".job-card-container, .jobs-search-results__list-item, [data-job-id], .scaffold-layout__list-item");
          if (i >= currentCards.length) break;

          // Get job URL before clicking
          const jobLinkEl = await currentCards[i].$('a[href*="/jobs/view/"]');
          const vagaUrl = jobLinkEl ? await jobLinkEl.getAttribute("href") : null;
          const fullVagaUrl = vagaUrl && !vagaUrl.startsWith("http") ? `https://www.linkedin.com${vagaUrl}` : vagaUrl;

          // Skip already processed
          if (fullVagaUrl && processedUrls.has(fullVagaUrl)) continue;
          if (fullVagaUrl) processedUrls.add(fullVagaUrl);

          // Get title/company from card
          const cardTitle = await currentCards[i].$eval(
            '.job-card-list__title, .jobs-unified-top-card__job-title, [class*="job-title"]',
            el => el.textContent?.trim() || ""
          ).catch(() => "");
          const cardCompany = await currentCards[i].$eval(
            '.job-card-container__company-name, .jobs-unified-top-card__company-name, [class*="company-name"]',
            el => el.textContent?.trim() || "LinkedIn"
          ).catch(() => "LinkedIn");

          await currentCards[i].click();
          await randomDelay(2000, 4000);

          const easyApplyBtn = await page.$(
            'button:has-text("Easy Apply"), button:has-text("Candidatura simplificada"), ' +
            'button:has-text("Candidatura fácil"), .jobs-apply-button--top-card button'
          );

          if (easyApplyBtn && await easyApplyBtn.isVisible()) {
            await easyApplyBtn.click();
            await randomDelay(2000, 4000);

            let submitted = false;
            // Navigate multi-step Easy Apply form
            for (let step = 0; step < 8; step++) {
              // Upload resume if file input appears
              const fileInput = await page.$('input[type="file"]');
              if (fileInput && await fileInput.isVisible()) {
                await fileInput.setInputFiles(curriculoPath);
                log(`[LINKEDIN] CV anexado step ${step}: ${cardTitle || fullVagaUrl}`);
                await randomDelay(1000, 2000);
              }

              // Check for submit button first
              const submitBtn = await page.$(
                'button[aria-label*="Submit application"], button:has-text("Submit application"), ' +
                'button:has-text("Enviar candidatura"), button[aria-label*="Enviar"]'
              );
              if (submitBtn && await submitBtn.isVisible()) {
                await submitBtn.click();
                submitted = true;
                log(`[OK] LinkedIn #${applied + 1}: ${cardCompany} - ${cardTitle}`);
                break;
              }

              // Next/Review button
              const nextBtn = await page.$(
                'button:has-text("Next"), button:has-text("Próxima"), button:has-text("Próximo"), ' +
                'button:has-text("Review"), button:has-text("Revisar"), ' +
                'button[aria-label*="Continue"], button[aria-label*="Next"]'
              );
              if (nextBtn && await nextBtn.isVisible()) {
                await nextBtn.click();
                await randomDelay(1500, 3000);
              } else {
                break;
              }
            }

            if (submitted) {
              applied++;
              results.push({
                empresa: cardCompany,
                vaga: cardTitle || fullVagaUrl || `linkedin-${applied}`,
                vaga_url: fullVagaUrl,
                plataforma: "LinkedIn",
                status: "enviado",
              });
            } else {
              results.push({
                empresa: cardCompany,
                vaga: cardTitle || fullVagaUrl || `linkedin-${applied + 1}`,
                vaga_url: fullVagaUrl,
                plataforma: "LinkedIn",
                status: "nao_suportado",
              });
            }

            // Dismiss modal
            const closeBtn = await page.$('button[aria-label="Dismiss"], button[aria-label="Fechar"], button[data-test-modal-close-btn]');
            if (closeBtn && await closeBtn.isVisible()) { await closeBtn.click(); await randomDelay(1000, 2000); }
          } else {
            results.push({
              empresa: cardCompany,
              vaga: cardTitle || `linkedin-${applied + 1}`,
              vaga_url: fullVagaUrl,
              plataforma: "LinkedIn",
              status: "nao_suportado",
            });
          }

          await randomDelay(2000, 4000);
        } catch (cardErr) {
          log(`[ERRO] LinkedIn card ${i}: ${cardErr.message}`);
        }
      }

      if (applied < maxTarget) {
        // Scroll the job list to load more
        await page.evaluate(() => {
          const list = document.querySelector(".jobs-search-results-list, .jobs-search-results__list, .scaffold-layout__list");
          if (list) list.scrollTop = list.scrollHeight;
        });
        await randomDelay(3000, 5000);
        scrollAttempts++;
      }
    }

    log(`[LINKEDIN] ${applied} enviadas`);
  } catch (err) {
    log(`[ERRO] LinkedIn: ${err.message}`);
    await page.screenshot({ path: "/tmp/linkedin-error.png" }).catch(() => {});
  } finally {
    if (shouldCloseContext) await context.close();
    else await page.close();
  }

  return results;
}

async function doLinkedInLogin(page, email, senha) {
  if (!email || !senha) { log("[LINKEDIN] Sem credenciais."); return; }
  log("[LINKEDIN] Preenchendo login...");

  // Dismiss cookie banner if present
  await randomDelay(2000, 3000);
  const cookieBtn = await page.$('button[action-type="ACCEPT"], button:has-text("Aceitar todos"), button:has-text("Accept all")');
  if (cookieBtn) { await cookieBtn.click(); await randomDelay(1000, 2000); }

  const emailSelectors = ['#username', 'input[name="session_key"]', 'input[autocomplete="username"]', 'input[type="email"]'];
  for (const sel of emailSelectors) {
    const el = await page.$(sel);
    if (el && await el.isVisible()) {
      await page.fill(sel, email);
      log(`[LINKEDIN] Email preenchido: ${sel}`);
      break;
    }
  }

  const passSelectors = ['#password', 'input[name="session_password"]', 'input[type="password"]'];
  for (const sel of passSelectors) {
    const el = await page.$(sel);
    if (el && await el.isVisible()) {
      await page.fill(sel, senha);
      break;
    }
  }

  await page.click('button[type="submit"]').catch(() => {});
  await randomDelay(5000, 8000);
  log("[LINKEDIN] Login submetido, aguardando...");
}

module.exports = { applyLinkedIn };
