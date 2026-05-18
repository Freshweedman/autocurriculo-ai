const { randomDelay, humanType } = require("../utils/delays");
const { log } = require("../utils/logger");

/**
 * Indeed Brasil automation (v2 - supports session mode)
 * @param {Browser} browser - Playwright browser instance
 * @param {BrowserContext} authContext - Optional authenticated context (session mode)
 * @param {Object} config - { session?, email?, senha?, cargo, cidade, curriculoPath, limiteDiario }
 */
async function applyIndeed(browser, authContext, config) {
  const { email, senha, session, cargo, cidade, curriculoPath, limiteDiario } = config;
  const results = [];

  let context = authContext;
  let shouldCloseContext = false;
  if (!context) {
    context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    shouldCloseContext = true;
  }

  const page = await context.newPage();

  try {
    if (session) {
      // SESSION MODE: Skip login, verify session is valid
      log("[INDEED] Modo sessao - verificando...");
      await page.goto("https://br.indeed.com", { waitUntil: "domcontentloaded" });
      await randomDelay(2000, 3000);
      
      const signInBtn = await page.$('a[data-gnav-element-name="SignIn"]');
      if (signInBtn) {
        log("[INDEED] Sessao expirada! Tentando fallback email/senha...");
        if (email && senha) {
          await doIndeedLogin(page, email, senha);
        } else {
          log("[INDEED] Sem fallback. Pulando Indeed.");
          return results;
        }
      } else {
        log("[INDEED] Sessao Google ativa - login OK!");
      }
    } else {
      // EMAIL/SENHA MODE
      log("[INDEED] Acessando br.indeed.com...");
      await page.goto("https://br.indeed.com", { waitUntil: "domcontentloaded" });
      await randomDelay(2000, 4000);
      await doIndeedLogin(page, email, senha);
    }

    // Search
    log("[INDEED] Buscando vagas...");
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

    // Multi-page loop
    const maxTarget = limiteDiario || 100;
    let applied = 0;
    let pageNum = 1;

    while (applied < maxTarget && pageNum <= 20) {
      log(`[INDEED] Pagina ${pageNum}...`);

      const jobCards = await page.$$('[data-jk]');
      if (jobCards.length === 0) { log("[INDEED] Fim dos resultados."); break; }
      log(`[INDEED] ${jobCards.length} vagas`);

      for (let i = 0; i < jobCards.length && applied < maxTarget; i++) {
        try {
          const currentCards = await page.$$('[data-jk]');
          if (i >= currentCards.length) break;
          await currentCards[i].click();
          await randomDelay(2000, 4000);

          const easyApplyBtn = await page.$(
            'button:has-text("Candidatura simplificada"), span:has-text("Candidatura simplificada"), button:has-text("Aplicar facil"), button:has-text("Easy Apply")'
          );

          if (easyApplyBtn) {
            await easyApplyBtn.click();
            await randomDelay(2000, 4000);

            const fileInput = await page.$('input[type="file"]');
            if (fileInput) {
              await fileInput.setInputFiles(curriculoPath);
              log(`[INDEED] CV #${applied + 1}`);
              await randomDelay(1000, 2000);

              const submitBtn = await page.$(
                'button:has-text("Enviar"), button:has-text("Concluir"), button:has-text("Finalizar"), button:has-text("Submit"), button:has-text("Apply")'
              );
              if (submitBtn) {
                await submitBtn.click();
                applied++;
                results.push({ empresa: "Indeed", vaga: `indeed-${applied}`, plataforma: "Indeed", status: "enviado" });
              } else {
                const closeBtn = await page.$('button[aria-label="Fechar"], button[aria-label="Close"]');
                if (closeBtn) await closeBtn.click();
                results.push({ empresa: "Indeed", vaga: `indeed-${applied + 1}`, plataforma: "Indeed", status: "nao_suportado" });
              }
            } else {
              results.push({ empresa: "Indeed", vaga: `indeed-${applied + 1}`, plataforma: "Indeed", status: "sem_file_input" });
            }
          } else {
            results.push({ empresa: "Indeed", vaga: `indeed-${applied + 1}`, plataforma: "Indeed", status: "nao_suportado" });
          }
          await randomDelay(2000, 4000);
        } catch (cardErr) {
          log(`[ERRO] Indeed: ${cardErr.message}`);
          results.push({ empresa: "Indeed", vaga: `indeed-${applied + 1}`, plataforma: "Indeed", status: "falhou" });
        }
      }

      if (applied < maxTarget) {
        const nextBtn = await page.$('a[data-testid="pagination-page-next"], a[aria-label="Proxima"], a[aria-label="Next"]');
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

    log(`[INDEED] ${applied} enviadas`);

  } catch (err) {
    log(`[ERRO] Indeed: ${err.message}`);
    await page.screenshot({ path: "/tmp/indeed-error.png" });
  } finally {
    if (shouldCloseContext) await context.close();
    else await page.close();
  }

  return results;
}

async function doIndeedLogin(page, email, senha) {
  log("[INDEED] Login email/senha...");
  await page.click('a[data-gnav-element-name="SignIn"]');
  await page.waitForSelector('input[name="__email"]', { timeout: 10000 });
  await humanType(page, 'input[name="__email"]', email);
  await humanType(page, 'input[name="__password"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/indeed.com/**", { timeout: 15000 }).catch(() => {});
  await randomDelay(3000, 5000);
}

module.exports = { applyIndeed };
