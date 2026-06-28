const { randomDelay, humanType } = require("../utils/delays");
const { log } = require("../utils/logger");

/**
 * Sine automation
 * https://www.sine.com.br
 * Plataforma governamental/popular. Login obrigatorio.
 */
async function applySine(browser, authContext, config) {
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
      await page.goto("https://www.sine.com.br", { waitUntil: "domcontentloaded", timeout: 30000 });
      await randomDelay(2000, 3000);
      const loginBtn = await page.$('a[href*="login"], a:has-text("Entrar")');
      if (loginBtn) {
        if (email && senha) await doSineLogin(page, email, senha);
        else { log("[SINE] Sem credenciais. Pulando."); return results; }
      } else {
        log("[SINE] Sessao ativa!");
      }
    } else if (email && senha) {
      await page.goto("https://www.sine.com.br/login", { waitUntil: "domcontentloaded", timeout: 30000 });
      await randomDelay(2000, 4000);
      await doSineLogin(page, email, senha);
    } else {
      log("[SINE] Sem credenciais. Pulando.");
      return results;
    }

    const q = encodeURIComponent(cargo || "marketing");
    const loc = cidade ? `&cidade=${encodeURIComponent(cidade)}` : "";
    const searchUrl = `https://www.sine.com.br/vagas?q=${q}${loc}`;
    log(`[SINE] Buscando: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await randomDelay(3000, 5000);

    const maxTarget = limiteDiario || 100;
    let applied = 0;
    let pageNum = 1;

    while (applied < maxTarget && pageNum <= 15) {
      log(`[SINE] Pagina ${pageNum}...`);

      const jobLinks = await page.$$('a[href*="/vaga/"], a[href*="/vagas/"], .job-card a, .vaga a');
      const hrefs = [];
      for (const l of jobLinks) {
        const h = await l.getAttribute("href");
        if (h && !hrefs.includes(h)) hrefs.push(h);
      }

      if (hrefs.length === 0) { log("[SINE] Fim."); break; }
      log(`[SINE] ${hrefs.length} vagas`);

      for (const href of hrefs) {
        if (applied >= maxTarget) break;
        try {
          const jobUrl = href.startsWith("http") ? href : `https://www.sine.com.br${href}`;
          const jobPage = await context.newPage();
          await jobPage.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
          await randomDelay(2000, 4000);

          const applyBtn = await jobPage.$(
            'button:has-text("Candidatar"), button:has-text("Me candidatar"), a:has-text("Candidatar"), button:has-text("Quero esta vaga")'
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
                results.push({ empresa: "Sine", vaga: jobUrl.split("/").pop() || `vaga-${applied}`, vaga_url: jobUrl, plataforma: "Sine", status: "enviado" });
                log(`[OK] Sine #${applied}`);
              } else {
                results.push({ empresa: "Sine", vaga: jobUrl.split("/").pop(), vaga_url: jobUrl, plataforma: "Sine", status: "sem_submit" });
              }
            } else {
              results.push({ empresa: "Sine", vaga: jobUrl.split("/").pop(), vaga_url: jobUrl, plataforma: "Sine", status: "sem_file_input" });
            }
          } else {
            results.push({ empresa: "Sine", vaga: jobUrl.split("/").pop(), vaga_url: jobUrl, plataforma: "Sine", status: "nao_suportado" });
          }
          await jobPage.close();
          await randomDelay(2000, 4000);
        } catch (e) {
          log(`[ERRO] Sine: ${e.message}`);
          results.push({ empresa: "Sine", vaga: "unknown", vaga_url: null, plataforma: "Sine", status: "falhou" });
        }
      }

      if (applied < maxTarget) {
        const next = await page.$('a[rel="next"], a:has-text("Proxima"), .pagination-next');
        if (next) { await next.click(); await randomDelay(3000, 5000); pageNum++; }
        else { log("[SINE] Sem mais paginas."); break; }
      }
    }

    log(`[SINE] ${applied} enviadas`);
  } catch (err) {
    log(`[ERRO] Sine: ${err.message}`);
    await page.screenshot({ path: "/tmp/sine-error.png" });
  } finally {
    if (shouldCloseContext) await context.close();
    else await page.close();
  }
  return results;
}

async function doSineLogin(page, email, senha) {
  log("[SINE] Login...");
  await page.waitForSelector('input[type="email"], input[name*="email"]', { timeout: 10000 });
  await humanType(page, 'input[type="email"], input[name*="email"]', email);
  await humanType(page, 'input[type="password"]', senha);
  await page.click('button[type="submit"], button:has-text("Entrar")');
  await randomDelay(4000, 6000);
}

module.exports = { applySine };
