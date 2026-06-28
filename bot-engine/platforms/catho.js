const { randomDelay, humanType } = require("../utils/delays");
const { log } = require("../utils/logger");

/**
 * Catho automation (v2 - fixed URL, vaga_url tracking, dedup-safe)
 * Catho: login required. Session mode NOT supported (not in setup-session.js).
 */
async function applyCatho(browser, authContext, config) {
  const { email, senha, cargo, cidade, curriculoPath, limiteDiario } = config;
  const results = [];

  if (!email || !senha) {
    log("[CATHO] Sem credenciais. Pulando.");
    return results;
  }

  let context = authContext;
  let shouldCloseContext = false;
  if (!context) {
    context = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: "pt-BR" });
    shouldCloseContext = true;
  }
  const page = await context.newPage();

  try {
    await page.goto("https://www.catho.com.br/login/", { waitUntil: "domcontentloaded", timeout: 30000 });
    await randomDelay(2000, 4000);
    await doCathoLogin(page, email, senha);

    // Fixed: use query params, not URL path segments for cidade
    const q = encodeURIComponent(cargo || "marketing");
    const locParam = cidade ? `&where=${encodeURIComponent(cidade)}` : "";
    const searchUrl = `https://www.catho.com.br/vagas/${q}/?${locParam ? locParam.slice(1) : ""}`;
    log(`[CATHO] Buscando: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await randomDelay(3000, 5000);

    const maxTarget = limiteDiario || 100;
    let applied = 0;
    let pageNum = 1;

    while (applied < maxTarget && pageNum <= 15) {
      log(`[CATHO] Pagina ${pageNum}...`);

      // Collect job links with titles
      const vagaInfos = await page.evaluate(() => {
        const links = document.querySelectorAll('a[href*="/vagas/"], a[href*="/emprego/"]');
        const seen = new Set();
        const result = [];
        for (const el of links) {
          const href = el.href;
          if (!href || seen.has(href)) continue;
          if (!href.includes("/vagas/") && !href.includes("/emprego/")) continue;
          seen.add(href);
          result.push({
            url: href,
            titulo: el.querySelector('h2, h3, [class*="title"]')?.textContent?.trim() || el.textContent?.trim()?.slice(0, 80) || "",
            empresa: el.closest('[class*="card"], [class*="item"]')?.querySelector('[class*="company"], [class*="empresa"]')?.textContent?.trim() || "Catho",
          });
        }
        return result.slice(0, 30);
      });

      if (vagaInfos.length === 0) { log("[CATHO] Fim."); break; }
      log(`[CATHO] ${vagaInfos.length} vagas`);

      for (const info of vagaInfos) {
        if (applied >= maxTarget) break;
        try {
          const jobPage = await context.newPage();
          await jobPage.goto(info.url, { waitUntil: "domcontentloaded", timeout: 20000 });
          await randomDelay(2000, 4000);

          const applyBtn = await jobPage.$(
            'button:has-text("Candidatar"), button:has-text("Candidatar-se"), ' +
            'a:has-text("Candidatar"), button:has-text("Quero esta vaga"), ' +
            'button:has-text("Me candidatar")'
          );
          if (applyBtn && await applyBtn.isVisible()) {
            await applyBtn.click();
            await randomDelay(2000, 4000);

            const fileInput = await jobPage.$('input[type="file"]');
            if (fileInput) {
              await fileInput.setInputFiles(curriculoPath);
              await randomDelay(1000, 2000);
              const submitBtn = await jobPage.$(
                'button[type="submit"], button:has-text("Enviar"), button:has-text("Confirmar"), button:has-text("Finalizar")'
              );
              if (submitBtn && await submitBtn.isVisible()) {
                await submitBtn.click();
                applied++;
                results.push({
                  empresa: info.empresa,
                  vaga: info.titulo || info.url,
                  vaga_url: info.url,
                  plataforma: "Catho",
                  status: "enviado",
                });
                log(`[OK] Catho #${applied}: ${info.empresa}`);
              } else {
                results.push({ empresa: info.empresa, vaga: info.titulo, vaga_url: info.url, plataforma: "Catho", status: "sem_submit" });
              }
            } else {
              // Some Catho jobs don't need file upload — try direct submit
              const directSubmit = await jobPage.$('button:has-text("Confirmar candidatura"), button:has-text("Candidatar com meu perfil")');
              if (directSubmit && await directSubmit.isVisible()) {
                await directSubmit.click();
                applied++;
                results.push({ empresa: info.empresa, vaga: info.titulo, vaga_url: info.url, plataforma: "Catho", status: "enviado" });
                log(`[OK] Catho #${applied}: ${info.empresa} (perfil direto)`);
              } else {
                results.push({ empresa: info.empresa, vaga: info.titulo, vaga_url: info.url, plataforma: "Catho", status: "sem_file_input" });
              }
            }
          } else {
            results.push({ empresa: info.empresa, vaga: info.titulo, vaga_url: info.url, plataforma: "Catho", status: "nao_suportado" });
          }
          await jobPage.close();
          await randomDelay(2000, 4000);
        } catch (e) {
          log(`[ERRO] Catho: ${e.message}`);
          results.push({ empresa: "Catho", vaga: info.url, vaga_url: info.url, plataforma: "Catho", status: "falhou" });
        }
      }

      if (applied < maxTarget) {
        const next = await page.$('a[rel="next"], a:has-text("Próxima"), button:has-text("Próxima"), .pagination-next, [aria-label="Próxima página"]');
        if (next) { await next.click(); await randomDelay(3000, 5000); pageNum++; }
        else { log("[CATHO] Sem mais paginas."); break; }
      }
    }

    log(`[CATHO] ${applied} enviadas`);
  } catch (err) {
    log(`[ERRO] Catho: ${err.message}`);
    await page.screenshot({ path: "/tmp/catho-error.png" }).catch(() => {});
  } finally {
    if (shouldCloseContext) await context.close();
    else await page.close();
  }
  return results;
}

async function doCathoLogin(page, email, senha) {
  log("[CATHO] Login...");
  for (const sel of ['input[type="email"]', 'input[name*="email"]', 'input[id*="email"]', 'input[autocomplete="email"]']) {
    const el = await page.$(sel);
    if (el && await el.isVisible()) { await el.fill(email); break; }
  }
  for (const sel of ['input[type="password"]', 'input[name*="password"]', 'input[name*="senha"]']) {
    const el = await page.$(sel);
    if (el && await el.isVisible()) { await el.fill(senha); break; }
  }
  const btn = await page.$('button[type="submit"], button:has-text("Entrar"), input[type="submit"]');
  if (btn) { await btn.click(); }
  await randomDelay(4000, 6000);
  log("[CATHO] Login submetido.");
}

module.exports = { applyCatho };
