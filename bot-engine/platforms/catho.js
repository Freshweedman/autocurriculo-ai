const { randomDelay, humanType } = require("../utils/delays");
const { log } = require("../utils/logger");

/**
 * Catho automation
 * https://www.catho.com.br
 * Login obrigatorio. Suporta login via Google.
 */
async function applyCatho(browser, authContext, config) {
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
      log("[CATHO] Modo sessao - verificando...");
      await page.goto("https://www.catho.com.br", { waitUntil: "domcontentloaded", timeout: 30000 });
      await randomDelay(2000, 3000);
      const loginBtn = await page.$('a[href*="login"], button:has-text("Entrar")');
      if (loginBtn) {
        log("[CATHO] Sessao expirada. Fallback email/senha...");
        if (email && senha) await doCathoLogin(page, email, senha);
        else { log("[CATHO] Sem fallback. Pulando."); return results; }
      } else {
        log("[CATHO] Sessao ativa!");
      }
    } else if (email && senha) {
      await page.goto("https://www.catho.com.br/login/", { waitUntil: "domcontentloaded", timeout: 30000 });
      await randomDelay(2000, 4000);
      await doCathoLogin(page, email, senha);
    } else {
      log("[CATHO] Sem credenciais. Pulando.");
      return results;
    }

    // Busca
    const q = encodeURIComponent(cargo || "marketing");
    const loc = cidade ? `&where=${encodeURIComponent(cidade)}` : "";
    const searchUrl = `https://www.catho.com.br/vagas/${q}/${loc}`;
    log(`[CATHO] Buscando: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await randomDelay(3000, 5000);

    const maxTarget = limiteDiario || 100;
    let applied = 0;
    let pageNum = 1;

    while (applied < maxTarget && pageNum <= 15) {
      log(`[CATHO] Pagina ${pageNum}...`);

      const jobLinks = await page.$$('a[href*="/vagas/"], a[href*="/emprego/"]');
      const hrefs = [];
      for (const l of jobLinks) {
        const h = await l.getAttribute("href");
        if (h && (h.includes("/vagas/") || h.includes("/emprego/")) && !hrefs.includes(h)) hrefs.push(h);
      }

      if (hrefs.length === 0) { log("[CATHO] Fim."); break; }
      log(`[CATHO] ${hrefs.length} vagas`);

      for (const href of hrefs) {
        if (applied >= maxTarget) break;
        try {
          const jobUrl = href.startsWith("http") ? href : `https://www.catho.com.br${href}`;
          const jobPage = await context.newPage();
          await jobPage.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
          await randomDelay(2000, 4000);

          const applyBtn = await jobPage.$(
            'button:has-text("Candidatar"), button:has-text("Candidatar-se"), a:has-text("Candidatar"), button:has-text("Quero esta vaga")'
          );
          if (applyBtn) {
            await applyBtn.click();
            await randomDelay(2000, 4000);
            const fileInput = await jobPage.$('input[type="file"]');
            if (fileInput) {
              await fileInput.setInputFiles(curriculoPath);
              await randomDelay(1000, 2000);
              const submitBtn = await jobPage.$('button[type="submit"], button:has-text("Enviar"), button:has-text("Confirmar")');
              if (submitBtn) {
                await submitBtn.click();
                applied++;
                results.push({ empresa: "Catho", vaga: jobUrl.split("/").pop() || `vaga-${applied}`, plataforma: "Catho", status: "enviado" });
                log(`[OK] Catho #${applied}`);
              } else {
                results.push({ empresa: "Catho", vaga: jobUrl.split("/").pop(), plataforma: "Catho", status: "sem_submit" });
              }
            } else {
              results.push({ empresa: "Catho", vaga: jobUrl.split("/").pop(), plataforma: "Catho", status: "sem_file_input" });
            }
          } else {
            results.push({ empresa: "Catho", vaga: jobUrl.split("/").pop(), plataforma: "Catho", status: "nao_suportado" });
          }
          await jobPage.close();
          await randomDelay(2000, 4000);
        } catch (e) {
          log(`[ERRO] Catho: ${e.message}`);
          results.push({ empresa: "Catho", vaga: "unknown", plataforma: "Catho", status: "falhou" });
        }
      }

      if (applied < maxTarget) {
        const next = await page.$('a[rel="next"], a:has-text("Proxima"), button:has-text("Proxima"), .pagination-next');
        if (next) { await next.click(); await randomDelay(3000, 5000); pageNum++; }
        else { log("[CATHO] Sem mais paginas."); break; }
      }
    }

    log(`[CATHO] ${applied} enviadas`);
  } catch (err) {
    log(`[ERRO] Catho: ${err.message}`);
    await page.screenshot({ path: "/tmp/catho-error.png" });
  } finally {
    if (shouldCloseContext) await context.close();
    else await page.close();
  }
  return results;
}

async function doCathoLogin(page, email, senha) {
  log("[CATHO] Login...");
  await page.waitForSelector('input[type="email"], input[name*="email"]', { timeout: 10000 });
  await humanType(page, 'input[type="email"], input[name*="email"]', email);
  await humanType(page, 'input[type="password"]', senha);
  await page.click('button[type="submit"], button:has-text("Entrar")');
  await randomDelay(4000, 6000);
}

module.exports = { applyCatho };
