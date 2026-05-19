/**
 * AutoCurriculo AI - Profile Filler v3
 *
 * Voce faz login manualmente, o script preenche os campos
 * usando busca inteligente por label/placeholder/aria-label.
 *
 * Uso: node fill-profiles.js
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const os = require("os");
const readline = require("readline");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { log } = require("./utils/logger");
const { randomDelay } = require("./utils/delays");

// ─── Dados do perfil ──────────────────────────────────────────────────────────

const PERFIL = {
  nome:     "Juan Goes",
  email:    "emailjg4@gmail.com",
  telefone: "(51) 98468-9725",
  cidade:   "Porto Alegre",
  estado:   "RS",
  cargo:    "Gestor de Tráfego Pago | Performance & Growth",
  resumo:   "Profissional de Performance e Tráfego Pago com 6 anos de experiência. Especialista em estratégias avançadas de aquisição, otimização e escala (Facebook, TikTok e Google Ads), com foco total em ROI/ROAS e crescimento previsível. Construção de funis de alta conversão e análise de dados estratégica. Pioneiro no uso de IA (ChatGPT/Claude) para criação de ativos e automação de processos.",
  habilidades: ["Facebook Ads", "TikTok Ads", "Google Ads", "Funis de conversão", "Copywriting", "Landing Pages", "Automações", "ROI/ROAS"],
};

// ─── Plataformas ──────────────────────────────────────────────────────────────

const PLATAFORMAS = [
  { nome: "LinkedIn",  loginUrl: "https://www.linkedin.com/login",              perfilUrl: "https://www.linkedin.com/in/me/",                        fn: fillLinkedIn  },
  { nome: "InfoJobs",  loginUrl: "https://www.infojobs.com.br/login.aspx",       perfilUrl: "https://www.infojobs.com.br/candidate/curriculum/edit/",  fn: fillGenerico  },
  { nome: "Catho",     loginUrl: "https://www.catho.com.br/login/",              perfilUrl: "https://www.catho.com.br/area-candidato/curriculo/",       fn: fillGenerico  },
  { nome: "Workana",   loginUrl: "https://www.workana.com/pt/login",             perfilUrl: "https://www.workana.com/pt/freelancer/edit",              fn: fillGenerico  },
  { nome: "GetNinjas", loginUrl: "https://www.getninjas.com.br/entrar",          perfilUrl: "https://www.getninjas.com.br/perfil/editar",              fn: fillGenerico  },
  { nome: "99Freelas", loginUrl: "https://www.99freelas.com.br/login",           perfilUrl: "https://www.99freelas.com.br/user/profile/edit",          fn: fillGenerico  },
];

// ─── Helper: aguarda ENTER ────────────────────────────────────────────────────

function aguardarEnter(msg) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(msg, () => { rl.close(); resolve(); });
  });
}

// ─── Helper: preenche campo por texto do label ────────────────────────────────

async function preencherCampo(page, termos, valor, tipo = "input") {
  // Tenta encontrar campo pelo placeholder, aria-label, name, id ou label associado
  const termosLower = termos.map(t => t.toLowerCase());

  const resultado = await page.evaluate(({ termosLower, valor, tipo }) => {
    const elementos = document.querySelectorAll(
      tipo === "textarea" ? "textarea" : 'input:not([type="hidden"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"])'
    );

    for (const el of elementos) {
      if (el.offsetParent === null) continue; // ignora elementos ocultos

      const textos = [
        el.placeholder || "",
        el.getAttribute("aria-label") || "",
        el.getAttribute("name") || "",
        el.getAttribute("id") || "",
        el.getAttribute("data-testid") || "",
        // Tenta pegar o label associado
        document.querySelector(`label[for="${el.id}"]`)?.textContent || "",
      ].map(t => t.toLowerCase());

      const match = termosLower.some(termo => textos.some(t => t.includes(termo)));
      if (match) {
        // Limpa e preenche
        el.focus();
        el.value = "";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.value = valor;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return { encontrado: true, campo: el.name || el.id || el.placeholder };
      }
    }
    return { encontrado: false };
  }, { termosLower, valor, tipo });

  if (resultado.encontrado) {
    log(`  ✓ Campo "${resultado.campo}" preenchido`);
  }
  return resultado.encontrado;
}

// ─── Helper: clica em botao por texto ────────────────────────────────────────

async function clicarBotao(page, textos) {
  for (const texto of textos) {
    try {
      const btn = await page.$(`button:has-text("${texto}"), input[value="${texto}"]`);
      if (btn) {
        await btn.click();
        log(`  ✓ Botao "${texto}" clicado`);
        return true;
      }
    } catch (_) {}
  }
  return false;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log("=== AutoCurriculo AI - Preenchimento de Perfis v3 ===");
  log(`Nome: ${PERFIL.nome} | Cargo: ${PERFIL.cargo}`);
  log("");
  log("Para cada plataforma:");
  log("  1. O navegador abre a pagina de login");
  log("  2. Voce faz login manualmente");
  log("  3. Pressiona ENTER no terminal");
  log("  4. O script preenche o perfil automaticamente");
  log("");

  const chromePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(os.homedir(), "AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"),
  ];
  const executablePath = chromePaths.find((p) => fs.existsSync(p));

  const browser = await chromium.launch({
    headless: false,
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    locale: "pt-BR",
  });

  const resultados = [];

  for (const plataforma of PLATAFORMAS) {
    log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    log(`  ${plataforma.nome}`);
    log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    try {
      const page = await context.newPage();
      await page.goto(plataforma.loginUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await randomDelay(2000, 3000);

      await aguardarEnter(`[${plataforma.nome}] Faca login no navegador e pressione ENTER... `);

      log(`[${plataforma.nome}] Preenchendo perfil...`);
      await plataforma.fn(page, PERFIL, plataforma);
      await page.close();

      resultados.push({ nome: plataforma.nome, status: "ok" });
      log(`[${plataforma.nome}] ✓ Concluido`);
    } catch (err) {
      log(`[${plataforma.nome}] ✗ Erro: ${err.message.split("\n")[0]}`);
      resultados.push({ nome: plataforma.nome, status: "erro", erro: err.message.split("\n")[0] });
    }

    await randomDelay(2000, 3000);
  }

  log("\n=== RESULTADO FINAL ===");
  for (const r of resultados) {
    log(`${r.status === "ok" ? "✓" : "✗"} ${r.nome}: ${r.status}${r.erro ? ` — ${r.erro}` : ""}`);
  }

  await aguardarEnter("\nPressione ENTER para fechar o navegador... ");
  await browser.close();
}

// ─── LinkedIn (tratamento especial pois usa React com estado) ─────────────────

async function fillLinkedIn(page, p) {
  await page.goto("https://www.linkedin.com/in/me/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await randomDelay(3000, 5000);

  // Clicar no botao de editar introducao (icone de lapis)
  const editIntroBtn = await page.$(
    'button[aria-label*="Editar introducao"], button[aria-label*="Edit intro"], ' +
    'button[aria-label*="Edit introduction"], .pv-top-card__edit-btn, ' +
    'button.artdeco-button--circle[aria-label*="Edit"]'
  );

  if (!editIntroBtn) {
    log("[LINKEDIN] Botao editar nao encontrado. Tente clicar no lapis do perfil manualmente.");
    await aguardarEnter("Clique no lapis de edicao do perfil e pressione ENTER... ");
  } else {
    await editIntroBtn.click();
    await randomDelay(2000, 3000);
  }

  // Preencher headline/titulo usando keyboard para garantir que React detecta
  const headlineInput = await page.$('input[id*="headline"], input[name*="headline"], input[id*="title"]');
  if (headlineInput) {
    await headlineInput.click({ clickCount: 3 });
    await page.keyboard.type(p.cargo, { delay: 30 });
    log("  ✓ Headline preenchido");
  }

  // Salvar
  await clicarBotao(page, ["Salvar", "Save"]);
  await randomDelay(2000, 3000);

  // Agora editar o resumo "Sobre"
  await page.goto("https://www.linkedin.com/in/me/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await randomDelay(3000, 5000);

  const aboutEditBtn = await page.$(
    'button[aria-label*="Editar sobre"], button[aria-label*="Edit about"], ' +
    'section[data-section="summary"] button, #about ~ * button'
  );

  if (aboutEditBtn) {
    await aboutEditBtn.click();
    await randomDelay(2000, 3000);

    const aboutField = await page.$('textarea[id*="summary"], div[contenteditable="true"][data-placeholder]');
    if (aboutField) {
      await aboutField.click({ clickCount: 3 });
      await page.keyboard.press("Control+a");
      await page.keyboard.type(p.resumo, { delay: 10 });
      log("  ✓ Resumo preenchido");
      await clicarBotao(page, ["Salvar", "Save"]);
      await randomDelay(2000, 3000);
    }
  }
}

// ─── Generico (InfoJobs, Catho, Workana, GetNinjas, 99Freelas) ────────────────

async function fillGenerico(page, p, plataforma) {
  await page.goto(plataforma.perfilUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await randomDelay(3000, 5000);

  // Tira screenshot para debug
  const screenshotPath = `/tmp/${plataforma.nome.toLowerCase()}-perfil.png`;
  await page.screenshot({ path: screenshotPath }).catch(() => {});

  // Preenche campos por termos relacionados
  await preencherCampo(page, ["nome", "name", "full name", "nome completo"], p.nome);
  await preencherCampo(page, ["telefone", "phone", "celular", "mobile", "whatsapp"], p.telefone);
  await preencherCampo(page, ["cargo", "titulo", "title", "headline", "profissao", "ocupacao", "objetivo"], p.cargo);
  await preencherCampo(page, ["cidade", "city", "location", "localizacao", "municipio"], p.cidade);

  // Textarea para resumo/bio
  await preencherCampo(page, ["resumo", "sobre", "bio", "about", "summary", "descricao", "apresentacao", "perfil"], p.resumo, "textarea");

  // Tenta salvar
  const salvou = await clicarBotao(page, ["Salvar", "Salvar alterações", "Atualizar", "Save", "Update", "Confirmar"]);
  if (!salvou) {
    // Tenta submit do formulario
    await page.evaluate(() => {
      const form = document.querySelector("form");
      if (form) form.submit();
    });
  }

  await randomDelay(3000, 5000);
}

main().catch((err) => {
  console.error("Erro fatal:", err.message);
  process.exit(1);
});
