/**
 * AutoCurriculo AI - Session Setup
 * 
 * Run this ONCE locally to login manually (Google OAuth etc).
 * Saves browser session state so the bot stays logged in forever.
 * 
 * Usage: node setup-session.js
 * 
 * 1. Browser opens
 * 2. Login manually on each tab: Indeed, LinkedIn, InfoJobs
 * 3. Close the browser when done
 * 4. Session saved -> copy output to GitHub Secret SESSION_STATE
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const SITES = [
  {
    name: "Indeed",
    url: "https://br.indeed.com",
    loginSteps: "Clique em 'Entrar' > 'Continuar com Google' > faca login",
  },
  {
    name: "LinkedIn",
    url: "https://www.linkedin.com/login",
    loginSteps: "Clique em 'Entrar com Google' > faca login",
  },
  {
    name: "InfoJobs",
    url: "https://www.infojobs.com.br/login.aspx",
    loginSteps: "Clique em 'Entrar com Google' > faca login",
  },
];

async function main() {
  console.log("========================================");
  console.log(" AutoCurriculo AI - Setup de Sessao");
  console.log("========================================");
  console.log("");
  console.log("Este script vai:");
  console.log("1. Abrir o navegador com Indeed, LinkedIn e InfoJobs");
  console.log("2. Voce faz login manual em cada aba (Google OAuth)");
  console.log("3. Fechar o navegador quando terminar");
  console.log("4. A sessao fica salva -> bot usa pra sempre");
  console.log("");

  const browser = await chromium.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    locale: "pt-BR",
  });

  // Open all sites in tabs
  for (const site of SITES) {
    const page = await context.newPage();
    await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    console.log(`[${site.name}] Aberto: ${site.url}`);
    console.log(`  -> ${site.loginSteps}`);
    console.log("");
  }

  console.log("========================================");
  console.log(" AGORA: Va em cada aba e faca login");
  console.log(" Quando terminar TUDO, feche o navegador");
  console.log("========================================");
  console.log("");

  // Wait for browser to close
  await new Promise((resolve) => {
    browser.on("disconnected", resolve);
  });

  // Save session state
  const state = await context.storageState();
  const stateJson = JSON.stringify(state);
  const stateFile = path.join(__dirname, "session-state.json");
  fs.writeFileSync(stateFile, stateJson);

  // Compress and base64 encode for GitHub Secret
  const { gzipSync } = require("zlib");
  const compressed = gzipSync(stateJson);
  const base64 = compressed.toString("base64");

  console.log("");
  console.log("========================================");
  console.log(" SESSAO SALVA!");
  console.log("========================================");
  console.log("");
  console.log(`Arquivo: ${stateFile} (${(stateJson.length / 1024).toFixed(1)} KB)`);
  console.log(`Comprimido (base64): ${(base64.length / 1024).toFixed(1)} KB`);
  console.log("");

  if (base64.length > 46000) {
    console.log("ATENCAO: Sessao muito grande (>46KB) para GitHub Secret.");
    console.log("Envie o arquivo session-state.json para o Supabase Storage.");
    console.log(`Comando: gh secret set SESSION_STATE < ${stateFile}`);
  } else {
    console.log("Copie o valor abaixo para o GitHub Secret SESSION_STATE:");
    console.log("");
    console.log(base64);
    console.log("");
    console.log("Ou execute:");
    console.log(`gh secret set SESSION_STATE --body "$(cat session-state.json | gzip | base64)" -r Freshweedman/autocurriculo-ai`);
  }
}

main().catch((err) => {
  console.error("Erro:", err.message);
  process.exit(1);
});
