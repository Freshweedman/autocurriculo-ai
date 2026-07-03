const { randomDelay } = require("../utils/delays");
const { log } = require("../utils/logger");

/**
 * Trabalha Brasil v2 — URL correta + seletores atualizados
 * https://www.trabalhabrasil.com.br
 */
async function applyTrabalhaBrasil(browser, config) {
  const { cargo, cidade, curriculoPath, limiteDiario } = config;
  const results = [];
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    locale: "pt-BR",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    // URL correta do Trabalha Brasil
    const q = encodeURIComponent(cargo || "marketing digital");
    const searchUrl = `https://www.trabalhabrasil.com.br/vagas-empregos/${q}`;
    log(`[TRABALHA_BRASIL] Buscando: ${searchUrl}`);

    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await randomDelay(3000, 5000);

    const maxTarget = Math.min(limiteDiario || 30, 30);
    let applied = 0;
    let pageNum = 1;
    const seenUrls = new Set();

    while (applied < maxTarget && pageNum <= 8) {
      log(`[TRABALHA_BRASIL] Pagina ${pageNum}...`);

      // Coleta hrefs de vagas
      const vagaInfos = await page.evaluate(() => {
        const results = [];
        const seen = new Set();
        // Seletores atuais do site
        const links = document.querySelectorAll(
          'h2.job-title a, h3.job-title a, .title a[href*="vaga"], ' +
          'a[href*="/vagas/"], a[href*="/vaga-de-"], ' +
          '.lista-vagas a, .vaga a[href], article a[href*="vaga"]'
        );
        links.forEach(el => {
          const href = el.getAttribute("href") || "";
          const title = el.textContent?.trim() || "";
          if (href && !seen.has(href)) {
            seen.add(href);
            results.push({ href, title });
          }
        });
        return results.slice(0, 20);
      });

      if (vagaInfos.length === 0) {
        log("[TRABALHA_BRASIL] Nenhuma vaga — tentando seletor alternativo...");
        // Tira screenshot para debug
        await page.screenshot({ path: "/tmp/trabalhabrasil-debug.png" }).catch(() => {});
        break;
      }

      log(`[TRABALHA_BRASIL] ${vagaInfos.length} vagas na pagina ${pageNum}`);

      for (const info of vagaInfos) {
        if (applied >= maxTarget) break;
        const { href, title } = info;
        const jobUrl = href.startsWith("http") ? href : `https://www.trabalhabrasil.com.br${href}`;

        if (seenUrls.has(jobUrl)) continue;
        seenUrls.add(jobUrl);

        try {
          const jobPage = await context.newPage();
          await jobPage.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
          await randomDelay(2000, 3500);

          // Empresa
          const empresa = await jobPage.$eval(
            '.company-name, .nome-empresa, [class*="company"], h2.empresa',
            el => el.textContent?.trim() || ""
          ).catch(() => "TrabalhaBrasil");

          // Botão candidatar
          const candidatarBtn = await jobPage.$(
            'a:has-text("Candidatar-se"), button:has-text("Candidatar-se"), ' +
            'a:has-text("Candidatar"), button:has-text("Candidatar"), ' +
            'a:has-text("Quero esta vaga"), a[class*="btn-candidatar"], ' +
            'button[class*="candidatar"], a[href*="candidatar"]'
          );

          if (candidatarBtn && await candidatarBtn.isVisible()) {
            await candidatarBtn.click();
            await randomDelay(2000, 4000);

            // Verifica se abriu página de login/cadastro
            const currentUrl = jobPage.url();
            if (currentUrl.includes("login") || currentUrl.includes("cadastro") || currentUrl.includes("entrar")) {
              results.push({ empresa, vaga: title || href, vaga_url: jobUrl, plataforma: "TrabalhaBrasil", status: "sem_login" });
              await jobPage.close();
              continue;
            }

            const fileInput = await jobPage.$('input[type="file"]').catch(() => null);
            if (fileInput && await fileInput.isVisible()) {
              await fileInput.setInputFiles(curriculoPath);
              await randomDelay(1000, 2000);
              const submitBtn = await jobPage.$('button[type="submit"], button:has-text("Enviar candidatura"), button:has-text("Enviar"), button:has-text("Confirmar")');
              if (submitBtn && await submitBtn.isVisible()) {
                await submitBtn.click();
                applied++;
                log(`[OK] TrabalhaBrasil #${applied}: ${empresa}`);
                results.push({ empresa, vaga: title || href, vaga_url: jobUrl, plataforma: "TrabalhaBrasil", status: "enviado" });
              } else {
                results.push({ empresa, vaga: title || href, vaga_url: jobUrl, plataforma: "TrabalhaBrasil", status: "sem_submit" });
              }
            } else {
              results.push({ empresa, vaga: title || href, vaga_url: jobUrl, plataforma: "TrabalhaBrasil", status: "sem_file_input" });
            }
          } else {
            results.push({ empresa, vaga: title || href, vaga_url: jobUrl, plataforma: "TrabalhaBrasil", status: "nao_suportado" });
          }

          await jobPage.close();
          await randomDelay(1500, 3000);
        } catch (e) {
          log(`[ERRO] TrabalhaBrasil: ${e.message}`);
          results.push({ empresa: "TrabalhaBrasil", vaga: href, vaga_url: jobUrl, plataforma: "TrabalhaBrasil", status: "falhou" });
        }
      }

      // Próxima página
      if (applied < maxTarget) {
        const nextBtn = await page.$('a[rel="next"], a:has-text("Próxima"), a:has-text("Próximo"), .pagination a:last-child, [aria-label="Next"]');
        if (nextBtn && await nextBtn.isVisible()) {
          await nextBtn.click();
          await page.waitForLoadState("domcontentloaded").catch(() => {});
          await randomDelay(3000, 5000);
          pageNum++;
        } else {
          log("[TRABALHA_BRASIL] Sem mais paginas.");
          break;
        }
      }
    }

    log(`[TRABALHA_BRASIL] ${applied} enviadas / ${results.length} processadas`);
  } catch (err) {
    log(`[ERRO] TrabalhaBrasil: ${err.message}`);
    await page.screenshot({ path: "/tmp/trabalhabrasil-error.png" }).catch(() => {});
  } finally {
    await context.close();
  }

  return results;
}

module.exports = { applyTrabalhaBrasil };
