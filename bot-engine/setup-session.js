/**
 * AutoCurriculo AI - Session Setup
 *
 * Abre o Chrome, voce faz login manualmente no LinkedIn/InfoJobs/Workana.
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
  console.log("Credenciais para usar:");
  console.log("  Email: contato.digirocket@gmail.com");
  console.log("  Senha: Zaihanna92@\n");

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

  // Abre LinkedIn
  const p1 = await context.newPage();
  await p1.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  console.log("[LinkedIn] Aberto — faca login com email e senha");

  // Abre InfoJobs
  const p2 = await context.newPage();
  await p2.goto("https://www.infojobs.com.br/login.aspx", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  console.log("[InfoJobs] Aberto — faca login com email e senha");

  // Abre Workana
  const p3 = await context.newPage();
  await p3.goto("https://www.workana.com/pt/login", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  console.log("[Workana] Aberto — faca login com email e senha");

  console.log("\n========================================");
  console.log(" INSTRUCOES:");
  console.log(" 1. Va em cada aba e faca login:");
  console.log("    Email: contato.digirocket@gmail.com");
  console.log("    Senha: Zaihanna92@");
  console.log(" 2. Se pedir verificacao por email/SMS, confirme");
  console.log(" 3. Aguarde estar logado em TODAS as 3 abas");
  console.log(" 4. Volte aqui e pressione ENTER");
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
