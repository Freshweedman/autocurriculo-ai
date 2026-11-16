/**
 * AutoCurriculo AI - Session Setup
 *
 * Abre o Chrome, voce faz login manualmente no Indeed/LinkedIn/InfoJobs/Workana.
 * A sessao e salva e o bot usa ela para sempre sem precisar de senha.
 *
 * Uso: node setup-session.js
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const os = require("os");
const readline = require("readline");

function aguardarEnter(msg) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(msg, () => { rl.close(); resolve(); });
  });
}

function findChrome() {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(os.homedir(), "AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

async function main() {
  console.log("========================================");
  console.log(" AutoCurriculo AI - Setup de Sessao");
  console.log("========================================\n");
  console.log("Use o metodo real de cada plataforma.");
  console.log("Indeed normalmente deve ser feito por Google OAuth, nao por senha.");
  console.log("Nao cole senha neste terminal. O script salva apenas cookies/sessao do navegador.\n");

  const executablePath = findChrome();
  if (!executablePath) {
    console.error("Chrome nao encontrado. Instale em https://www.google.com/chrome/");
    process.exit(1);
  }

  console.log(`Chrome encontrado: ${executablePath}`);
  console.log("\nIMPORTANTE: Feche o Google Chrome completamente antes de continuar.");
  await aguardarEnter("Pressione ENTER quando o Chrome estiver fechado... ");

  const tempProfile = path.join(os.tmpdir(), "autocurriculo-session-" + Date.now());
  fs.mkdirSync(tempProfile, { recursive: true });
  console.log("\nAbrindo navegador...\n");

  const context = await chromium.launchPersistentContext(tempProfile, {
    executablePath,
    headless: false,
    viewport: { width: 1366, height: 768 },
    locale: "pt-BR",
    ignoreDefaultArgs: ["--enable-automation"],
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  // Abre Indeed
  const p1 = await context.newPage();
  await p1.goto("https://br.indeed.com/account/login", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  console.log("[Indeed] Aberto — faca login pelo Google OAuth ou metodo da sua conta");

  // Abre LinkedIn
  const p2 = await context.newPage();
  await p2.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  console.log("[LinkedIn] Aberto — faca login pelo metodo da sua conta");

  // Abre InfoJobs
  const p3 = await context.newPage();
  await p3.goto("https://www.infojobs.com.br/login.aspx", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  console.log("[InfoJobs] Aberto — faca login pelo metodo da sua conta");

  // Abre Workana
  const p4 = await context.newPage();
  await p4.goto("https://www.workana.com/pt/login", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  console.log("[Workana] Aberto — faca login pelo metodo da sua conta");

  console.log("\n========================================");
  console.log(" INSTRUCOES:");
  console.log(" 1. Va em cada aba e faca login manualmente");
  console.log(" 2. No Indeed, use Google OAuth se sua conta foi criada pelo Google");
  console.log(" 3. Se pedir verificacao por email/SMS/app, confirme");
  console.log(" 4. Aguarde estar logado nas plataformas que voce usa");
  console.log(" 5. Volte aqui e pressione ENTER");
  console.log("========================================\n");

  await aguardarEnter("Pressione ENTER quando estiver logado em todas as plataformas... ");

  console.log("Salvando sessao...");
  let state;
  try {
    state = await context.storageState();
  } catch (_) {
    state = { cookies: [], origins: [] };
  }

  const stateJson = JSON.stringify(state, null, 2);
  const stateFile = path.join(__dirname, "session-state.json");
  fs.writeFileSync(stateFile, stateJson);

  const { gzipSync } = require("zlib");
  const compressed = gzipSync(Buffer.from(stateJson, "utf8"));
  const base64 = compressed.toString("base64");
  const base64File = path.join(__dirname, "session-state.b64");
  fs.writeFileSync(base64File, base64);

  await context.close();

  console.log("\n========================================");
  console.log(" SESSAO SALVA!");
  console.log("========================================\n");
  console.log(`Cookies salvos: ${state.cookies?.length || 0}`);

  if (state.cookies?.length === 0) {
    console.log("\nAVISO: Nenhum cookie salvo.");
    console.log("Verifique se fez login antes de pressionar ENTER e tente novamente.");
  } else {
    console.log("\nPROXIMO PASSO — Adicionar ao GitHub Secrets:");
    console.log("1. Acesse: https://github.com/Freshweedman/autocurriculo-ai/settings/secrets/actions");
    console.log("2. Clique em 'New repository secret'");
    console.log("3. Nome: SESSION_STATE");
    console.log(`4. Valor: copie o conteudo do arquivo:\n   ${base64File}`);
    console.log("\nOU execute (precisa do GitHub CLI):");
    console.log(`   gh secret set SESSION_STATE < "${base64File}" -r Freshweedman/autocurriculo-ai`);
  }

  try { fs.rmSync(tempProfile, { recursive: true, force: true }); } catch (_) {}
}

main().catch((err) => {
  console.error("\nErro:", err.message);
  process.exit(1);
});
