/**
 * Debug todas as plataformas de uma vez
 * Uso: node debug-all.js
 */

const { chromium } = require("playwright");
const path = require("path");
const os = require("os");
const readline = require("readline");

const PLATAFORMAS = [
  { nome: "Catho",     loginUrl: "https://www.catho.com.br/login/",             perfilUrl: "https://www.catho.com.br/area-candidato/curriculo/" },
  { nome: "InfoJobs",  loginUrl: "https://www.infojobs.com.br/login.aspx",      perfilUrl: "https://www.infojobs.com.br/candidate/curriculum/edit/" },
  { nome: "Workana",   loginUrl: "https://www.workana.com/pt/login",            perfilUrl: "https://www.workana.com/pt/freelancer/edit" },
  { nome: "GetNinjas", loginUrl: "https://www.getninjas.com.br/entrar",         perfilUrl: "https://www.getninjas.com.br/perfil/editar" },
  { nome: "99Freelas", loginUrl: "https://www.99freelas.com.br/login",          perfilUrl: "https://www.99freelas.com.br/user/profile/edit" },
  { nome: "LinkedIn",  loginUrl: "https://www.linkedin.com/login",              perfilUrl: "https://www.linkedin.com/in/me/" },
];

function aguardarEnter(msg) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(msg, () => { rl.close(); resolve(); });
  });
}

async function coletarCampos(page) {
  return page.evaluate(() => {
    const result = [];
    const els = document.querySelectorAll('input, textarea, select');
    for (const el of els) {
      if (el.offsetParent === null) continue;
      if (["hidden","submit","button","image"].includes(el.type)) continue;
      const labelEl = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
      result.push({
        tag:         el.tagName.toLowerCase(),
        type:        el.type || "",
        id:          el.id || "",
        name:        el.name || "",
        placeholder: el.placeholder || "",
        ariaLabel:   el.getAttribute("aria-label") || "",
        label:       labelEl?.textContent?.trim() || "",
        value:       el.value?.slice(0, 60) || "",
      });
    }
    return result;
  });
}

async function main() {
  const chromePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(os.homedir(), "AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"),
  ];
  const executablePath = chromePaths.find((p) => require("fs").existsSync(p));

  const browser = await chromium.launch({ headless: false, executablePath, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: "pt-BR" });

  const resultados = {};

  for (const p of PLATAFORMAS) {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`  ${p.nome}`);
    console.log("=".repeat(50));

    const page = await context.newPage();
    await page.goto(p.loginUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    console.log(`Aberto: ${p.loginUrl}`);
    await aguardarEnter(`[${p.nome}] Faca login, va para a pagina de PERFIL/CURRICULO e pressione ENTER... `);

    const campos = await coletarCampos(page);
    resultados[p.nome] = { url: page.url(), campos };

    console.log(`\nURL atual: ${page.url()}`);
    console.log(`Campos encontrados: ${campos.length}\n`);
    campos.forEach((c, i) => {
      const info = [c.label, c.placeholder, c.ariaLabel, c.name, c.id].filter(Boolean).join(" | ");
      console.log(`  [${i}] <${c.tag} type="${c.type}"> — ${info}${c.value ? ` [valor: ${c.value}]` : ""}`);
    });

    await page.close();
  }

  console.log("\n\n" + "=".repeat(50));
  console.log("  RESUMO COMPLETO (copie e mande pro Kiro)");
  console.log("=".repeat(50));
  console.log(JSON.stringify(resultados, null, 2));

  await aguardarEnter("\nPressione ENTER para fechar... ");
  await browser.close();
}

main().catch(console.error);
