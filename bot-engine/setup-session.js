/**
 * AutoCurriculo AI - Session Setup
 *
 * Abre o Chrome com seu perfil real (ja logado no Google).
 * Faca login no Indeed, LinkedIn e InfoJobs usando "Entrar com Google".
 * Feche o navegador quando terminar — a sessao e salva automaticamente.
 *
 * Uso: node setup-session.js
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const os = require("os");

const SITES = [
  {
    name: "Indeed",
    url: "https://br.indeed.com",
    dica: "Clique em 'Entrar' > 'Continuar com Google'",
  },
  {
    name: "LinkedIn",
    url: "https://www.linkedin.com/login",
    dica: "Clique em 'Entrar com Google'",
  },
  {
    name: "InfoJobs",
    url: "https://www.infojobs.com.br/login.aspx",
    dica: "Clique em 'Entrar com Google'",
  },
];

// Caminhos possiveis do Chrome no Windows
function findChrome() {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(os.homedir(), "AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

// Perfil padrao do Chrome do usuario (ja tem sessao Google salva)
function findChromeUserDataDir() {
  return path.join(os.homedir(), "AppData\\Local\\Google\\Chrome\\User Data");
}

async function main() {
  console.log("========================================");
  console.log(" AutoCurriculo AI - Setup de Sessao");
  console.log("========================================\n");

  const executablePath = findChrome();
  const userDataDir = findChromeUserDataDir();
  const userDataExists = fs.existsSync(userDataDir);

  if (!executablePath) {
    console.error("ERRO: Google Chrome nao encontrado.");
    console.error("Instale o Chrome em https://www.google.com/chrome/ e tente novamente.");
    process.exit(1);
  }

  console.log(`Chrome: ${executablePath}`);

  // Usar o perfil REAL do Chrome (ja tem sessao Google salva, evita captcha)
  // Fecha o Chrome antes de rodar se estiver aberto
  console.log("\nIMPORTANTE: Feche o Google Chrome antes de continuar.");
  console.log("Pressione ENTER quando o Chrome estiver fechado...");
  await new Promise((resolve) => {
    process.stdin.once("data", resolve);
  });

  console.log("\nABRINDO NAVEGADOR COM SEU PERFIL...\n");

  // Usar o perfil real do usuario (tem cookies do Google, evita captcha e bloqueios)
  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath,
    headless: false,
    viewport: { width: 1366, height: 768 },
    locale: "pt-BR",
    channel: "chrome",
    args: [
      "--no-sandbox",
      "--profile-directory=Default",
    ],
    ignoreDefaultArgs: ["--enable-automation", "--enable-blink-features=IdleDetection"],
  });

  // Abrir cada site em uma aba
  const pages = [];
  for (const site of SITES) {
    const page = pages.length === 0
      ? context.pages()[0] || await context.newPage()
      : await context.newPage();

    try {
      await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    } catch (_) {
      // ignora timeout de carregamento
    }

    console.log(`[${site.name}] Aberto`);
    console.log(`  -> ${site.dica}\n`);
    pages.push(page);
  }

  console.log("========================================");
  console.log(" INSTRUCOES:");
  console.log(" 1. Va em cada aba e faca login com Google");
  console.log(" 2. Aguarde confirmar que esta logado");
  console.log(" 3. FECHE O NAVEGADOR quando terminar tudo");
  console.log("========================================\n");

  // Aguarda o navegador fechar
  await new Promise((resolve) => context.browser()?.on("disconnected", resolve) || resolve(null));

  // Salvar estado da sessao
  console.log("\nSalvando sessao...");
  let state;
  try {
    state = await context.storageState();
  } catch (_) {
    // contexto ja fechado, tenta ler do disco
    const cookieFile = path.join(tempProfile, "Default", "Cookies");
    if (!fs.existsSync(cookieFile)) {
      console.error("Nao foi possivel salvar a sessao. Tente novamente.");
      process.exit(1);
    }
    state = { cookies: [], origins: [] };
  }

  const stateJson = JSON.stringify(state, null, 2);
  const stateFile = path.join(__dirname, "session-state.json");
  fs.writeFileSync(stateFile, stateJson);

  // Comprimir e codificar para GitHub Secret
  const { gzipSync } = require("zlib");
  const compressed = gzipSync(Buffer.from(stateJson, "utf8"));
  const base64 = compressed.toString("base64");

  console.log("\n========================================");
  console.log(" SESSAO SALVA COM SUCESSO!");
  console.log("========================================\n");
  console.log(`Arquivo local: ${stateFile}`);
  console.log(`Cookies salvos: ${state.cookies?.length || 0}`);
  console.log(`Tamanho comprimido: ${(base64.length / 1024).toFixed(1)} KB\n`);

  if (state.cookies?.length === 0) {
    console.log("AVISO: Nenhum cookie foi salvo.");
    console.log("Isso significa que o login nao foi concluido.");
    console.log("Tente novamente e certifique-se de estar logado antes de fechar.\n");
  }

  // Salvar o base64 em arquivo separado para facilitar copiar
  const base64File = path.join(__dirname, "session-state.b64");
  fs.writeFileSync(base64File, base64);

  console.log("PROXIMO PASSO — Adicionar ao GitHub Secrets:");
  console.log("1. Acesse: https://github.com/Freshweedman/autocurriculo-ai/settings/secrets/actions");
  console.log("2. Clique em 'New repository secret'");
  console.log("3. Nome: SESSION_STATE");
  console.log(`4. Valor: copie o conteudo do arquivo ${base64File}`);
  console.log("\nOU execute no terminal (precisa do GitHub CLI instalado):");
  console.log(`   gh secret set SESSION_STATE < "${base64File}" -r Freshweedman/autocurriculo-ai`);
}

main().catch((err) => {
  console.error("\nErro:", err.message);
  if (err.message.includes("executable doesn't exist")) {
    console.error("Chrome nao encontrado. Instale em https://www.google.com/chrome/");
  }
  process.exit(1);
});
