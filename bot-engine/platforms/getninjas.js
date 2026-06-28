const { randomDelay, humanType } = require("../utils/delays");
const { log } = require("../utils/logger");

/**
 * GetNinjas automation
 * https://www.getninjas.com.br
 * Plataforma de servicos freelancer. Login obrigatorio.
 * Estrategia: buscar oportunidades na area, enviar interesse.
 */
async function applyGetNinjas(browser, authContext, config) {
  const { email, senha, session, cargo, cidade, limiteDiario } = config;
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
      await page.goto("https://www.getninjas.com.br", { waitUntil: "domcontentloaded", timeout: 30000 });
      await randomDelay(2000, 3000);
      const loginBtn = await page.$('a[href*="login"], a:has-text("Entrar")');
      if (loginBtn) {
        if (email && senha) await doGetNinjasLogin(page, email, senha);
        else { log("[GETNINJAS] Sem credenciais. Pulando."); return results; }
      } else {
        log("[GETNINJAS] Sessao ativa!");
      }
    } else if (email && senha) {
      await page.goto("https://www.getninjas.com.br/login", { waitUntil: "domcontentloaded", timeout: 30000 });
      await randomDelay(2000, 4000);
      await doGetNinjasLogin(page, email, senha);
    } else {
      log("[GETNINJAS] Sem credenciais. Pulando.");
      return results;
    }

    // Mapear cargo para segmento GetNinjas
    const segmentoMap = {
      "marketing": "marketing-digital",
      "trafego": "marketing-digital",
      "design": "design-grafico",
      "programacao": "desenvolvimento-web",
      "desenvolvedor": "desenvolvimento-web",
      "redacao": "redacao-e-revisao",
      "social media": "marketing-digital",
      "fotografo": "fotografia",
      "video": "edicao-de-video",
    };
    const cargoLower = (cargo || "marketing").toLowerCase();
    const segmento = Object.entries(segmentoMap).find(([k]) => cargoLower.includes(k))?.[1] || "marketing-digital";

    const searchUrl = `https://www.getninjas.com.br/oportunidades/${segmento}`;
    log(`[GETNINJAS] Buscando: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await randomDelay(3000, 5000);

    const maxTarget = Math.min(limiteDiario || 15, 15);
    let applied = 0;
    let pageNum = 1;

    while (applied < maxTarget && pageNum <= 5) {
      log(`[GETNINJAS] Pagina ${pageNum}...`);

      const jobLinks = await page.$$('a[href*="/oportunidade/"], a[href*="/pedido/"], .opportunity-card a, .card a');
      const hrefs = [];
      for (const l of jobLinks) {
        const h = await l.getAttribute("href");
        if (h && !hrefs.includes(h)) hrefs.push(h);
      }

      if (hrefs.length === 0) { log("[GETNINJAS] Fim."); break; }
      log(`[GETNINJAS] ${hrefs.length} oportunidades`);

      for (const href of hrefs) {
        if (applied >= maxTarget) break;
        try {
          const jobUrl = href.startsWith("http") ? href : `https://www.getninjas.com.br${href}`;
          const jobPage = await context.newPage();
          await jobPage.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
          await randomDelay(2000, 4000);

          const interestBtn = await jobPage.$(
            'button:has-text("Tenho interesse"), button:has-text("Enviar proposta"), a:has-text("Tenho interesse"), button:has-text("Quero este pedido")'
          );
          if (interestBtn) {
            await interestBtn.click();
            await randomDelay(2000, 4000);

            // Preencher mensagem se houver textarea
            const textarea = await jobPage.$('textarea');
            if (textarea) {
              const msg = `Ola! Tenho experiencia em ${cargo || "marketing digital"} e posso ajudar com este projeto. Estou disponivel para conversar sobre os detalhes e prazos.`;
              await textarea.click();
              await humanType(jobPage, 'textarea', msg);
              await randomDelay(1000, 2000);
            }

            const confirmBtn = await jobPage.$('button[type="submit"], button:has-text("Confirmar"), button:has-text("Enviar")');
            if (confirmBtn) {
              await confirmBtn.click();
              applied++;
              results.push({ empresa: "GetNinjas", vaga: jobUrl.split("/").pop() || `oportunidade-${applied}`, vaga_url: jobUrl, plataforma: "GetNinjas", status: "enviado" });
              log(`[OK] GetNinjas #${applied}`);
            } else {
              results.push({ empresa: "GetNinjas", vaga: jobUrl.split("/").pop(), vaga_url: jobUrl, plataforma: "GetNinjas", status: "sem_submit" });
            }
          } else {
            results.push({ empresa: "GetNinjas", vaga: jobUrl.split("/").pop(), vaga_url: jobUrl, plataforma: "GetNinjas", status: "nao_suportado" });
          }
          await jobPage.close();
          await randomDelay(3000, 6000);
        } catch (e) {
          log(`[ERRO] GetNinjas: ${e.message}`);
          results.push({ empresa: "GetNinjas", vaga: "unknown", vaga_url: null, plataforma: "GetNinjas", status: "falhou" });
        }
      }

      if (applied < maxTarget) {
        const next = await page.$('a[rel="next"], a:has-text("Proxima"), .pagination-next');
        if (next) { await next.click(); await randomDelay(3000, 5000); pageNum++; }
        else { log("[GETNINJAS] Sem mais paginas."); break; }
      }
    }

    log(`[GETNINJAS] ${applied} enviados`);
  } catch (err) {
    log(`[ERRO] GetNinjas: ${err.message}`);
    await page.screenshot({ path: "/tmp/getninjas-error.png" });
  } finally {
    if (shouldCloseContext) await context.close();
    else await page.close();
  }
  return results;
}

async function doGetNinjasLogin(page, email, senha) {
  log("[GETNINJAS] Login...");
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
  await humanType(page, 'input[type="email"], input[name="email"]', email);
  await humanType(page, 'input[type="password"]', senha);
  await page.click('button[type="submit"], button:has-text("Entrar")');
  await randomDelay(4000, 6000);
}

module.exports = { applyGetNinjas };
