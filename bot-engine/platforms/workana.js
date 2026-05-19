const { randomDelay, humanType } = require("../utils/delays");
const { log } = require("../utils/logger");

/**
 * Workana automation
 * https://www.workana.com/pt
 * Maior plataforma de freelancer da America Latina.
 * Estrategia: login, buscar projetos, enviar proposta com texto padrao.
 */
async function applyWorkana(browser, authContext, config) {
  const { email, senha, session, cargo, curriculoPath, limiteDiario } = config;
  const results = [];

  let context = authContext;
  let shouldCloseContext = false;
  if (!context) {
    context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      locale: "pt-BR",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    });
    shouldCloseContext = true;
  }
  const page = await context.newPage();

  try {
    if (session) {
      await page.goto("https://www.workana.com/pt", { waitUntil: "domcontentloaded", timeout: 30000 });
      await randomDelay(2000, 3000);
      const loginBtn = await page.$('a[href*="login"], a:has-text("Entrar")');
      if (loginBtn) {
        if (email && senha) await doWorkanaLogin(page, email, senha);
        else { log("[WORKANA] Sem credenciais. Pulando."); return results; }
      } else {
        log("[WORKANA] Sessao ativa!");
      }
    } else if (email && senha) {
      await page.goto("https://www.workana.com/pt/login", { waitUntil: "domcontentloaded", timeout: 30000 });
      await randomDelay(2000, 4000);
      await doWorkanaLogin(page, email, senha);
    } else {
      log("[WORKANA] Sem credenciais. Pulando.");
      return results;
    }

    // Mapear cargo para categoria Workana
    const categoriaMap = {
      "marketing": "marketing-vendas",
      "trafego": "marketing-vendas",
      "design": "design-multimedia",
      "programacao": "ti-programacao",
      "desenvolvedor": "ti-programacao",
      "redacao": "redacao-conteudo",
      "traducao": "traducao",
      "financeiro": "financas-administracao",
    };
    const cargoLower = (cargo || "marketing").toLowerCase();
    const categoria = Object.entries(categoriaMap).find(([k]) => cargoLower.includes(k))?.[1] || "marketing-vendas";

    const searchUrl = `https://www.workana.com/pt/jobs?category=${categoria}&language=pt`;
    log(`[WORKANA] Buscando: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await randomDelay(3000, 5000);

    const maxTarget = Math.min(limiteDiario || 20, 20); // Workana tem limite de propostas
    let applied = 0;
    let pageNum = 1;

    while (applied < maxTarget && pageNum <= 5) {
      log(`[WORKANA] Pagina ${pageNum}...`);

      const jobLinks = await page.$$('a[href*="/pt/job/"], a[href*="/job/"]');
      const hrefs = [];
      for (const l of jobLinks) {
        const h = await l.getAttribute("href");
        if (h && (h.includes("/pt/job/") || h.includes("/job/")) && !hrefs.includes(h)) hrefs.push(h);
      }

      if (hrefs.length === 0) { log("[WORKANA] Fim."); break; }
      log(`[WORKANA] ${hrefs.length} projetos`);

      for (const href of hrefs) {
        if (applied >= maxTarget) break;
        try {
          const jobUrl = href.startsWith("http") ? href : `https://www.workana.com${href}`;
          const jobPage = await context.newPage();
          await jobPage.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
          await randomDelay(2000, 4000);

          // Botao de proposta — Workana usa varios textos dependendo do idioma/plano
          const propBtn = await jobPage.$(
            'button:has-text("Enviar proposta"), a:has-text("Enviar proposta"), ' +
            'button:has-text("Fazer proposta"), button:has-text("Submit proposal"), ' +
            'button:has-text("Send proposal"), a:has-text("Send proposal"), ' +
            'button:has-text("Aplicar"), a:has-text("Aplicar"), ' +
            'button:has-text("Apply"), a:has-text("Apply"), ' +
            '[data-testid*="proposal"], [data-testid*="apply"]'
          );
          if (propBtn) {
            log(`[WORKANA] Botao proposta encontrado`);
            await propBtn.click();
            await randomDelay(2000, 4000);

            // Preencher proposta — tenta varios seletores de textarea
            const textareaSelectors = [
              'textarea[name*="proposal"]',
              'textarea[name*="message"]',
              'textarea[name*="description"]',
              'textarea[placeholder*="proposta"]',
              'textarea[placeholder*="descri"]',
              'textarea[placeholder*="proposal"]',
              'textarea',
            ];
            let textareaFilled = false;
            for (const sel of textareaSelectors) {
              const textarea = await jobPage.$(sel);
              if (textarea) {
                const proposta = `Ola! Sou especialista em ${cargo || "marketing digital"} com 6 anos de experiencia. Tenho interesse neste projeto e posso entregar resultados de qualidade dentro do prazo. Vamos conversar sobre os detalhes?`;
                await textarea.fill(proposta);
                textareaFilled = true;
                break;
              }
            }
            if (!textareaFilled) log(`[WORKANA] Textarea nao encontrado`);
            await randomDelay(1000, 2000);

            // Anexar curriculo se houver input
            const fileInput = await jobPage.$('input[type="file"]');
            if (fileInput && curriculoPath) {
              await fileInput.setInputFiles(curriculoPath);
              await randomDelay(1000, 2000);
            }

            const submitBtn = await jobPage.$('button[type="submit"], button:has-text("Enviar"), button:has-text("Confirmar proposta")');
            if (submitBtn) {
              await submitBtn.click();
              applied++;
              results.push({ empresa: "Workana", vaga: jobUrl.split("/").pop() || `projeto-${applied}`, plataforma: "Workana", status: "enviado" });
              log(`[OK] Workana proposta #${applied}`);
            } else {
              results.push({ empresa: "Workana", vaga: jobUrl.split("/").pop(), plataforma: "Workana", status: "sem_submit" });
            }
          } else {
            results.push({ empresa: "Workana", vaga: jobUrl.split("/").pop(), plataforma: "Workana", status: "nao_suportado" });
          }
          await jobPage.close();
          await randomDelay(3000, 6000);
        } catch (e) {
          log(`[ERRO] Workana: ${e.message}`);
          results.push({ empresa: "Workana", vaga: "unknown", plataforma: "Workana", status: "falhou" });
        }
      }

      if (applied < maxTarget) {
        const next = await page.$('a[rel="next"], a:has-text("Proxima"), .pagination-next, a[aria-label="Next"]');
        if (next) { await next.click(); await randomDelay(3000, 5000); pageNum++; }
        else { log("[WORKANA] Sem mais paginas."); break; }
      }
    }

    log(`[WORKANA] ${applied} propostas enviadas`);
  } catch (err) {
    log(`[ERRO] Workana: ${err.message}`);
    await page.screenshot({ path: "/tmp/workana-error.png" });
  } finally {
    if (shouldCloseContext) await context.close();
    else await page.close();
  }
  return results;
}

async function doWorkanaLogin(page, email, senha) {
  log("[WORKANA] Login...");
  // Fechar modal de cookies se aparecer
  await randomDelay(2000, 3000);
  const cookieBtn = await page.$('button:has-text("Aceitar"), button:has-text("Accept"), button[id*="accept"]');
  if (cookieBtn) { await cookieBtn.click(); await randomDelay(1000, 2000); }

  // Preencher login
  const emailSelectors = ['input[type="email"]', 'input[name="email"]', 'input[id*="email"]'];
  for (const sel of emailSelectors) {
    const el = await page.$(sel);
    if (el) { await page.fill(sel, email); break; }
  }
  await page.fill('input[type="password"]', senha).catch(() => {});
  await page.click('button[type="submit"], button:has-text("Entrar"), input[type="submit"]').catch(() => {});
  await randomDelay(4000, 6000);
}

module.exports = { applyWorkana };
