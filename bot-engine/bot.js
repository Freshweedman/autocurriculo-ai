/**
 * AutoCurriculo AI - Bot Engine v2
 * 
 * Supports 2 auth modes:
 *   MODE 1: SESSION_STATE (manual Google OAuth once, then auto)
 *   MODE 2: email+senha env vars (traditional login, fallback)
 * 
 * Runs via GitHub Actions. Orchestrates Playwright across 7 platforms.
 */

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const zlib = require("zlib");
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
const API_URL = process.env.API_URL || "http://localhost:3000";

/**
 * Load saved browser session from SESSION_STATE env var.
 * If present, browser starts already logged into Indeed/LinkedIn/InfoJobs.
 */
function loadSessionState() {
  const encoded = process.env.SESSION_STATE;
  if (!encoded) {
    log("[SESSION] SESSION_STATE nao configurado. Usando login email/senha.");
    return null;
  }
  
  try {
    const compressed = Buffer.from(encoded, "base64");
    const json = zlib.gunzipSync(compressed).toString("utf8");
    const state = JSON.parse(json);
    log(`[SESSION] Sessao carregada: ${state.cookies?.length || 0} cookies, ${Object.keys(state.origins || {}).length} origins`);
    return state;
  } catch (err) {
    log(`[SESSION] Erro ao carregar sessao: ${err.message}. Usando email/senha.`);
    return null;
  }
}

async function fetchUserProfiles() {
  // Use service role key to read all active profiles including credentials
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?bot_ativo=eq.true&select=user_id,cargo,cidade,limite_diario,indeed_email,indeed_senha,linkedin_email,linkedin_senha,infojobs_email,infojobs_senha`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    }
  );
  
  if (!resp.ok) {
    log(`[API] Erro ao buscar profiles: ${resp.status} ${resp.statusText}`);
    return [];
  }
  
  return await resp.json();
}

async function downloadCurriculo(userId) {
  const resp = await fetch(
    `${SUPABASE_URL}/storage/v1/object/curriculos/${userId}/curriculo.pdf`,
    { headers: { apikey: SUPABASE_ANON_KEY } }
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
  if (applications.length === 0) return;
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
      log(`[API] ${applications.length} resultados reportados para user ${userId}`);
    } else {
      log(`[API] Erro ao reportar: ${resp.status}`);
    }
  } catch (err) {
    log(`[API] Erro ao reportar: ${err.message}`);
  }
}

async function reportLeads(userId, leads) {
  if (leads.length === 0) return;
  try {
    const resp = await fetch(`${API_URL}/api/webhook/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: BOT_API_KEY,
        leads: leads.map((lead) => ({ ...lead, user_id: userId })),
      }),
    });
    
    if (resp.ok) log(`[API] ${leads.length} leads reportados`);
  } catch (err) {
    log(`[API] Erro ao reportar leads: ${err.message}`);
  }
}

function getPlatformCreds(platform, profile) {
  // Priority: credentials stored in user's profile (set via dashboard)
  // Fallback: env vars (legacy / admin override)
  switch (platform) {
    case "indeed":
      if (profile.indeed_email && profile.indeed_senha)
        return { email: profile.indeed_email, senha: profile.indeed_senha };
      if (process.env.INDEED_EMAIL && process.env.INDEED_SENHA)
        return { email: process.env.INDEED_EMAIL, senha: process.env.INDEED_SENHA };
      break;
    case "infojobs":
      if (profile.infojobs_email && profile.infojobs_senha)
        return { email: profile.infojobs_email, senha: profile.infojobs_senha };
      if (process.env.INFOJOBS_EMAIL && process.env.INFOJOBS_SENHA)
        return { email: process.env.INFOJOBS_EMAIL, senha: process.env.INFOJOBS_SENHA };
      break;
    case "linkedin":
      if (profile.linkedin_email && profile.linkedin_senha)
        return { email: profile.linkedin_email, senha: profile.linkedin_senha };
      if (process.env.LINKEDIN_EMAIL && process.env.LINKEDIN_SENHA)
        return { email: process.env.LINKEDIN_EMAIL, senha: process.env.LINKEDIN_SENHA };
      break;
  }
  return null;
}

async function main() {
  log("[BOT] AutoCurriculo AI v2 iniciando...");
  log(`[BOT] Data/Hora: ${new Date().toISOString()}`);

  if (!SUPABASE_URL) {
    log("[ERRO] NEXT_PUBLIC_SUPABASE_URL nao configurada");
    return;
  }

  // Load session state or fallback to email/senha
  const sessionState = loadSessionState();
  const hasSession = !!sessionState;

  const profiles = await fetchUserProfiles();
  log(`[BOT] ${profiles.length} profiles ativos encontrados`);

  if (profiles.length === 0) {
    log("[BOT] Nenhum perfil ativo. Encerrando.");
    return;
  }

  const indeedCreds = hasSession ? { session: true } : null;
  const infojobsCreds = hasSession ? { session: true } : null;
  const linkedinCreds = hasSession ? { session: true } : null;

  log(`[BOT] Modo: ${hasSession ? "SESSAO (Google OAuth)" : "EMAIL/SENHA (por perfil)"}`);
  log(`[BOT] Sem login: TrabalhaBrasil, Vagas.com, TrabalheConosco`);

  // Create browser context options
  const contextOptions = {
    viewport: { width: 1366, height: 768 },
    locale: "pt-BR",
  };
  
  // If session state exists, inject it into the context
  if (sessionState) {
    contextOptions.storageState = sessionState;
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
  });

  // Create shared authenticated context for platforms with login
  const authContext = await browser.newContext(contextOptions);

  try {
    for (const profile of profiles) {
      const userId = profile.user_id;
      const cargo = profile.cargo || "gestor de trafego";
      const cidade = profile.cidade || "";
      const limiteDiario = profile.limite_diario || 100;

      log(`[BOT] User ${userId}: cargo="${cargo}", limite=${limiteDiario}`);

      // Resolve credentials per-profile (from DB or env fallback)
      const profileIndeedCreds   = hasSession ? { session: true } : getPlatformCreds("indeed",   profile);
      const profileLinkedinCreds = hasSession ? { session: true } : getPlatformCreds("linkedin", profile);
      const profileInfojobsCreds = hasSession ? { session: true } : getPlatformCreds("infojobs", profile);

      log(`[BOT] Plataformas com login: ${[
        profileIndeedCreds   && "Indeed",
        profileLinkedinCreds && "LinkedIn",
        profileInfojobsCreds && "InfoJobs",
      ].filter(Boolean).join(", ") || "nenhuma (so plataformas sem login)"}`);

      const cvPath = await downloadCurriculo(userId);
      if (!cvPath) {
        log(`[AVISO] Pulando user ${userId}: sem curriculo`);
        continue;
      }

      const allResults = [];

      // === PLATAFORMAS COM LOGIN (usam authContext com sessao) ===

      if (profileIndeedCreds) {
        log("[BOT] Indeed...");
        const results = await applyIndeed(browser, authContext, {
          ...(profileIndeedCreds.session ? { session: true } : { email: profileIndeedCreds.email, senha: profileIndeedCreds.senha }),
          cargo, cidade, curriculoPath: cvPath, limiteDiario,
        });
        allResults.push(...results);
        log(`[BOT] Indeed: ${results.length} resultados`);
      }

      if (profileInfojobsCreds) {
        log("[BOT] InfoJobs...");
        const results = await applyInfoJobs(browser, authContext, {
          ...(profileInfojobsCreds.session ? { session: true } : { email: profileInfojobsCreds.email, senha: profileInfojobsCreds.senha }),
          cargo, cidade, curriculoPath: cvPath, limiteDiario,
        });
        allResults.push(...results);
        log(`[BOT] InfoJobs: ${results.length} resultados`);
      }

      if (profileLinkedinCreds) {
        log("[BOT] LinkedIn...");
        const results = await applyLinkedIn(browser, authContext, {
          ...(profileLinkedinCreds.session ? { session: true } : { email: profileLinkedinCreds.email, senha: profileLinkedinCreds.senha }),
          cargo, cidade, curriculoPath: cvPath, limiteDiario,
        });
        allResults.push(...results);
        log(`[BOT] LinkedIn: ${results.length} resultados`);
      }

      // === PLATAFORMAS SEM LOGIN ===

      log("[BOT] Trabalha Brasil...");
      const tbResults = await applyTrabalhaBrasil(browser, { cargo, cidade, curriculoPath: cvPath, limiteDiario });
      allResults.push(...tbResults);

      log("[BOT] Vagas.com...");
      const vagasResults = await applyVagas(browser, { cargo, cidade, curriculoPath: cvPath, limiteDiario });
      allResults.push(...vagasResults);

      log("[BOT] Descobrindo Trabalhe Conosco...");
      const discoveredUrls = await discoverCareerPages(browser, { cargo, cidade });
      if (discoveredUrls.length > 0) {
        const genericResults = await applyGeneric(browser, {
          curriculoPath: cvPath,
          plataforma: "TrabalheConosco",
          urls: discoveredUrls.slice(0, limiteDiario),
        });
        allResults.push(...genericResults);
      }

      // --- Google Leads ---
      log("[BOT] Google Leads...");
      const leads = await scrapeGoogleLeads(browser, { cargo, cidade });
      if (leads.length > 0) await reportLeads(userId, leads);

      // Report all results
      await reportResults(userId, allResults);

      const enviados = allResults.filter((r) => r.status === "enviado").length;
      log(`[BOT] User ${userId}: ${enviados} enviadas / ${allResults.length} processadas, ${leads.length} leads`);
    }

  } catch (err) {
    log(`[ERRO CRITICO] ${err.message}`);
  } finally {
    await authContext.close();
    await browser.close();
    log("[BOT] Finalizado.");
  }
}

main();
