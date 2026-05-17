/**
 * AutoCurriculo AI - Smoke Tests (Node.js)
 * Usage: node tests/smoke.js [VERCEL_URL]
 * Default: https://placeholder.vercel.app
 */

const VERCEL_URL = process.argv[2] || "https://placeholder.vercel.app";
let pass = 0;
let fail = 0;

function green(msg) { console.log(`  \x1b[32mPASS\x1b[0m ${msg}`); pass++; }
function red(msg)   { console.log(`  \x1b[31mFAIL\x1b[0m ${msg}`); fail++; }
function info(msg)  { console.log(`\x1b[36m[TEST]\x1b[0m ${msg}`); }

async function check(desc, url, expectedStatus) {
  info(desc);
  try {
    const resp = await fetch(url, { method: "GET", redirect: "manual" });
    if (resp.status === expectedStatus) {
      green(`${url} -> ${resp.status}`);
    } else {
      red(`${url} -> expected ${expectedStatus}, got ${resp.status}`);
    }
  } catch (err) {
    red(`${url} -> ${err.message}`);
  }
}

async function checkBody(desc, url, pattern) {
  info(desc);
  try {
    const resp = await fetch(url);
    const body = await resp.text();
    if (body.includes(pattern)) {
      green(`${url} -> found "${pattern}"`);
    } else {
      red(`${url} -> "${pattern}" NOT found`);
    }
  } catch (err) {
    red(`${url} -> ${err.message}`);
  }
}

async function checkPost401(desc, url) {
  info(desc);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "bad" }),
      redirect: "manual",
    });
    if (resp.status === 401) {
      green(`${url} -> ${resp.status} (unauthorized as expected)`);
    } else {
      red(`${url} -> expected 401, got ${resp.status}`);
    }
  } catch (err) {
    red(`${url} -> ${err.message}`);
  }
}

async function main() {
  console.log("");
  console.log("========================================");
  console.log(" AutoCurriculo AI - Smoke Tests (Node)");
  console.log(` Target: ${VERCEL_URL}`);
  console.log("========================================");
  console.log("");

  // ---- Frontend ----
  console.log("--- Frontend Pages ---");
  await check("Login page",          `${VERCEL_URL}/login`,              200);
  await check("Register page",       `${VERCEL_URL}/register`,           200);
  await checkBody("Login content",   `${VERCEL_URL}/login`,             "AutoCurriculo");
  await check("Root redirect",       `${VERCEL_URL}/`,                   200);  // or 307

  // ---- Static ----
  console.log("--- Static Assets ---");
  await check("Favicon",             `${VERCEL_URL}/favicon.ico`,        200);
  await check("Missing route 404",   `${VERCEL_URL}/_nonexistent_xyz`,  404);

  // ---- API ----
  console.log("--- API Routes ---");
  await checkPost401("Bot webhook unauth",  `${VERCEL_URL}/api/webhook/bot`);
  await checkPost401("Leads webhook unauth",`${VERCEL_URL}/api/webhook/leads`);

  // ---- Summary ----
  console.log("");
  console.log("========================================");
  console.log(` Results: ${pass} passed, ${fail} failed`);
  console.log("========================================");
  process.exit(fail > 0 ? 1 : 0);
}

main();
