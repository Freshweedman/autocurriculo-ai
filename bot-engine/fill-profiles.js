/**
 * AutoCurriculo AI - Profile Filler
 *
 * Le o curriculo PDF do Supabase Storage e preenche automaticamente
 * o perfil em cada plataforma de emprego.
 *
 * Uso: node fill-profiles.js
 *
 * Requer:
 *   - session-state.json (gerado pelo setup-session.js) OU credenciais no .env
 *   - curriculo.pdf na pasta bot-engine/ OU caminho via CURRICULO_PATH
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const os = require("os");

const { log } = require("./utils/logger");
const { randomDelay, humanType } = require("./utils/delays");

// ─── Dados do perfil ─────────────────────────────────────────────────────────
// Preencha com seus dados ou deixe o script ler do curriculo.json

const PERFIL = {
  // Dados pessoais
  nome:       "Juan Goes",
  email:      "emailjg4@gmail.com",
  telefone:   "(51) 98468-9725",
  cidade:     "Porto Alegre",
  estado:     "RS",
  linkedin:   "",
  github:     "",
  portfolio:  "",

  // Cargo e resumo
  cargo: "Gestor de Tráfego Pago | Performance & Growth",
  resumo: `Profissional de Performance e Tráfego Pago com 6 anos de experiência. Especialista em estratégias avançadas de aquisição, otimização e escala (Facebook, TikTok e Google Ads), com foco total em ROI/ROAS e crescimento previsível.

Construção de funis de alta conversão e análise de dados estratégica. Pioneiro no uso de IA (ChatGPT/Claude) para criação de ativos e automação de processos.`,

  // Experiência (mais recente primeiro)
  experiencias: [
    {
      empresa:   "V4 Company — Peretto & Co.",
      cargo:     "Gestor de Tráfego Pago",
      inicio:    "",
      fim:       "Atual",
      descricao: "Gestão completa de campanhas focadas em maximização de ROAS. Planejamento estratégico, testes A/B e otimização de funis. Estruturação de playbooks de performance orientados a dados.",
    },
    {
      empresa:   "Instituto Henrique Amaral",
      cargo:     "Gestor de Tráfego e Designer",
      inicio:    "",
      fim:       "",
      descricao: "Desenvolvimento de Landing Pages de alta performance. Implementação de automações e réguas de remarketing. Aumento expressivo na geração de leads qualificados.",
    },
    {
      empresa:   "Compare Planos de Saúde & Rei do Açaí",
      cargo:     "Gestor de Tráfego e Performance",
      inicio:    "",
      fim:       "",
      descricao: "Estratégias de crescimento local e funis de vendas diretas.",
    },
  ],

  // Formação
  formacao: [
    {
      instituicao: "Colégio Estadual Marechal Rondon",
      curso:       "Ensino Médio",
      inicio:      "",
      fim:         "",
    },
  ],

  // Cursos e certificações
  cursos: [
    "Cientista do Marketing — V4 Company",
    "Subido — Pedro Sobral",
    "Mentoria Formação Milionária — Kayky Janiszewski",
    "Tráfego de Alta Performance — Academy Gold Pro",
    "Criativos que Convertem",
    "Invictus Contingência",
    "Infinity Sul — Gestor de Tráfego",
  ],

  // Habilidades
  habilidades: [
    "Facebook Ads",
    "TikTok Ads",
    "Google Ads",
    "Otimização e escala",
    "Segmentação e jornada",
    "Funis de conversão",
    "Tráfego Orgânico",
    "Copywriting",
    "Landing Pages",
    "Automações",
    "BI e Análise de Dados",
    "ChatGPT",
    "ROI/ROAS",
  ],

  // Pretensão salarial
  pretensao: "A combinar",

  // Tipo de contrato preferido
  tipoContrato: "CLT",

  // Modalidade
  modalidade: "Híbrido",

  // Idiomas
  idiomas: ["Inglês — Leitura e escrita"],
};

// ─── Plataformas ──────────────────────────────────────────────────────────────

const PLATAFORMAS = [
  { nome: "LinkedIn",    fn: fillLinkedIn   },
  { nome: "InfoJobs",    fn: fillInfoJobs   },
  { nome: "Catho",       fn: fillCatho      },
  { nome: "Sine",        fn: fillSine       },
  { nome: "Workana",     fn: fillWorkana    },
  { nome: "GetNinjas",   fn: fillGetNinjas  },
  { nome: "99Freelas",   fn: fill99Freelas  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log("=== AutoCurriculo AI - Preenchimento de Perfis ===");
  log(`Cargo: ${PERFIL.cargo}`);
  log(`Nome: ${PERFIL.nome}`);
  log(`Cidade: ${PERFIL.cidade}/${PERFIL.estado}`);
  log("");

  // Carregar sessao se existir
  const sessionFile = path.join(__dirname, "session-state.json");
  const storageState = fs.existsSync(sessionFile) ? sessionFile : undefined;
  if (storageState) log("[SESSION] Usando sessao salva");

  // Encontrar Chrome real
  const chromePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(os.homedir(), "AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"),
  ];
  const executablePath = chromePaths.find((p) => fs.existsSync(p));

  const browser = await chromium.launch({
    headless: false, // Visivel para voce acompanhar e intervir se necessario
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    locale: "pt-BR",
    storageState,
  });

  const resultados = [];

  for (const plataforma of PLATAFORMAS) {
    log(`\n[${plataforma.nome}] Iniciando preenchimento...`);
    try {
      const page = await context.newPage();
      await plataforma.fn(page, PERFIL);
      await page.close();
      resultados.push({ plataforma: plataforma.nome, status: "ok" });
      log(`[${plataforma.nome}] ✓ Concluido`);
    } catch (err) {
      log(`[${plataforma.nome}] ✗ Erro: ${err.message}`);
      resultados.push({ plataforma: plataforma.nome, status: "erro", erro: err.message });
    }
    await randomDelay(3000, 5000);
  }

  log("\n=== RESULTADO FINAL ===");
  for (const r of resultados) {
    log(`${r.status === "ok" ? "✓" : "✗"} ${r.plataforma}: ${r.status}${r.erro ? ` — ${r.erro}` : ""}`);
  }

  await browser.close();
}

// ─── LinkedIn ─────────────────────────────────────────────────────────────────

async function fillLinkedIn(page, p) {
  const email = process.env.LINKEDIN_EMAIL;
  const senha = process.env.LINKEDIN_SENHA;
  if (!email) { log("[LINKEDIN] Sem credenciais. Pulando."); return; }

  await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded" });
  await randomDelay(2000, 3000);

  // Login
  await humanType(page, "#username", email);
  await humanType(page, "#password", senha);
  await page.click('button[type="submit"]');
  await randomDelay(4000, 6000);

  if (page.url().includes("/checkpoint") || page.url().includes("/login")) {
    log("[LINKEDIN] Falha no login. Pulando.");
    return;
  }

  // Ir para edicao de perfil
  await page.goto("https://www.linkedin.com/in/me/", { waitUntil: "domcontentloaded" });
  await randomDelay(3000, 5000);

  // Editar introducao (nome, cargo, cidade)
  const editBtn = await page.$('button[aria-label*="Editar introducao"], button[aria-label*="Edit intro"]');
  if (editBtn) {
    await editBtn.click();
    await randomDelay(2000, 3000);

    // Cargo/titulo
    const headlineInput = await page.$('input[id*="headline"], input[name*="headline"]');
    if (headlineInput) {
      await headlineInput.triple_click?.() || await headlineInput.click({ clickCount: 3 });
      await headlineInput.fill(p.cargo);
    }

    // Cidade
    const cityInput = await page.$('input[id*="city"], input[name*="city"]');
    if (cityInput) {
      await cityInput.click({ clickCount: 3 });
      await humanType(page, 'input[id*="city"], input[name*="city"]', p.cidade);
      await randomDelay(1000, 2000);
      // Selecionar primeira sugestao
      const suggestion = await page.$('.basic-typeahead__selectable, [role="option"]');
      if (suggestion) await suggestion.click();
    }

    // Salvar
    const saveBtn = await page.$('button[aria-label*="Salvar"], button:has-text("Salvar"), button:has-text("Save")');
    if (saveBtn) { await saveBtn.click(); await randomDelay(2000, 3000); }
  }

  // Editar resumo/sobre
  await page.goto("https://www.linkedin.com/in/me/", { waitUntil: "domcontentloaded" });
  await randomDelay(2000, 3000);

  const aboutEditBtn = await page.$('section[id*="about"] button[aria-label*="Editar"], section[id*="summary"] button');
  if (aboutEditBtn) {
    await aboutEditBtn.click();
    await randomDelay(1500, 2500);
    const aboutTextarea = await page.$('textarea[id*="summary"], textarea[name*="summary"]');
    if (aboutTextarea) {
      await aboutTextarea.click({ clickCount: 3 });
      await aboutTextarea.fill(p.resumo);
      const saveBtn = await page.$('button:has-text("Salvar"), button:has-text("Save")');
      if (saveBtn) { await saveBtn.click(); await randomDelay(2000, 3000); }
    }
  }

  log("[LINKEDIN] Perfil atualizado");
}

// ─── InfoJobs ─────────────────────────────────────────────────────────────────

async function fillInfoJobs(page, p) {
  const email = process.env.INFOJOBS_EMAIL;
  const senha = process.env.INFOJOBS_SENHA;
  if (!email) { log("[INFOJOBS] Sem credenciais. Pulando."); return; }

  await page.goto("https://www.infojobs.com.br/login.aspx", { waitUntil: "domcontentloaded" });
  await randomDelay(2000, 3000);

  const emailInput = await page.$('input[type="email"], input[name*="email"]');
  const senhaInput = await page.$('input[type="password"]');
  if (emailInput && senhaInput) {
    await emailInput.fill(email);
    await senhaInput.fill(senha);
    await page.click('button[type="submit"], button:has-text("Entrar")');
    await randomDelay(4000, 6000);
  }

  // Ir para edicao de curriculo
  await page.goto("https://www.infojobs.com.br/candidate/curriculum/edit/", { waitUntil: "domcontentloaded" });
  await randomDelay(3000, 5000);

  // Dados pessoais
  const nomeInput = await page.$('input[name*="name"], input[id*="name"], input[placeholder*="nome"]');
  if (nomeInput) { await nomeInput.fill(p.nome); }

  const telefoneInput = await page.$('input[name*="phone"], input[id*="phone"], input[placeholder*="telefone"]');
  if (telefoneInput) { await telefoneInput.fill(p.telefone); }

  const cidadeInput = await page.$('input[name*="city"], input[id*="city"], input[placeholder*="cidade"]');
  if (cidadeInput) {
    await cidadeInput.fill(p.cidade);
    await randomDelay(1000, 2000);
    const suggestion = await page.$('[role="option"], .autocomplete-item');
    if (suggestion) await suggestion.click();
  }

  // Titulo profissional
  const tituloInput = await page.$('input[name*="title"], input[id*="title"], input[placeholder*="cargo"], input[placeholder*="titulo"]');
  if (tituloInput) { await tituloInput.fill(p.cargo); }

  // Resumo
  const resumoTextarea = await page.$('textarea[name*="summary"], textarea[id*="summary"], textarea[placeholder*="resumo"]');
  if (resumoTextarea) { await resumoTextarea.fill(p.resumo); }

  // Salvar
  const saveBtn = await page.$('button[type="submit"], button:has-text("Salvar"), input[type="submit"]');
  if (saveBtn) { await saveBtn.click(); await randomDelay(3000, 5000); }

  log("[INFOJOBS] Perfil atualizado");
}

// ─── Catho ────────────────────────────────────────────────────────────────────

async function fillCatho(page, p) {
  const email = process.env.CATHO_EMAIL;
  const senha = process.env.CATHO_SENHA;
  if (!email) { log("[CATHO] Sem credenciais. Pulando."); return; }

  await page.goto("https://www.catho.com.br/login/", { waitUntil: "domcontentloaded" });
  await randomDelay(2000, 3000);

  await page.fill('input[type="email"], input[name*="email"]', email);
  await page.fill('input[type="password"]', senha);
  await page.click('button[type="submit"], button:has-text("Entrar")');
  await randomDelay(4000, 6000);

  // Ir para curriculo
  await page.goto("https://www.catho.com.br/area-candidato/curriculo/", { waitUntil: "domcontentloaded" });
  await randomDelay(3000, 5000);

  // Dados pessoais
  const nomeInput = await page.$('input[name*="name"], input[id*="name"]');
  if (nomeInput) { await nomeInput.fill(p.nome); }

  const telefoneInput = await page.$('input[name*="phone"], input[id*="phone"]');
  if (telefoneInput) { await telefoneInput.fill(p.telefone); }

  // Objetivo profissional
  const objetivoInput = await page.$('input[name*="objective"], textarea[name*="objective"], input[placeholder*="cargo"]');
  if (objetivoInput) { await objetivoInput.fill(p.cargo); }

  // Resumo
  const resumoInput = await page.$('textarea[name*="summary"], textarea[name*="about"], textarea[placeholder*="resumo"]');
  if (resumoInput) { await resumoInput.fill(p.resumo); }

  // Salvar
  const saveBtn = await page.$('button[type="submit"], button:has-text("Salvar")');
  if (saveBtn) { await saveBtn.click(); await randomDelay(3000, 5000); }

  log("[CATHO] Perfil atualizado");
}

// ─── Sine ─────────────────────────────────────────────────────────────────────

async function fillSine(page, p) {
  const email = process.env.SINE_EMAIL;
  const senha = process.env.SINE_SENHA;
  if (!email) { log("[SINE] Sem credenciais. Pulando."); return; }

  await page.goto("https://www.sine.com.br/login", { waitUntil: "domcontentloaded" });
  await randomDelay(2000, 3000);

  await page.fill('input[type="email"], input[name*="email"]', email);
  await page.fill('input[type="password"]', senha);
  await page.click('button[type="submit"], button:has-text("Entrar")');
  await randomDelay(4000, 6000);

  await page.goto("https://www.sine.com.br/candidato/curriculo", { waitUntil: "domcontentloaded" });
  await randomDelay(3000, 5000);

  const cargoInput = await page.$('input[name*="cargo"], input[name*="title"], input[placeholder*="cargo"]');
  if (cargoInput) { await cargoInput.fill(p.cargo); }

  const resumoInput = await page.$('textarea[name*="resumo"], textarea[name*="summary"]');
  if (resumoInput) { await resumoInput.fill(p.resumo); }

  const saveBtn = await page.$('button[type="submit"], button:has-text("Salvar")');
  if (saveBtn) { await saveBtn.click(); await randomDelay(3000, 5000); }

  log("[SINE] Perfil atualizado");
}

// ─── Workana ──────────────────────────────────────────────────────────────────

async function fillWorkana(page, p) {
  const email = process.env.WORKANA_EMAIL;
  const senha = process.env.WORKANA_SENHA;
  if (!email) { log("[WORKANA] Sem credenciais. Pulando."); return; }

  await page.goto("https://www.workana.com/pt/login", { waitUntil: "domcontentloaded" });
  await randomDelay(2000, 3000);

  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"]', senha);
  await page.click('button[type="submit"], button:has-text("Entrar")');
  await randomDelay(4000, 6000);

  await page.goto("https://www.workana.com/pt/freelancer/edit", { waitUntil: "domcontentloaded" });
  await randomDelay(3000, 5000);

  // Titulo profissional
  const titleInput = await page.$('input[name*="title"], input[id*="title"], input[placeholder*="titulo"]');
  if (titleInput) { await titleInput.fill(p.cargo); }

  // Bio/resumo
  const bioInput = await page.$('textarea[name*="bio"], textarea[name*="overview"], textarea[placeholder*="descricao"]');
  if (bioInput) { await bioInput.fill(p.resumo); }

  // Habilidades
  for (const skill of p.habilidades.slice(0, 5)) {
    const skillInput = await page.$('input[placeholder*="habilidade"], input[placeholder*="skill"]');
    if (skillInput) {
      await skillInput.fill(skill);
      await randomDelay(500, 1000);
      const suggestion = await page.$('[role="option"], .skill-suggestion');
      if (suggestion) await suggestion.click();
      else await page.keyboard.press("Enter");
      await randomDelay(500, 1000);
    }
  }

  const saveBtn = await page.$('button[type="submit"], button:has-text("Salvar"), button:has-text("Save")');
  if (saveBtn) { await saveBtn.click(); await randomDelay(3000, 5000); }

  log("[WORKANA] Perfil atualizado");
}

// ─── GetNinjas ────────────────────────────────────────────────────────────────

async function fillGetNinjas(page, p) {
  const email = process.env.GETNINJAS_EMAIL;
  const senha = process.env.GETNINJAS_SENHA;
  if (!email) { log("[GETNINJAS] Sem credenciais. Pulando."); return; }

  await page.goto("https://www.getninjas.com.br/login", { waitUntil: "domcontentloaded" });
  await randomDelay(2000, 3000);

  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"]', senha);
  await page.click('button[type="submit"], button:has-text("Entrar")');
  await randomDelay(4000, 6000);

  await page.goto("https://www.getninjas.com.br/perfil/editar", { waitUntil: "domcontentloaded" });
  await randomDelay(3000, 5000);

  const nomeInput = await page.$('input[name*="name"], input[id*="name"]');
  if (nomeInput) { await nomeInput.fill(p.nome); }

  const bioInput = await page.$('textarea[name*="bio"], textarea[name*="description"]');
  if (bioInput) { await bioInput.fill(p.resumo); }

  const telefoneInput = await page.$('input[name*="phone"], input[name*="telefone"]');
  if (telefoneInput) { await telefoneInput.fill(p.telefone); }

  const saveBtn = await page.$('button[type="submit"], button:has-text("Salvar")');
  if (saveBtn) { await saveBtn.click(); await randomDelay(3000, 5000); }

  log("[GETNINJAS] Perfil atualizado");
}

// ─── 99Freelas ────────────────────────────────────────────────────────────────

async function fill99Freelas(page, p) {
  const email = process.env.FREELAS99_EMAIL;
  const senha = process.env.FREELAS99_SENHA;
  if (!email) { log("[99FREELAS] Sem credenciais. Pulando."); return; }

  await page.goto("https://www.99freelas.com.br/login", { waitUntil: "domcontentloaded" });
  await randomDelay(2000, 3000);

  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"]', senha);
  await page.click('button[type="submit"], button:has-text("Entrar")');
  await randomDelay(4000, 6000);

  await page.goto("https://www.99freelas.com.br/user/profile/edit", { waitUntil: "domcontentloaded" });
  await randomDelay(3000, 5000);

  const nomeInput = await page.$('input[name*="name"], input[id*="name"]');
  if (nomeInput) { await nomeInput.fill(p.nome); }

  const bioInput = await page.$('textarea[name*="bio"], textarea[name*="description"], textarea[name*="about"]');
  if (bioInput) { await bioInput.fill(p.resumo); }

  const tituloInput = await page.$('input[name*="title"], input[name*="headline"]');
  if (tituloInput) { await tituloInput.fill(p.cargo); }

  const saveBtn = await page.$('button[type="submit"], button:has-text("Salvar")');
  if (saveBtn) { await saveBtn.click(); await randomDelay(3000, 5000); }

  log("[99FREELAS] Perfil atualizado");
}

main().catch((err) => {
  console.error("Erro:", err.message);
  process.exit(1);
});
