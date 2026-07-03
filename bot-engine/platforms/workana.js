const { randomDelay, humanType } = require("../utils/delays");
const { log } = require("../utils/logger");

// Palavras-chave relevantes para marketing/trafego
const PALAVRAS_RELEVANTES = [
  "trafego", "tráfego", "marketing", "ads", "google ads", "meta ads",
  "facebook ads", "instagram", "social media", "redes sociais", "performance",
  "roi", "roas", "campanha", "anuncio", "anúncio", "leads", "conversao",
  "conversão", "funil", "growth", "seo", "sem", "ppc", "media buyer",
  "gestor", "analista", "especialista", "digital", "inbound", "outbound",
  "copywriting", "copy", "landing page", "email marketing", "crm",
  "automacao", "automação", "vendas", "comercial", "prospeccao", "prospecção",
];

function projetoEhRelevante(titulo, cargo) {
  const tituloLower = (titulo || "").toLowerCase();
  const palavrasIrrelevantes = [
    "fotografia", "fotografo", "foto ", "ensaio", "casamento",
    "musica", "música", "mixagem", "masterizacao", "masterização",
    "arquitetura", "arquiteto", "planta baixa", "autocad", "marcenaria",
    "juridico", "jurídico", "advocacia", "advogado", "tcc", "monografia",
    "traducao", "tradução", "interprete", "intérprete",
    "contador", "contabilidade", "crc",
    "engenharia", "hidraulico", "hidráulico", "eletrico", "elétrico",
    "3d", "modelagem 3d", "pixar", "personagem",
    "pianista", "musico", "músico",
    "porcelanato", "andaime", "shell eco marathon", "carenagem",
    "tokenizacao", "blockchain", "smart contract", "rfid",
  ];
  if (palavrasIrrelevantes.some(p => tituloLower.includes(p))) return false;
  return PALAVRAS_RELEVANTES.some(p => tituloLower.includes(p));
}

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

          // Filtrar por relevancia pelo titulo da URL
          const tituloUrl = decodeURIComponent(jobUrl.split("/").pop() || "").replace(/-/g, " ");
          if (!projetoEhRelevante(tituloUrl, cargo)) {
            log(`[WORKANA] Pulando irrelevante: ${tituloUrl.slice(0, 60)}`);
            continue;
          }

          const jobPage = await context.newPage();
          await jobPage.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
          await randomDelay(2000, 4000);

          // Debug: logar todos os botoes visiveis na pagina
          const botoesVisiveis = await jobPage.evaluate(() => {
            const btns = document.querySelectorAll('button, a[class*="btn"], a[class*="button"]');
            return Array.from(btns)
              .filter(b => b.offsetParent !== null)
              .map(b => b.textContent?.trim().slice(0, 50))
              .filter(Boolean)
              .slice(0, 10);
          });
          log(`[WORKANA] Botoes na pagina: ${botoesVisiveis.join(' | ')}`);

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
            // Espera o modal/formulário aparecer — até 8 segundos
            await randomDelay(2000, 3000);

            // Aguarda textarea ficar visível
            let textareaEl = null;
            for (let t = 0; t < 8; t++) {
              const candidates = await jobPage.$$('textarea');
              for (const c of candidates) {
                if (await c.isVisible().catch(() => false)) { textareaEl = c; break; }
              }
              if (textareaEl) break;
              await randomDelay(1000, 1500);
            }

            let textareaFilled = false;
            if (textareaEl) {
              const proposta = `Ola! Sou especialista em ${cargo || "marketing digital"} com experiencia em gestao de trafego pago (Facebook Ads, Google Ads, TikTok Ads). Tenho interesse neste projeto e posso entregar resultados dentro do prazo. Vamos conversar sobre os detalhes?`;
              await textareaEl.click();
              await randomDelay(300, 600);
              await textareaEl.fill(proposta);
              textareaFilled = true;
              log(`[WORKANA] Proposta preenchida`);
            } else {
              log(`[WORKANA] Textarea nao encontrado`);
            }

            await randomDelay(800, 1500);

            // Curriculo se disponível
            const fileInput = await jobPage.$('input[type="file"]').catch(() => null);
            if (fileInput && curriculoPath) {
              await fileInput.setInputFiles(curriculoPath).catch(() => {});
              await randomDelay(800, 1500);
            }

            // Valor da proposta — preenche com valor mínimo se houver campo
            const valueInput = await jobPage.$('input[name*="amount"], input[name*="value"], input[name*="budget"], input[placeholder*="valor"], input[placeholder*="R$"]').catch(() => null);
            if (valueInput && await valueInput.isVisible().catch(() => false)) {
              await valueInput.fill("500");
              await randomDelay(300, 600);
            }

            // Submit — espera até 5 segundos
            let submitted = false;
            for (let t = 0; t < 5; t++) {
              const submitBtn = await jobPage.$(
                '[role="dialog"] button[type="submit"], .modal button[type="submit"], ' +
                'button:has-text("Enviar proposta"), button:has-text("Confirmar"), ' +
                'button:has-text("Send"), button:has-text("Submit"), ' +
                'form button[type="submit"]'
              );
              if (submitBtn && await submitBtn.isVisible().catch(() => false)) {
                await submitBtn.click();
                submitted = true;
                break;
              }
              await randomDelay(1000, 1500);
            }

            if (submitted) {
              await randomDelay(2000, 3000);
              applied++;
              results.push({ empresa: "Workana", vaga: jobUrl.split("/").pop() || `projeto-${applied}`, vaga_url: jobUrl, plataforma: "Workana", status: "enviado" });
              log(`[OK] Workana proposta #${applied}`);
            } else {
              results.push({ empresa: "Workana", vaga: jobUrl.split("/").pop(), vaga_url: jobUrl, plataforma: "Workana", status: textareaFilled ? "sem_submit" : "sem_textarea" });
            }
          } else {
            results.push({ empresa: "Workana", vaga: jobUrl.split("/").pop(), vaga_url: jobUrl, plataforma: "Workana", status: "nao_suportado" });
          }
          await jobPage.close();
          await randomDelay(3000, 6000);
        } catch (e) {
          log(`[ERRO] Workana: ${e.message}`);
          results.push({ empresa: "Workana", vaga: "unknown", vaga_url: null, plataforma: "Workana", status: "falhou" });
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
