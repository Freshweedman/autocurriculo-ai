/**
 * AutoCurriculo AI - Bot Engine
 * 
 * Runs via GitHub Actions (not inside Vercel).
 * Orchestrates Playwright to automate job applications on Indeed, InfoJobs, LinkedIn + generic platforms.
 * Fetches config from Supabase API, applies, and reports results back.
 */

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");

const { log } = require("./utils/logger");
const { applyIndeed } = require("./platforms/indeed");
const { applyInfoJobs } = require("./platforms/infojobs");
const { applyLinkedIn } = require("./platforms/linkedin");
const { applyTrabalhaBrasil } = require("./platforms/trabalhabrasil");
const { applyVagas } = require("./platforms/vagas");
const { applyGeneric } = require("./platforms/generic");
const { discoverCareerPages } = require("./platforms/discoverer");
const { scrapeGoogleLeads } = require("./scraper-google");

// Config from environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BOT_API_KEY = process.env.BOT_API_KEY;
const API_URL = process.env.API_URL || "http://localhost:3000"; // Your Vercel deployment URL

async function fetchUserProfiles() {
  // Fetch all active profiles with bot_ativo = true
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/profiles?bot_ativo=eq.true&select=*`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  
  if (!resp.ok) {
    log(`[API] Erro ao buscar profiles: ${resp.status} ${resp.statusText}`);
    return [];
  }
  
  return await resp.json();
}

async function downloadCurriculo(userId) {
  // Download resume from Supabase Storage
  const resp = await fetch(
    `${SUPABASE_URL}/storage/v1/object/curriculos/${userId}/curriculo.pdf`,
    {
      headers: { apikey: SUPABASE_ANON_KEY },
    }
  );

  if (!resp.ok) {
    log(`[API] Erro baixar curriculo do user ${userId}: ${resp.status}`);
    return null;
  }

  const localPath = path.join(__dirname, `curriculo_${userId}.pdf`);
  const buffer = await resp.buffer();
  fs.writeFileSync(localPath, buffer);
  log(`[API] Curriculo baixado para ${localPath}`);
  return localPath;
}

async function reportResults(userId, applications) {
  // Send results back to the webhook API
  try {
    const resp = await fetch(`${API_URL}/api/webhook/bot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: BOT_API_KEY,
        applications: applications.map((app) => ({ ...app, user_id: userId })),
      }),
    });
    
    if (resp.ok) {
      log(`[API] Resultados reportados para user ${userId}`);
    } else {
      log(`[API] Erro ao reportar resultados: ${resp.status}`);
    }
  } catch (err) {
    log(`[API] Erro ao reportar resultados: ${err.message}`);
  }
}

async function reportLeads(userId, leads) {
  try {
    const resp = await fetch(`${API_URL}/api/webhook/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: BOT_API_KEY,
        leads: leads.map((lead) => ({ ...lead, user_id: userId })),
      }),
    });
    
    if (resp.ok) {
      log(`[API] Leads reportados para user ${userId}`);
    }
  } catch (err) {
    log(`[API] Erro ao reportar leads: ${err.message}`);
  }
}

/**
 * Get platform credentials from environment variables.
 * Per-user credentials can be added via Supabase in the future.
 */
function getPlatformCreds(platform) {
  switch (platform) {
    case "indeed":
      if (process.env.INDEED_EMAIL && process.env.INDEED_SENHA) {
        return { email: process.env.INDEED_EMAIL, senha: process.env.INDEED_SENHA };
      }
      break;
    case "infojobs":
      if (process.env.INFOJOBS_EMAIL && process.env.INFOJOBS_SENHA) {
        return { email: process.env.INFOJOBS_EMAIL, senha: process.env.INFOJOBS_SENHA };
      }
      break;
    case "linkedin":
      if (process.env.LINKEDIN_EMAIL && process.env.LINKEDIN_SENHA) {
        return { email: process.env.LINKEDIN_EMAIL, senha: process.env.LINKEDIN_SENHA };
      }
      break;
  }
  return null;
}

async function main() {
  log("[BOT] AutoCurriculo AI iniciando...");
  log(`[BOT] Data/Hora: ${new Date().toISOString()}`);

  if (!SUPABASE_URL) {
    log("[ERRO] NEXT_PUBLIC_SUPABASE_URL nao configurada");
    return;
  }

  // Fetch active profiles
  const profiles = await fetchUserProfiles();
  log(`[BOT] ${profiles.length} profiles ativos encontrados`);

  if (profiles.length === 0) {
    log("[BOT] Nenhum perfil ativo. Encerrando.");
    return;
  }

  // Show which platforms are configured
  const indeedCreds = getPlatformCreds("indeed");
  const infojobsCreds = getPlatformCreds("infojobs");
  const linkedinCreds = getPlatformCreds("linkedin");
  log(`[BOT] Com login: ${[indeedCreds && "Indeed", infojobsCreds && "InfoJobs", linkedinCreds && "LinkedIn"].filter(Boolean).join(", ") || "nenhuma"}`);
  log(`[BOT] Sem login (auto): TrabalhaBrasil, Vagas.com, +TrabalheConosco`);

  // Launch browser once
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
  });

  try {
    for (const profile of profiles) {
      const userId = profile.user_id;
      const cargo = profile.cargo || "gestor de trafego";
      const cidade = profile.cidade || "";
      const limiteDiario = profile.limite_diario || 100;

      log(`[BOT] Processando user ${userId}: cargo="${cargo}", limite=${limiteDiario}`);

      // Download curriculo
      const cvPath = await downloadCurriculo(userId);
      if (!cvPath) {
        log(`[AVISO] Pulando user ${userId}: sem curriculo`);
        continue;
      }

      const allResults = [];

      // === PLATAFORMAS COM LOGIN ===

      // --- Indeed ---
      if (indeedCreds) {
        log("[BOT] Executando Indeed...");
        const indeedResults = await applyIndeed(browser, {
          email: indeedCreds.email,
          senha: indeedCreds.senha,
          cargo,
          cidade,
          curriculoPath: cvPath,
          limiteDiario,
        });
        allResults.push(...indeedResults);
        log(`[BOT] Indeed: ${indeedResults.length} resultados`);
      }

      // --- InfoJobs ---
      if (infojobsCreds) {
        log("[BOT] Executando InfoJobs...");
        const infojobsResults = await applyInfoJobs(browser, {
          email: infojobsCreds.email,
          senha: infojobsCreds.senha,
          cargo,
          cidade,
          curriculoPath: cvPath,
          limiteDiario,
        });
        allResults.push(...infojobsResults);
        log(`[BOT] InfoJobs: ${infojobsResults.length} resultados`);
      }

      // --- LinkedIn ---
      if (linkedinCreds) {
        log("[BOT] Executando LinkedIn...");
        const linkedinResults = await applyLinkedIn(browser, {
          email: linkedinCreds.email,
          senha: linkedinCreds.senha,
          cargo,
          cidade,
          curriculoPath: cvPath,
          limiteDiario,
        });
        allResults.push(...linkedinResults);
        log(`[BOT] LinkedIn: ${linkedinResults.length} resultados`);
      }

      // === PLATAFORMAS SEM LOGIN (DIRECT UPLOAD) ===

      // --- Trabalha Brasil (no login needed) ---
      log("[BOT] Executando Trabalha Brasil...");
      const tbResults = await applyTrabalhaBrasil(browser, {
        cargo,
        cidade,
        curriculoPath: cvPath,
        limiteDiario,
      });
      allResults.push(...tbResults);
      log(`[BOT] Trabalha Brasil: ${tbResults.length} resultados`);

      // --- Vagas.com (no login needed) ---
      log("[BOT] Executando Vagas.com...");
      const vagasResults = await applyVagas(browser, {
        cargo,
        cidade,
        curriculoPath: cvPath,
        limiteDiario,
      });
      allResults.push(...vagasResults);
      log(`[BOT] Vagas.com: ${vagasResults.length} resultados`);

      // --- Descobridor Trabalhe Conosco + Bot Generico ---
      log("[BOT] Descobrindo paginas Trabalhe Conosco...");
      const discoveredUrls = await discoverCareerPages(browser, { cargo, cidade });
      if (discoveredUrls.length > 0) {
        log(`[BOT] Aplicando para ${Math.min(discoveredUrls.length, limiteDiario)} URLs descobertas...`);
        const genericResults = await applyGeneric(browser, {
          curriculoPath: cvPath,
          plataforma: "TrabalheConosco",
          urls: discoveredUrls.slice(0, limiteDiario),
        });
        allResults.push(...genericResults);
        log(`[BOT] Trabalhe Conosco: ${genericResults.length} resultados`);
      }

      // --- Google Leads Scraper ---
      log("[BOT] Executando Google scraper...");
      const leads = await scrapeGoogleLeads(browser, { cargo, cidade });
      if (leads.length > 0) {
        await reportLeads(userId, leads);
      }

      // Report results
      if (allResults.length > 0) {
        await reportResults(userId, allResults);
      }

      const enviados = allResults.filter((r) => r.status === "enviado").length;
      log(`[BOT] User ${userId}: ${enviados} enviadas / ${allResults.length} processadas, ${leads.length} leads`);
    }

  } catch (err) {
    log(`[ERRO CRITICO] ${err.message}`);
  } finally {
    await browser.close();
    log("[BOT] Browser fechado. Finalizado.");
  }
}

main();
