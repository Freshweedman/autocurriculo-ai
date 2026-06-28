const { randomDelay, humanType } = require("../utils/delays");
const { log } = require("../utils/logger");

/**
 * Indeed Brasil automation (v3 - fixed selectors, vaga_url tracking, dedup-safe)
 */
async function applyIndeed(browser, authContext, config) {
  const { email, senha, session, cargo, cidade, curriculoPath, limiteDiario } = config;
  const results = [];

  let context = authContext;
  let shouldCloseContext = false;
  if (!context) {
    context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      locale: "pt-BR",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });
    shouldCloseContext = true;
  }

  const page = await context.newPage();

  try {
    if (session) {
      log("[INDEED] Modo sessao - verificando...");
      await page.goto("https://br.indeed.com", { waitUntil: "domcontentloaded" });
      await randomDelay(2000, 3000);

      // Check logged-in state by looking for user avatar/name, not login button presence
      const loggedIn = await page.$('.gnav-header-user, [data-testid="header-desktopNavelement-user"], .css-1uutiy0, [aria-label*="Perfil"], [aria-label*="account"]');
      if (!loggedIn) {
        log("[INDEED] Sessao expirada! Tentando fallback email/senha...");
        if (email && senha) {
          await doIndeedLogin(page, email, senha);
        } else {
          log("[INDEED] Sem fallback. Pulando Indeed.");
          return results;
        }
      } else {
        log("[INDEED] Sessao ativa - login OK!");
      }
    } else {
      log("[INDEED] Acessando br.indeed.com...");
      await page.goto("https://br.indeed.com", { waitUntil: "domcontentloaded" });
      await randomDelay(2000, 4000);
      await doIndeedLogin(page, email, senha);
    }

    // Search
    log("[INDEED] Buscando vagas...");
    const q = encodeURIComponent(cargo || "gestor de trafego");
    const loc = cidade ? `&l=${encodeURIComponent(cidade)}` : "";
    await page.goto(`https://br.indeed.com/jobs?q=${q}${loc}&sort=date`, {
      waitUntil: "domcontentloaded",
    });
    await randomDelay(3000, 5000);

    const maxTarget = limiteDiario || 100;
    let applied = 0;
    let pageNum = 1;

    while (applied < maxTarget && pageNum <= 20) {
      log(`[INDEED] Pagina ${pageNum}...`);

      const jobCards = await page.$$('[data-jk]');
      if (jobCards.length === 0) { log("[INDEED] Fim dos resultados."); break; }
      log(`[INDEED] ${jobCards.length} vagas`);

      // Collect job IDs and titles from the list page before clicking
      const vagaInfos = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('[data-jk]')).map(el => ({
          jk: el.getAttribute('data-jk') || '',
          titulo: el.querySelector('.jobTitle, h2.title, [class*="jobTitle"]')?.textContent?.trim() || '',
          empresa: el.querySelector('[data-testid="company-name"], .companyName')?.textContent?.trim() || 'Indeed',
        }));
      });

      for (let i = 0; i < jobCards.length && applied < maxTarget; i++) {
        const info = vagaInfos[i] || {};
        const vagaUrl = `https://br.indeed.com/viewjob?jk=${info.jk}`;

        try {
          const currentCards = await page.$$('[data-jk]');
          if (i >= currentCards.length) break;
          await currentCards[i].click();
          await randomDelay(2000, 4000);

          const easyApplyBtn = await page.$(
            'button:has-text("Candidatura simplificada"), button:has-text("Easy Apply"), ' +
            'button:has-text("Aplicar"), span:has-text("Candidatura simplificada")'
          );

          if (easyApplyBtn && await easyApplyBtn.isVisible()) {
            await easyApplyBtn.click();
            await randomDelay(2000, 4000);

            const fileInput = await page.$('input[type="file"]');
            if (fileInput) {
              await fileInput.setInputFiles(curriculoPath);
              log(`[INDEED] CV #${applied + 1}: ${info.titulo || vagaUrl}`);
              await randomDelay(1000, 2000);

              // Try to submit through the multi-step form
              let submitted = false;
              for (let step = 0; step < 6; step++) {
                const continueBtn = await page.$(
                  'button:has-text("Continuar"), button:has-text("Continue"), ' +
                  'button:has-text("Próxima"), button:has-text("Next")'
                );
                const submitBtn = await page.$(
                  'button:has-text("Enviar candidatura"), button:has-text("Submit application"), ' +
                  'button:has-text("Enviar"), button:has-text("Concluir"), button:has-text("Finalizar")'
                );

                if (submitBtn && await submitBtn.isVisible()) {
                  await submitBtn.click();
                  submitted = true;
                  break;
                } else if (continueBtn && await continueBtn.isVisible()) {
                  await continueBtn.click();
                  await randomDelay(1500, 3000);
                } else {
                  break;
                }
              }

              if (submitted) {
                applied++;
                results.push({
                  empresa: info.empresa || "Indeed",
                  vaga: info.titulo || vagaUrl,
                  vaga_url: vagaUrl,
                  plataforma: "Indeed",
                  status: "enviado",
                });
                log(`[OK] Indeed #${applied}: ${info.empresa}`);
              } else {
                results.push({
                  empresa: info.empresa || "Indeed",
                  vaga: info.titulo || vagaUrl,
                  vaga_url: vagaUrl,
                  plataforma: "Indeed",
                  status: "nao_suportado",
                });
              }
            } else {
              results.push({
                empresa: info.empresa || "Indeed",
                vaga: info.titulo || vagaUrl,
                vaga_url: vagaUrl,
                plataforma: "Indeed",
                status: "sem_file_input",
              });
            }
          } else {
            results.push({
              empresa: info.empresa || "Indeed",
              vaga: info.titulo || vagaUrl,
              vaga_url: vagaUrl,
              plataforma: "Indeed",
              status: "nao_suportado",
            });
          }

          // Close any open modal
          const closeBtn = await page.$('button[aria-label="Fechar"], button[aria-label="Close"], button[aria-label="Dismiss"]');
          if (closeBtn && await closeBtn.isVisible()) { await closeBtn.click(); await randomDelay(500, 1000); }

          await randomDelay(2000, 4000);
        } catch (cardErr) {
          log(`[ERRO] Indeed card ${i}: ${cardErr.message}`);
          results.push({
            empresa: info.empresa || "Indeed",
            vaga: info.titulo || vagaUrl,
            vaga_url: vagaUrl,
            plataforma: "Indeed",
            status: "falhou",
          });
        }
      }

      if (applied < maxTarget) {
        const nextBtn = await page.$('a[data-testid="pagination-page-next"], a[aria-label="Proxima"], a[aria-label="Next page"]');
        if (nextBtn) {
          await nextBtn.click();
          await page.waitForURL("**/jobs**", { timeout: 10000 }).catch(() => {});
          await randomDelay(3000, 5000);
          pageNum++;
        } else {
          log("[INDEED] Sem mais paginas.");
          break;
        }
      }
    }

    log(`[INDEED] ${applied} enviadas de ${results.length} processadas`);

  } catch (err) {
    log(`[ERRO] Indeed: ${err.message}`);
    await page.screenshot({ path: "/tmp/indeed-error.png" }).catch(() => {});
  } finally {
    if (shouldCloseContext) await context.close();
    else await page.close();
  }

  return results;
}

async function doIndeedLogin(page, email, senha) {
  if (!email || !senha) { log("[INDEED] Sem credenciais para login."); return; }
  log("[INDEED] Login email/senha...");

  // Click login button — try multiple selectors
  for (const sel of ['a[data-gnav-element-name="SignIn"]', 'a:has-text("Entrar")', 'a[href*="login"]']) {
    const btn = await page.$(sel);
    if (btn) { await btn.click(); break; }
  }
  await randomDelay(2000, 4000);

  // Email step
  for (const sel of ['input[name="__email"]', 'input[type="email"]', 'input[autocomplete="username"]']) {
    const el = await page.$(sel);
    if (el && await el.isVisible()) {
      await el.fill(email);
      break;
    }
  }

  const continueBtn = await page.$('button:has-text("Continuar"), button[type="submit"]');
  if (continueBtn) { await continueBtn.click(); await randomDelay(2000, 3000); }

  // Password step
  for (const sel of ['input[name="__password"]', 'input[type="password"]']) {
    const el = await page.$(sel);
    if (el && await el.isVisible()) {
      await el.fill(senha);
      break;
    }
  }

  const loginBtn = await page.$('button:has-text("Entrar"), button:has-text("Login"), button[type="submit"]');
  if (loginBtn) { await loginBtn.click(); }

  await page.waitForURL("**/indeed.com/**", { timeout: 15000 }).catch(() => {});
  await randomDelay(3000, 5000);
  log("[INDEED] Login concluido.");
}

module.exports = { applyIndeed };
