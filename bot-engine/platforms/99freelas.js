const { randomDelay, humanType } = require("../utils/delays");
const { log } = require("../utils/logger");

/**
 * 99Freelas automation
 * https://www.99freelas.com.br
 * Plataforma de freelancer brasileira. Login obrigatorio.
 */
async function apply99Freelas(browser, authContext, config) {
  const { email, senha, session, cargo, limiteDiario } = config;
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
      await page.goto("https://www.99freelas.com.br", { waitUntil: "domcontentloaded", timeout: 30000 });
      await randomDelay(2000, 3000);
      const loginBtn = await page.$('a[href*="login"], a:has-text("Entrar")');
      if (loginBtn) {
        if (email && senha) await do99FreelasLogin(page, email, senha);
        else { log("[99FREELAS] Sem credenciais. Pulando."); return results; }
      } else {
        log("[99FREELAS] Sessao ativa!");
      }
    } else if (email && senha) {
      await page.goto("https://www.99freelas.com.br/login", { waitUntil: "domcontentloaded", timeout: 30000 });
      await randomDelay(2000, 4000);
      await do99FreelasLogin(page, email, senha);
    } else {
      log("[99FREELAS] Sem credenciais. Pulando.");
      return results;
    }

    // Mapear cargo para categoria 99Freelas
    const categoriaMap = {
      "marketing": "marketing-e-vendas",
      "trafego": "marketing-e-vendas",
      "design": "design-e-arte",
      "programacao": "tecnologia-e-programacao",
      "desenvolvedor": "tecnologia-e-programacao",
      "redacao": "redacao-e-traducao",
      "social media": "marketing-e-vendas",
      "video": "audio-e-video",
      "fotografo": "audio-e-video",
    };
    const cargoLower = (cargo || "marketing").toLowerCase();
    const categoria = Object.entries(categoriaMap).find(([k]) => cargoLower.includes(k))?.[1] || "marketing-e-vendas";

    const searchUrl = `https://www.99freelas.com.br/projects?category=${categoria}`;
    log(`[99FREELAS] Buscando: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await randomDelay(3000, 5000);

    const maxTarget = Math.min(limiteDiario || 15, 15);
    let applied = 0;
    let pageNum = 1;

    while (applied < maxTarget && pageNum <= 5) {
      log(`[99FREELAS] Pagina ${pageNum}...`);

      const jobLinks = await page.$$('a[href*="/project/"], a[href*="/projeto/"], .project-item a, .project-title a');
      const hrefs = [];
      for (const l of jobLinks) {
        const h = await l.getAttribute("href");
        if (h && !hrefs.includes(h)) hrefs.push(h);
      }

      if (hrefs.length === 0) { log("[99FREELAS] Fim."); break; }
      log(`[99FREELAS] ${hrefs.length} projetos`);

      for (const href of hrefs) {
        if (applied >= maxTarget) break;
        try {
          const jobUrl = href.startsWith("http") ? href : `https://www.99freelas.com.br${href}`;
          const jobPage = await context.newPage();
          await jobPage.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
          await randomDelay(2000, 4000);

          const propBtn = await jobPage.$(
            'button:has-text("Enviar proposta"), a:has-text("Enviar proposta"), button:has-text("Fazer proposta"), button:has-text("Candidatar")'
          );
          if (propBtn) {
            await propBtn.click();
            await randomDelay(2000, 4000);

            const textarea = await jobPage.$('textarea[name*="description"], textarea[name*="proposal"], textarea[placeholder*="proposta"], textarea');
            if (textarea) {
              const proposta = `Ola! Tenho experiencia em ${cargo || "marketing digital"} e estou interessado neste projeto. Posso entregar resultados de qualidade dentro do prazo combinado. Vamos conversar?`;
              await textarea.click();
              await humanType(jobPage, 'textarea', proposta);
              await randomDelay(1000, 2000);
            }

            const submitBtn = await jobPage.$('button[type="submit"], button:has-text("Enviar proposta"), button:has-text("Confirmar")');
            if (submitBtn) {
              await submitBtn.click();
              applied++;
              results.push({ empresa: "99Freelas", vaga: jobUrl.split("/").pop() || `projeto-${applied}`, plataforma: "99Freelas", status: "enviado" });
              log(`[OK] 99Freelas #${applied}`);
            } else {
              results.push({ empresa: "99Freelas", vaga: jobUrl.split("/").pop(), plataforma: "99Freelas", status: "sem_submit" });
            }
          } else {
            results.push({ empresa: "99Freelas", vaga: jobUrl.split("/").pop(), plataforma: "99Freelas", status: "nao_suportado" });
          }
          await jobPage.close();
          await randomDelay(3000, 6000);
        } catch (e) {
          log(`[ERRO] 99Freelas: ${e.message}`);
          results.push({ empresa: "99Freelas", vaga: "unknown", plataforma: "99Freelas", status: "falhou" });
        }
      }

      if (applied < maxTarget) {
        const next = await page.$('a[rel="next"], a:has-text("Proxima"), .pagination-next');
        if (next) { await next.click(); await randomDelay(3000, 5000); pageNum++; }
        else { log("[99FREELAS] Sem mais paginas."); break; }
      }
    }

    log(`[99FREELAS] ${applied} propostas enviadas`);
  } catch (err) {
    log(`[ERRO] 99Freelas: ${err.message}`);
    await page.screenshot({ path: "/tmp/99freelas-error.png" });
  } finally {
    if (shouldCloseContext) await context.close();
    else await page.close();
  }
  return results;
}

async function do99FreelasLogin(page, email, senha) {
  log("[99FREELAS] Login...");
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
  await humanType(page, 'input[type="email"], input[name="email"]', email);
  await humanType(page, 'input[type="password"]', senha);
  await page.click('button[type="submit"], button:has-text("Entrar")');
  await randomDelay(4000, 6000);
}

module.exports = { apply99Freelas };
