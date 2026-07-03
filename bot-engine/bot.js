/**
 * AutoCurriculo AI - Bot Engine v3
 *
 * Plataformas CLT: Indeed, LinkedIn, InfoJobs, Catho, TrabalhaBrasil, Vagas.com, EmpregoLigado, Sine, TrabalheConosco
 * Plataformas Freelancer: Workana, GetNinjas, 99Freelas
 * Leads: Google Search + Google Maps + queries freelancer
 *
 * Auth modes:
 *   MODE 1: SESSION_STATE (Google OAuth salvo, preferido)
 *   MODE 2: credenciais por usuario no banco Supabase (configuradas no dashboard)
 *   MODE 3: env vars (fallback admin)
 */

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const zlib = require("zlib");
const fetch = require("node-fetch");

const { log } = require("./utils/logger");

// Plataformas CLT
const { applyIndeed }        = require("./platforms/indeed");
const { applyInfoJobs }      = require("./platforms/infojobs");
const { applyLinkedIn }      = require("./platforms/linkedin");
const { applyCatho }         = require("./platforms/catho");
const { applyTrabalhaBrasil }= require("./platforms/trabalhabrasil");
const { applyVagas }         = require("./platforms/vagas");
const { applyEmpregoLigado } = require("./platforms/empregoligado");
const { applySine }          = require("./platforms/sine");
const { applyGeneric }       = require("./platforms/generic");
const { discoverCareerPages }= require("./platforms/discoverer");

// Plataformas Freelancer
const { applyWorkana }   = require("./platforms/workana");
const { applyGetNinjas } = require("./platforms/getninjas");
const { apply99Freelas } = require("./platforms/99freelas");

// Leads
const { scrapeGoogleLeads } = require("./scraper-google");
const { scrapeGoogleJobs }  = require("./platforms/googlejobs");

// Config from environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BOT_API_KEY = process.env.BOT_API_KEY;
// CRÍTICO: API_URL deve ser a URL do Vercel em produção, não localhost
const API_URL = (process.env.API_URL || "").replace(/\/$/, "") || "https://autocurriculo-ai.vercel.app";

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
    `${SUPABASE_URL}/rest/v1/profiles?bot_ativo=eq.true&select=user_id,cargo,cidade,limite_diario,indeed_email,indeed_senha,linkedin_email,linkedin_senha,infojobs_email,infojobs_senha,catho_email,catho_senha,sine_email,sine_senha,workana_email,workana_senha,getninjas_email,getninjas_senha,freelas99_email,freelas99_senha`,
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
  // Usa service role key para acessar storage privado
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  const resp = await fetch(
    `${SUPABASE_URL}/storage/v1/object/curriculos/${userId}/curriculo.pdf`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
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

function expandirTermosBusca(cargo) {
  const cargoLower = (cargo || "").toLowerCase();

  // Termos base sempre incluidos
  const termos = new Set([cargo]);

  // Mapeamento de termos relacionados por area
  const mapa = {
    "trafego": [
      "gestor de trafego",
      "gestor de trafego pago",
      "analista de trafego pago",
      "especialista em trafego pago",
      "media buyer",
      "performance marketing",
    ],
    "marketing": [
      "marketing digital",
      "analista de marketing digital",
      "coordenador de marketing",
      "especialista em marketing",
      "growth hacker",
      "inbound marketing",
    ],
    "google ads": ["google ads", "sem specialist", "ppc specialist"],
    "facebook ads": ["facebook ads", "meta ads", "social ads"],
    "social media": ["social media", "analista de redes sociais", "community manager"],
    "seo": ["seo", "analista de seo", "especialista em seo"],
    "copywriting": ["copywriter", "redator publicitario", "content writer"],
    "design": ["designer grafico", "ui designer", "ux designer", "web designer"],
    "desenvolvedor": ["desenvolvedor web", "front end", "full stack", "programador"],
    "vendas": ["vendedor", "representante comercial", "executivo de vendas", "closer"],
  };

  // Adiciona termos relacionados baseado no cargo
  for (const [chave, relacionados] of Object.entries(mapa)) {
    if (cargoLower.includes(chave)) {
      relacionados.forEach(t => termos.add(t));
    }
  }

  // Se nao encontrou nada especifico, adiciona termos gerais de marketing
  if (termos.size === 1) {
    ["marketing digital", "gestor de trafego pago", "analista de marketing"].forEach(t => termos.add(t));
  }

  const lista = Array.from(termos).slice(0, 6); // max 6 termos para nao demorar demais
  return lista;
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
    case "catho":
      if (profile.catho_email && profile.catho_senha)
        return { email: profile.catho_email, senha: profile.catho_senha };
      if (process.env.CATHO_EMAIL && process.env.CATHO_SENHA)
        return { email: process.env.CATHO_EMAIL, senha: process.env.CATHO_SENHA };
      break;
    case "sine":
      if (profile.sine_email && profile.sine_senha)
        return { email: profile.sine_email, senha: profile.sine_senha };
      if (process.env.SINE_EMAIL && process.env.SINE_SENHA)
        return { email: process.env.SINE_EMAIL, senha: process.env.SINE_SENHA };
      break;
    case "workana":
      if (profile.workana_email && profile.workana_senha)
        return { email: profile.workana_email, senha: profile.workana_senha };
      if (process.env.WORKANA_EMAIL && process.env.WORKANA_SENHA)
        return { email: process.env.WORKANA_EMAIL, senha: process.env.WORKANA_SENHA };
      break;
    case "getninjas":
      if (profile.getninjas_email && profile.getninjas_senha)
        return { email: profile.getninjas_email, senha: profile.getninjas_senha };
      if (process.env.GETNINJAS_EMAIL && process.env.GETNINJAS_SENHA)
        return { email: process.env.GETNINJAS_EMAIL, senha: process.env.GETNINJAS_SENHA };
      break;
    case "99freelas":
      if (profile.freelas99_email && profile.freelas99_senha)
        return { email: profile.freelas99_email, senha: profile.freelas99_senha };
      if (process.env.FREELAS99_EMAIL && process.env.FREELAS99_SENHA)
        return { email: process.env.FREELAS99_EMAIL, senha: process.env.FREELAS99_SENHA };
      break;
  }
  return null;
}

async function main() {
  log("[BOT] AutoCurriculo AI v2 iniciando...");
  log(`[BOT] Data/Hora: ${new Date().toISOString()}`);
  log(`[BOT] API_URL: ${API_URL}`);
  log(`[BOT] SUPABASE_URL: ${SUPABASE_URL ? "configurada" : "NAO CONFIGURADA"}`);
  log(`[BOT] BOT_API_KEY: ${BOT_API_KEY ? "configurada" : "NAO CONFIGURADA"}`);

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
      const cargoBase = profile.cargo || "gestor de trafego";
      const cidade = profile.cidade || "";
      const limiteDiario = profile.limite_diario || 100;

      // Expandir termos de busca baseado no cargo principal
      const termosRelacionados = expandirTermosBusca(cargoBase);
      const limitePorTermo = Math.ceil(limiteDiario / termosRelacionados.length);

      log(`[BOT] User ${userId}: cargo="${cargoBase}", termos=${termosRelacionados.length}, limite=${limiteDiario}`);
      log(`[BOT] Buscando por: ${termosRelacionados.join(", ")}`);

      // Resolve credentials per-profile (from DB or env fallback)
  // Se hasSession, ainda assim passa as credenciais do perfil como fallback
  const profileIndeedCreds   = hasSession
    ? { session: true, ...getPlatformCreds("indeed",    profile) }
    : getPlatformCreds("indeed",    profile);
  const profileLinkedinCreds = hasSession
    ? { session: true, ...getPlatformCreds("linkedin",  profile) }
    : getPlatformCreds("linkedin",  profile);
  const profileInfojobsCreds = hasSession
    ? { session: true, ...getPlatformCreds("infojobs",  profile) }
    : getPlatformCreds("infojobs",  profile);
  const profileCathoCreds    = hasSession
    ? { session: true, ...getPlatformCreds("catho",     profile) }
    : getPlatformCreds("catho",     profile);
  const profileSineCreds     = getPlatformCreds("sine",      profile);
  const profileWorkanaCreds  = getPlatformCreds("workana",   profile);
  const profileNinjasCreds   = getPlatformCreds("getninjas", profile);
  const profileFreelas99Creds= getPlatformCreds("99freelas", profile);

      log(`[BOT] Plataformas com login: ${[
        profileIndeedCreds   && "Indeed",
        profileLinkedinCreds && "LinkedIn",
        profileInfojobsCreds && "InfoJobs",
        profileCathoCreds    && "Catho",
        profileSineCreds     && "Sine",
        profileWorkanaCreds  && "Workana",
        profileNinjasCreds   && "GetNinjas",
        profileFreelas99Creds&& "99Freelas",
      ].filter(Boolean).join(", ") || "nenhuma (so plataformas sem login)"}`);

      const cvPath = await downloadCurriculo(userId);
      if (!cvPath) {
        log(`[AVISO] Pulando user ${userId}: sem curriculo`);
        continue;
      }

      const allResults = [];

      // ── PLATAFORMAS CLT COM LOGIN ──────────────────────────────────────────

      if (profileIndeedCreds) {
        log("[BOT] Indeed...");
        const r = await applyIndeed(browser, authContext, {
          // Passa session E credenciais — o Indeed usa session primeiro, fallback para email/senha
          session: profileIndeedCreds.session || false,
          email: profileIndeedCreds.email,
          senha: profileIndeedCreds.senha,
          cargo: cargoBase, cidade, curriculoPath: cvPath, limiteDiario,
        });
        allResults.push(...r);
        log(`[BOT] Indeed: ${r.length} resultados`);
      }

      if (profileInfojobsCreds) {
        for (const termo of termosRelacionados) {
          log(`[BOT] InfoJobs: "${termo}"...`);
          const r = await applyInfoJobs(browser, authContext, {
            session: profileInfojobsCreds.session || false,
            email: profileInfojobsCreds.email,
            senha: profileInfojobsCreds.senha,
            cargo: termo, cidade, curriculoPath: cvPath, limiteDiario: limitePorTermo,
          });
          allResults.push(...r);
        }
        log(`[BOT] InfoJobs total: ${allResults.filter(r=>r.plataforma==="InfoJobs").length} resultados`);
      }

      if (profileLinkedinCreds) {
        // Login LinkedIn uma unica vez com timeout máximo de 30s
        log("[BOT] LinkedIn: fazendo login...");
        const linkedinPage = await authContext.newPage();
        let linkedinLogado = false;
        try {
          await linkedinPage.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded", timeout: 30000 });
          await linkedinPage.waitForTimeout(3000);

          for (const sel of ["#username", 'input[name="session_key"]', 'input[autocomplete="username"]']) {
            const el = await linkedinPage.$(sel);
            if (el) {
              await linkedinPage.fill(sel, profileLinkedinCreds.email);
              linkedinLogado = true;
              break;
            }
          }
          if (linkedinLogado) {
            await linkedinPage.fill('input[type="password"]', profileLinkedinCreds.senha).catch(() => {});
            await linkedinPage.click('button[type="submit"]').catch(() => {});
            // Aguarda redirecionamento com timeout curto — não bloqueia o bot se demorar
            await linkedinPage.waitForURL("**/feed**", { timeout: 15000 }).catch(() => {});
            await linkedinPage.waitForTimeout(3000);

            const finalUrl = linkedinPage.url();
            if (finalUrl.includes("/checkpoint") || finalUrl.includes("/login") || finalUrl.includes("/authwall")) {
              log("[BOT] LinkedIn: bloqueado por captcha/checkpoint. Pulando.");
              linkedinLogado = false;
            } else {
              log(`[BOT] LinkedIn: login OK (${finalUrl.slice(0, 60)})`);
            }
          }
        } catch (e) {
          log(`[BOT] LinkedIn login timeout/erro: ${e.message.slice(0, 80)}`);
          linkedinLogado = false;
        } finally {
          await linkedinPage.close().catch(() => {});
        }

        if (linkedinLogado) {
          for (const termo of termosRelacionados) {
            log(`[BOT] LinkedIn: "${termo}"...`);
            const r = await applyLinkedIn(browser, authContext, {
              session: true,
              cargo: termo, cidade, curriculoPath: cvPath, limiteDiario: limitePorTermo,
            });
            allResults.push(...r);
          }
          log(`[BOT] LinkedIn total: ${allResults.filter(r=>r.plataforma==="LinkedIn").length} resultados`);
        }
      }

      if (profileCathoCreds) {
        for (const termo of termosRelacionados) {
          log(`[BOT] Catho: "${termo}"...`);
          const r = await applyCatho(browser, authContext, {
            session: profileCathoCreds.session || false,
            email: profileCathoCreds.email,
            senha: profileCathoCreds.senha,
            cargo: termo, cidade, curriculoPath: cvPath, limiteDiario: limitePorTermo,
          });
          allResults.push(...r);
        }
        log(`[BOT] Catho total: ${allResults.filter(r=>r.plataforma==="Catho").length} resultados`);
      }

      if (profileSineCreds) {
        for (const termo of termosRelacionados) {
          log(`[BOT] Sine: "${termo}"...`);
          const r = await applySine(browser, null, {
            email: profileSineCreds.email, senha: profileSineCreds.senha,
            cargo: termo, cidade, curriculoPath: cvPath, limiteDiario: limitePorTermo,
          });
          allResults.push(...r);
        }
        log(`[BOT] Sine total: ${allResults.filter(r=>r.plataforma==="Sine").length} resultados`);
      }

      // ── PLATAFORMAS CLT SEM LOGIN ──────────────────────────────────────────

      for (const termo of termosRelacionados) {
        log(`[BOT] TrabalhaBrasil: "${termo}"...`);
        const r = await applyTrabalhaBrasil(browser, { cargo: termo, cidade, curriculoPath: cvPath, limiteDiario: limitePorTermo });
        allResults.push(...r);
      }
      log(`[BOT] TrabalhaBrasil total: ${allResults.filter(r=>r.plataforma==="TrabalhaBrasil").length} resultados`);

      for (const termo of termosRelacionados) {
        log(`[BOT] Vagas.com: "${termo}"...`);
        const r = await applyVagas(browser, { cargo: termo, cidade, curriculoPath: cvPath, limiteDiario: limitePorTermo });
        allResults.push(...r);
      }
      log(`[BOT] Vagas.com total: ${allResults.filter(r=>r.plataforma==="Vagas").length} resultados`);

      log("[BOT] EmpregoLigado...");
      const elResults = await applyEmpregoLigado(browser, { cargo: cargoBase, cidade, curriculoPath: cvPath, limiteDiario });
      allResults.push(...elResults);
      log(`[BOT] EmpregoLigado: ${elResults.length} resultados`);

      log("[BOT] Descobrindo Trabalhe Conosco...");
      const discoveredUrls = await discoverCareerPages(browser, { cargo: cargoBase, cidade });
      if (discoveredUrls.length > 0) {
        const genericResults = await applyGeneric(browser, {
          curriculoPath: cvPath,
          plataforma: "TrabalheConosco",
          urls: discoveredUrls.slice(0, Math.min(limiteDiario, 20)),
        });
        allResults.push(...genericResults);
        log(`[BOT] TrabalheConosco: ${genericResults.length} resultados`);
      }

      // ── PLATAFORMAS FREELANCER ─────────────────────────────────────────────

      if (profileWorkanaCreds) {
        log("[BOT] Workana...");
        const r = await applyWorkana(browser, null, {
          email: profileWorkanaCreds.email, senha: profileWorkanaCreds.senha,
          cargo: cargoBase, curriculoPath: cvPath, limiteDiario,
        });
        allResults.push(...r);
        log(`[BOT] Workana: ${r.length} resultados`);
      }

      if (profileNinjasCreds) {
        log("[BOT] GetNinjas...");
        const r = await applyGetNinjas(browser, null, {
          email: profileNinjasCreds.email, senha: profileNinjasCreds.senha,
          cargo: cargoBase, cidade, limiteDiario,
        });
        allResults.push(...r);
        log(`[BOT] GetNinjas: ${r.length} resultados`);
      }

      if (profileFreelas99Creds) {
        log("[BOT] 99Freelas...");
        const r = await apply99Freelas(browser, null, {
          email: profileFreelas99Creds.email, senha: profileFreelas99Creds.senha,
          cargo: cargoBase, limiteDiario,
        });
        allResults.push(...r);
        log(`[BOT] 99Freelas: ${r.length} resultados`);
      }

      // --- Google Leads ---
      log("[BOT] Google Leads...");
      const leads = await scrapeGoogleLeads(browser, { cargo: cargoBase, cidade });
      if (leads.length > 0) await reportLeads(userId, leads);

      // --- Google Jobs (vagas reais do painel de empregos do Google) ---
      log("[BOT] Google Jobs...");
      const googleJobResults = await scrapeGoogleJobs(browser, {
        cargo: cargoBase, cidade, limiteDiario: Math.min(limiteDiario, 30),
      });
      // Vagas do Google Jobs: tenta aplicar via site externo (generic)
      if (googleJobResults.length > 0) {
        log(`[BOT] Google Jobs: ${googleJobResults.length} vagas coletadas, tentando aplicar...`);
        const gjUrls = googleJobResults
          .map(j => j.vaga_url)
          .filter(Boolean)
          .filter(u => !u.includes("google.com")); // só URLs externas
        if (gjUrls.length > 0) {
          const gjGenericResults = await applyGeneric(browser, {
            curriculoPath: cvPath,
            plataforma: "GoogleJobs",
            urls: gjUrls.slice(0, 15),
          });
          allResults.push(...gjGenericResults);
          log(`[BOT] Google Jobs generico: ${gjGenericResults.length} processados`);
        }
        // Registra as vagas coletadas mesmo que não consiga aplicar
        const coletadas = googleJobResults.filter(j => j.vaga_url?.includes("google.com") || gjUrls.length === 0);
        allResults.push(...coletadas);
      }

      // Report all results
      await reportResults(userId, allResults);

      const enviados = allResults.filter((r) => r.status === "enviado").length;
      const porPlat = allResults.reduce((acc, r) => { acc[r.plataforma] = (acc[r.plataforma]||0)+1; return acc; }, {});
      log(`[BOT] User ${userId}: ${enviados} enviadas / ${allResults.length} processadas, ${leads.length} leads`);
      log(`[BOT] Por plataforma: ${Object.entries(porPlat).map(([k,v])=>`${k}:${v}`).join(", ")}`);
      log(`[BOT] API_URL usado: ${API_URL}`);
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
