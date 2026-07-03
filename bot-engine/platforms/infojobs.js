const { randomDelay } = require("../utils/delays");
const { log } = require("../utils/logger");

/**
 * InfoJobs Brasil automation (v2 - vaga_url tracking, dedup-safe)
 */
async function applyInfoJobs(browser, authContext, config) {
  const { email, senha, session, cargo, cidade, curriculoPath, limiteDiario } = config;
  const results = [];

  let context = authContext;
  let shouldCloseContext = false;
  if (!context) {
    context = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: "pt-BR" });
    shouldCloseContext = true;
  }
  const page = await context.newPage();

  try {
    if (session) {
      log("[INFOJOBS] Modo sessao - verificando...");
      await page.goto("https://www.infojobs.com.br", { waitUntil: "domcontentloaded", timeout: 30000 });
      await randomDelay(2000, 3000);

      // Check login state via user menu presence
      const isLoggedIn = await page.$('[class*="user-menu"], [class*="userMenu"], a[href*="meu-perfil"], a[href*="dashboard"]');
      if (!isLoggedIn) {
        log("[INFOJOBS] Sessao expirada! Fallback email/senha...");
        if (email && senha) {
          await page.goto("https://www.infojobs.com.br/login.aspx", { waitUntil: "domcontentloaded" });
          await randomDelay(2000, 4000);
          await doInfoJobsLogin(page, email, senha);
        } else {
          log("[INFOJOBS] Sem fallback. Pulando.");
          return results;
        }
      } else {
        log("[INFOJOBS] Sessao ativa!");
      }
    } else {
      log("[INFOJOBS] Login email/senha...");
      await page.goto("https://www.infojobs.com.br/login.aspx", { waitUntil: "domcontentloaded", timeout: 30000 });
      await randomDelay(2000, 4000);
      await doInfoJobsLogin(page, email, senha);
    }

    // Search — all modalities (0 = all, 4 = remote only)
    log("[INFOJOBS] Buscando vagas...");
    const searchUrl = `https://www.infojobs.com.br/empregos.aspx?palabra=${encodeURIComponent(cargo || "gestor de trafego")}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await randomDelay(3000, 5000);

    const maxTarget = limiteDiario || 100;
    let applied = 0;
    let pageNum = 1;

    while (applied < maxTarget && pageNum <= 20) {
      log(`[INFOJOBS] Pagina ${pageNum}...`);

      const vagaInfos = await page.evaluate(() => {
        const seen = new Set();
        const result = [];
        for (const el of document.querySelectorAll('a[href*="/vaga-de-emprego/"]')) {
          const href = el.href;
          if (!href || seen.has(href)) continue;
          seen.add(href);
          result.push({
            url: href,
            titulo: el.querySelector('h2, h3, [class*="title"]')?.textContent?.trim() || el.textContent?.trim()?.slice(0, 80) || "",
            empresa: el.closest('.ij-OfferList-item, [class*="offer"]')?.querySelector('[class*="company"], [class*="empresa"]')?.textContent?.trim() || "InfoJobs",
          });
        }
        return result.slice(0, 25);
      });

      if (vagaInfos.length === 0) { log("[INFOJOBS] Fim."); break; }
      log(`[INFOJOBS] ${vagaInfos.length} vagas`);

      for (const info of vagaInfos) {
        if (applied >= maxTarget) break;
        try {
          const jobPage = await context.newPage();
          await jobPage.goto(info.url, { waitUntil: "domcontentloaded", timeout: 20000 });
          await randomDelay(2000, 4000);

          const candidatarBtn = await jobPage.$(
            'button:has-text("Candidatura simples"), a:has-text("Candidatura simples"), ' +
            'button:has-text("Candidatar"), a:has-text("Candidatar"), button:has-text("Candidatar-se"), ' +
            'button:has-text("Aplicar")'
          );

          if (candidatarBtn && await candidatarBtn.isVisible()) {
            await candidatarBtn.click();
            await randomDelay(2000, 4000);

            const fileInput = await jobPage.$('input[type="file"]');
            if (fileInput) {
              await fileInput.setInputFiles(curriculoPath);
              await randomDelay(1000, 2000);
              const submitBtn = await jobPage.$(
                'button[type="submit"], input[type="submit"], button:has-text("Enviar"), button:has-text("Finalizar")'
              );
              if (submitBtn && await submitBtn.isVisible()) {
                await submitBtn.click();
                applied++;
                results.push({ empresa: info.empresa, vaga: info.titulo, vaga_url: info.url, plataforma: "InfoJobs", status: "enviado" });
                log(`[OK] InfoJobs #${applied}: ${info.empresa}`);
              } else {
                results.push({ empresa: info.empresa, vaga: info.titulo, vaga_url: info.url, plataforma: "InfoJobs", status: "sem_submit" });
              }
            } else {
              results.push({ empresa: info.empresa, vaga: info.titulo, vaga_url: info.url, plataforma: "InfoJobs", status: "sem_file_input" });
            }
          } else {
            results.push({ empresa: info.empresa, vaga: info.titulo, vaga_url: info.url, plataforma: "InfoJobs", status: "nao_suportado" });
          }

          await jobPage.close();
          await randomDelay(2000, 4000);
        } catch (jobErr) {
          log(`[ERRO] InfoJobs: ${jobErr.message}`);
          results.push({ empresa: "InfoJobs", vaga: info.url, vaga_url: info.url, plataforma: "InfoJobs", status: "falhou" });
        }
      }

      if (applied < maxTarget) {
        const nextBtn = await page.$('a[rel="next"], a:has-text("Próxima"), a:has-text("Seguinte"), [aria-label="Próxima"]');
        if (nextBtn) {
          await nextBtn.click();
          await randomDelay(3000, 5000);
          pageNum++;
        } else { break; }
      }
    }

    log(`[INFOJOBS] ${applied} enviadas`);
  } catch (err) {
    log(`[ERRO] InfoJobs: ${err.message}`);
    await page.screenshot({ path: "/tmp/infojobs-error.png" }).catch(() => {});
  } finally {
    if (shouldCloseContext) await context.close();
    else await page.close();
  }

  return results;
}

async function doInfoJobsLogin(page, email, senha) {
  log("[INFOJOBS] Login...");
  for (const sel of ['input[type="email"]', 'input[name*="email"]', 'input[id*="email"]']) {
    const el = await page.$(sel);
    if (el && await el.isVisible()) { await el.fill(email); break; }
  }
  for (const sel of ['input[type="password"]', 'input[name*="password"]']) {
    const el = await page.$(sel);
    if (el && await el.isVisible()) { await el.fill(senha); break; }
  }
  const btn = await page.$('button[type="submit"], input[type="submit"], button:has-text("Entrar")');
  if (btn) { await btn.click(); }
  await page.waitForURL("**/infojobs.com.br/**", { timeout: 15000 }).catch(() => {});
  await randomDelay(3000, 5000);
}

module.exports = { applyInfoJobs };
