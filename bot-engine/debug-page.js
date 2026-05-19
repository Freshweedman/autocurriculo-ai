/**
 * Debug: mostra todos os campos de input/textarea de uma pagina
 * Uso: node debug-page.js <url>
 * Ex:  node debug-page.js https://www.catho.com.br/area-candidato/curriculo/
 */

const { chromium } = require("playwright");
const path = require("path");
const os = require("os");
const readline = require("readline");

const url = process.argv[2];
if (!url) {
  console.log("Uso: node debug-page.js <url>");
  console.log("Ex:  node debug-page.js https://www.catho.com.br/area-candidato/curriculo/");
  process.exit(1);
}

function aguardarEnter(msg) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(msg, () => { rl.close(); resolve(); });
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
  const page = await context.newPage();

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

  await aguardarEnter("Faca login se necessario e navegue ate a pagina de perfil. Pressione ENTER quando estiver pronto... ");

  // Coletar todos os campos visiveis
  const campos = await page.evaluate(() => {
    const result = [];
    const els = document.querySelectorAll('input, textarea, select');
    for (const el of els) {
      if (el.offsetParent === null) continue; // oculto
      if (el.type === "hidden" || el.type === "submit" || el.type === "button") continue;

      const labelEl = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
      result.push({
        tag:         el.tagName.toLowerCase(),
        type:        el.type || "",
        id:          el.id || "",
        name:        el.name || "",
        placeholder: el.placeholder || "",
        ariaLabel:   el.getAttribute("aria-label") || "",
        label:       labelEl?.textContent?.trim() || "",
        value:       el.value?.slice(0, 50) || "",
        dataTestId:  el.getAttribute("data-testid") || "",
      });
    }
    return result;
  });

  console.log("\n=== CAMPOS ENCONTRADOS NA PAGINA ===\n");
  campos.forEach((c, i) => {
    console.log(`[${i}] <${c.tag} type="${c.type}">`);
    if (c.id)          console.log(`     id:          ${c.id}`);
    if (c.name)        console.log(`     name:        ${c.name}`);
    if (c.placeholder) console.log(`     placeholder: ${c.placeholder}`);
    if (c.ariaLabel)   console.log(`     aria-label:  ${c.ariaLabel}`);
    if (c.label)       console.log(`     label:       ${c.label}`);
    if (c.dataTestId)  console.log(`     data-testid: ${c.dataTestId}`);
    if (c.value)       console.log(`     value atual: ${c.value}`);
    console.log("");
  });

  console.log(`Total: ${campos.length} campos encontrados`);

  await aguardarEnter("\nPressione ENTER para fechar... ");
  await browser.close();
}

main().catch(console.error);
