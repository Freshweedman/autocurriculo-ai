const { randomDelay, humanType } = require("../utils/delays");
const { log } = require("../utils/logger");

async function applyInfoJobs(browser, authContext, config) {
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
      log("[INFOJOBS] Modo sessao - verificando...");
      await page.goto("https://www.infojobs.com.br", { waitUntil: "domcontentloaded" });
      await randomDelay(2000, 3000);

      // Check if login is needed
      const loginLink = await page.$('a[href*="login"], a:has-text("Entrar"), a:has-text("Login")');
      if (loginLink) {
        log("[INFOJOBS] Sessao expirada! Fallback email/senha...");
        if (email && senha) {
          await doInfoJobsLogin(page, email, senha);
        } else {
          log("[INFOJOBS] Sem fallback. Pulando.");
          return results;
        }
      } else {
        log("[INFOJOBS] Sessao Google ativa!");
      }
    } else {
      log("[INFOJOBS] Acessando...");
      await page.goto("https://www.infojobs.com.br/login.aspx", { waitUntil: "domcontentloaded" });
      await randomDelay(2000, 4000);
      await doInfoJobsLogin(page, email, senha);
    }

    // Search
    log("[INFOJOBS] Buscando vagas...");
    const searchUrl = `https://www.infojobs.com.br/empregos.aspx?palabra=${encodeURIComponent(cargo || "gestor de trafego")}${cidade ? `&ubicacion=${encodeURIComponent(cidade)}` : ""}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
    await randomDelay(3000, 5000);

    const maxTarget = limiteDiario || 100;
    let applied = 0;
    let pageNum = 1;

    while (applied < maxTarget && pageNum <= 20) {
      log(`[INFOJOBS] Pagina ${pageNum}...`);

      const jobLinks = await page.$$('a[href*="/vaga-de-emprego/"], a[href*="/empregos/"]');
      const filteredLinks = [];
      for (const link of jobLinks) {
        const href = await link.getAttribute("href");
        if (href && href.includes("/vaga-de-emprego/") && !filteredLinks.includes(href)) {
          filteredLinks.push(href);
        }
      }

      if (filteredLinks.length === 0) { log("[INFOJOBS] Fim."); break; }
      log(`[INFOJOBS] ${filteredLinks.length} vagas`);

      for (const jobUrl of filteredLinks) {
        if (applied >= maxTarget) break;
        try {
          const jobPage = await context.newPage();
          await jobPage.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
          await randomDelay(2000, 4000);

          const candidatarBtn = await jobPage.$(
            'button:has-text("Candidatura simples"), a:has-text("Candidatura simples"), button:has-text("Candidatar"), a:has-text("Candidatar"), button:has-text("Candidatar-se")'
          );

          if (candidatarBtn) {
            await candidatarBtn.click();
            await randomDelay(2000, 4000);

            const fileInput = await jobPage.$('input[type="file"]');
            if (fileInput) {
              await fileInput.setInputFiles(curriculoPath);
              log(`[INFOJOBS] CV #${applied + 1}`);
              await randomDelay(1000, 2000);

              const submitBtn = await jobPage.$('button[type="submit"], input[type="submit"], button:has-text("Enviar"), button:has-text("Finalizar")');
              if (submitBtn) {
                await submitBtn.click();
                applied++;
                results.push({ empresa: "InfoJobs", vaga: `infojobs-${applied}`, plataforma: "InfoJobs", status: "enviado" });
              } else {
                results.push({ empresa: "InfoJobs", vaga: `infojobs-${applied + 1}`, plataforma: "InfoJobs", status: "sem_submit" });
              }
            } else {
              results.push({ empresa: "InfoJobs", vaga: `infojobs-${applied + 1}`, plataforma: "InfoJobs", status: "sem_file_input" });
            }
          } else {
            results.push({ empresa: "InfoJobs", vaga: `infojobs-${applied + 1}`, plataforma: "InfoJobs", status: "nao_suportado" });
          }

          await jobPage.close();
          await randomDelay(2000, 4000);
        } catch (jobErr) {
          log(`[ERRO] InfoJobs: ${jobErr.message}`);
          results.push({ empresa: "InfoJobs", vaga: "unknown", plataforma: "InfoJobs", status: "falhou" });
        }
      }

      if (applied < maxTarget) {
        const nextBtn = await page.$('a[rel="next"], a:has-text("Proxima"), a:has-text("Seguinte")');
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
    await page.screenshot({ path: "/tmp/infojobs-error.png" });
  } finally {
    if (shouldCloseContext) await context.close();
    else await page.close();
  }

  return results;
}

async function doInfoJobsLogin(page, email, senha) {
  log("[INFOJOBS] Login email/senha...");
  await page.waitForSelector('input[type="email"], input[name*="email"]', { timeout: 10000 });
  // Usa fill direto em vez de humanType para evitar erro de tipo
  await page.fill('input[type="email"], input[name*="email"]', email);
  await page.fill('input[type="password"]', senha);
  const loginBtn = await page.$('button[type="submit"], input[type="submit"], button:has-text("Entrar")');
  if (loginBtn) {
    await loginBtn.click();
    await page.waitForURL("**/infojobs.com.br/**", { timeout: 15000 }).catch(() => {});
    await randomDelay(3000, 5000);
  }
}

module.exports = { applyInfoJobs };
