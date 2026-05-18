const { randomDelay, humanType } = require("../utils/delays");
const { log } = require("../utils/logger");

/**
 * InfoJobs Brasil automation
 * Login, search jobs, apply with "Candidatura simples" (Easy Apply equivalent)
 */
async function applyInfoJobs(browser, config) {
  const { email, senha, cargo, cidade, curriculoPath, limiteDiario } = config;
  const results = [];
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  try {
    log("[INFOJOBS] Acessando infojobs.com.br...");
    await page.goto("https://www.infojobs.com.br/login.aspx", { waitUntil: "domcontentloaded" });
    await randomDelay(2000, 4000);

    // Login
    log("[INFOJOBS] Fazendo login...");
    await page.waitForSelector('input[name*="email"], input[id*="email"], input[type="email"]', { timeout: 10000 });
    const emailInput = await page.$('input[name*="email"], input[id*="email"], input[type="email"]');
    const senhaInput = await page.$('input[type="password"]');

    if (emailInput && senhaInput) {
      await emailInput.click();
      await humanType(page, emailInput, email);
      await senhaInput.click();
      await humanType(page, senhaInput, senha);
      const loginBtn = await page.$('button[type="submit"], input[type="submit"], button:has-text("Entrar"), button:has-text("Login")');
      if (loginBtn) {
        await loginBtn.click();
        await page.waitForURL("**/infojobs.com.br/**", { timeout: 15000 }).catch(() => {});
        await randomDelay(3000, 5000);
        log("[INFOJOBS] Login OK");
      }
    } else {
      log("[INFOJOBS] Campos de login nao encontrados");
      return results;
    }

    // Search jobs
    log("[INFOJOBS] Buscando vagas...");
    const searchUrl = `https://www.infojobs.com.br/empregos.aspx?palabra=${encodeURIComponent(cargo || "gestor de trafego")}${cidade ? `&ubicacion=${encodeURIComponent(cidade)}` : ""}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
    await randomDelay(3000, 5000);

    // Main application loop across pages
    const maxTarget = limiteDiario || 100;
    let applied = 0;
    let pageNum = 1;

    while (applied < maxTarget && pageNum <= 20) {
      log(`[INFOJOBS] Processando pagina ${pageNum}...`);

      // Find job listing links
      const jobLinks = await page.$$('a[href*="/vaga-de-emprego/"], a[href*="/empregos/"]');
      const filteredLinks = [];
      for (const link of jobLinks) {
        const href = await link.getAttribute("href");
        if (href && href.includes("/vaga-de-emprego/") && !filteredLinks.includes(href)) {
          filteredLinks.push(href);
        }
      }

      log(`[INFOJOBS] ${filteredLinks.length} vagas na pagina ${pageNum}`);

      if (filteredLinks.length === 0) {
        log("[INFOJOBS] Nenhuma vaga encontrada. Fim.");
        break;
      }

      for (const jobUrl of filteredLinks) {
        if (applied >= maxTarget) break;

        try {
          log(`[INFOJOBS] Acessando vaga: ${jobUrl}`);
          const jobPage = await context.newPage();
          await jobPage.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
          await randomDelay(2000, 4000);

          // Look for "Candidatura simples" or "Candidatar-se" button
          const candidatarBtn = await jobPage.$(
            'button:has-text("Candidatura simples"), a:has-text("Candidatura simples"), button:has-text("Candidatar"), a:has-text("Candidatar"), button:has-text("Candidatar-se"), .candidatar-btn'
          );

          if (candidatarBtn) {
            await candidatarBtn.click();
            await randomDelay(2000, 4000);

            // Upload resume
            const fileInput = await jobPage.$('input[type="file"]');
            if (fileInput) {
              await fileInput.setInputFiles(curriculoPath);
              log(`[INFOJOBS] Curriculo anexado - vaga #${applied + 1}`);
              await randomDelay(1000, 2000);

              // Submit
              const submitBtn = await jobPage.$(
                'button[type="submit"], input[type="submit"], button:has-text("Enviar"), button:has-text("Finalizar"), button:has-text("Confirmar")'
              );
              if (submitBtn) {
                await submitBtn.click();
                applied++;
                log(`[OK] InfoJobs vaga #${applied} enviada`);
                results.push({ empresa: "InfoJobs", vaga: jobUrl.split("/").pop() || `vaga-${applied}`, plataforma: "InfoJobs", status: "enviado" });
              } else {
                results.push({ empresa: "InfoJobs", vaga: jobUrl.split("/").pop() || `vaga-${applied}`, plataforma: "InfoJobs", status: "sem_submit" });
              }
            } else {
              results.push({ empresa: "InfoJobs", vaga: jobUrl.split("/").pop() || `vaga-${applied}`, plataforma: "InfoJobs", status: "sem_file_input" });
            }
          } else {
            results.push({ empresa: "InfoJobs", vaga: jobUrl.split("/").pop() || `vaga-${applied}`, plataforma: "InfoJobs", status: "nao_suportado" });
          }

          await jobPage.close();
          await randomDelay(2000, 4000);
        } catch (jobErr) {
          log(`[ERRO] InfoJobs vaga: ${jobErr.message}`);
          results.push({ empresa: "InfoJobs", vaga: jobUrl.split("/").pop() || "unknown", plataforma: "InfoJobs", status: "falhou" });
        }
      }

      // Next page
      if (applied < maxTarget) {
        const nextBtn = await page.$('a[rel="next"], a:has-text("Proxima"), a:has-text("Seguinte"), .pagination-next');
        if (nextBtn) {
          await nextBtn.click();
          await randomDelay(3000, 5000);
          pageNum++;
        } else {
          log("[INFOJOBS] Sem mais paginas.");
          break;
        }
      }
    }

    log(`[INFOJOBS] Finalizado: ${applied} candidaturas enviadas`);

  } catch (err) {
    log(`[ERRO CRITICO] InfoJobs: ${err.message}`);
    await page.screenshot({ path: "/tmp/infojobs-error.png" });
  } finally {
    await context.close();
  }

  return results;
}

module.exports = { applyInfoJobs };
