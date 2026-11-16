/**
 * AutoCurriculo AI - Bot Engine v3
 *
 * Plataformas de oportunidades: Indeed, InfoJobs, Catho, TrabalhaBrasil,
 * Vagas.com, EmpregoLigado, Sine e páginas de carreira.
 * Plataformas de projetos: Workana, GetNinjas e 99Freelas.
 *
 * Auth mode: conexões cifradas e isoladas por usuário no Supabase.
 *
 * Nenhuma credencial é lida da tabela `profiles` ou de variáveis globais de
 * plataforma. O LinkedIn não é automatizado: a própria plataforma proíbe
 * automação de candidatura por terceiros.
 */

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const { createDecipheriv } = require("crypto");
const fetch = require("node-fetch");

const { log } = require("./utils/logger");

// Plataformas de oportunidades
const { applyIndeed }        = require("./platforms/indeed");
const { applyInfoJobs }      = require("./platforms/infojobs");
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
const CONNECTION_ENCRYPTION_KEY = process.env.CONNECTION_ENCRYPTION_KEY;
// CRÍTICO: API_URL deve ser a URL do Vercel em produção, não localhost
const API_URL = (process.env.API_URL || "").replace(/\/$/, "") || "https://autocurriculo-ai.vercel.app";
// Direct final submission is deliberately disabled. The current platform
// adapters have not been validated against a user-confirmed review flow.
const ASSISTED_REVIEW_ONLY = true;

function decryptConnectionSecret(value) {
  if (!CONNECTION_ENCRYPTION_KEY) throw new Error("CONNECTION_ENCRYPTION_KEY nao configurada");
  const key = Buffer.from(CONNECTION_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) throw new Error("CONNECTION_ENCRYPTION_KEY deve ter 32 bytes em base64");

  const packed = Buffer.isBuffer(value)
    ? value
    : Buffer.from(String(value).startsWith("\\x") ? String(value).slice(2) : String(value), "hex");
  if (packed.length < 29) throw new Error("segredo de conexao invalido");

  const decipher = createDecipheriv("aes-256-gcm", key, packed.subarray(0, 12));
  decipher.setAuthTag(packed.subarray(12, 28));
  return Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString("utf8");
}

async function fetchUserProfiles() {
  // Use the service role only inside the runner. Credentials live in the
  // separate encrypted vault, never in profiles.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?bot_ativo=eq.true&select=user_id,cargo,cidade,limite_diario`,
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
  
  const profiles = await resp.json();
  const requestedUserId = process.env.BOT_USER_ID;
  return requestedUserId ? profiles.filter((profile) => profile.user_id === requestedUserId) : profiles;
}

async function fetchConnections(userIds) {
  if (userIds.length === 0) return new Map();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  const ids = userIds.map((id) => `"${id}"`).join(",");
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/platform_connections?status=eq.connected&select=user_id,platform,auth_mode,account_hint,encrypted_secret&user_id=in.(${encodeURIComponent(ids)})`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (!resp.ok) {
    log(`[API] Erro ao buscar conexoes seguras: ${resp.status} ${resp.statusText}`);
    return new Map();
  }

  const byUser = new Map();
  for (const connection of await resp.json()) {
    try {
      const plaintext = decryptConnectionSecret(connection.encrypted_secret);
      let credentials;
      try {
        credentials = JSON.parse(plaintext);
      } catch {
        // Backwards-compatible with the first vault format: the account hint
        // carries only the login identifier and the encrypted value is the password.
        credentials = { email: connection.account_hint, senha: plaintext };
      }
      if (!credentials?.email || !credentials?.senha) throw new Error("formato de conexao invalido");
      if (!byUser.has(connection.user_id)) byUser.set(connection.user_id, new Map());
      byUser.get(connection.user_id).set(connection.platform, credentials);
    } catch (error) {
      log(`[API] Conexao ${connection.platform} ignorada: ${error.message}`);
    }
  }
  return byUser;
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

function getPlatformCreds(platform, connections) {
  return connections.get(platform) || null;
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

  const profiles = await fetchUserProfiles();
  log(`[BOT] ${profiles.length} profiles ativos encontrados`);

  if (profiles.length === 0) {
    log("[BOT] Nenhum perfil ativo. Encerrando.");
    return;
  }

  if (!CONNECTION_ENCRYPTION_KEY) {
    log("[ERRO] CONNECTION_ENCRYPTION_KEY nao configurada; conexoes por senha foram bloqueadas.");
  }
  const connectionsByUser = CONNECTION_ENCRYPTION_KEY
    ? await fetchConnections(profiles.map((profile) => profile.user_id))
    : new Map();
  log("[BOT] Modo: contexto isolado por perfil e conexoes individuais cifradas.");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
  });

  try {
    for (const profile of profiles) {
      const userId = profile.user_id;
      const userConnections = connectionsByUser.get(userId) || new Map();
      // Never share cookies between accounts. Global SESSION_STATE is deliberately
      // not applied because it cannot be safely associated with a specific user.
      const authContext = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        locale: "pt-BR",
      });
      const cargoes = String(profile.cargo || "gestor de trafego").split(/[,;\n]/).map((cargo) => cargo.trim()).filter(Boolean);
      const cargoBase = cargoes[0] || "gestor de trafego";
      const cidade = profile.cidade || "";
      const limiteDiario = profile.limite_diario || 100;

      // Expandir termos de busca baseado no cargo principal
      const termosRelacionados = [...new Set(cargoes.flatMap(expandirTermosBusca))].slice(0, 18);
      const limitePorTermo = Math.ceil(limiteDiario / termosRelacionados.length);

      log(`[BOT] User ${userId}: cargo="${cargoBase}", termos=${termosRelacionados.length}, limite=${limiteDiario}`);
      log(`[BOT] Buscando por: ${termosRelacionados.join(", ")}`);

      // Resolve credentials per-profile (from DB or env fallback)
  // Se hasSession, ainda assim passa as credenciais do perfil como fallback
      const profileIndeedCreds   = getPlatformCreds("indeed", userConnections);
      const profileInfojobsCreds = getPlatformCreds("infojobs", userConnections);
      const profileCathoCreds    = getPlatformCreds("catho", userConnections);
      const profileSineCreds     = getPlatformCreds("sine", userConnections);
      const profileWorkanaCreds  = getPlatformCreds("workana", userConnections);
      const profileNinjasCreds   = getPlatformCreds("getninjas", userConnections);
      const profileFreelas99Creds= getPlatformCreds("freelas99", userConnections);

      log(`[BOT] Plataformas com login: ${[
        profileIndeedCreds   && "Indeed",
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
        await authContext.close();
        continue;
      }

      if (ASSISTED_REVIEW_ONLY) {
        log("[BOT] Modo assistido: envio final desativado. Nenhuma candidatura será enviada sem revisão humana.");
        try {
          const discovered = await scrapeGoogleJobs(browser, {
            cargo: cargoBase,
            cidade,
            limiteDiario: Math.min(limiteDiario, 30),
          });
          log(`[BOT] Descoberta assistida: ${discovered.length} oportunidade(s) encontradas para revisão.`);
        } catch (error) {
          log(`[BOT] Descoberta assistida falhou: ${error.message}`);
        } finally {
          await authContext.close();
          fs.unlinkSync(cvPath);
        }
        continue;
      }

      const allResults = [];

      // ── PLATAFORMAS COM CONEXÃO INDIVIDUAL ─────────────────────────────────

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

      // ── FONTES PÚBLICAS E PÁGINAS DE CARREIRA ──────────────────────────────

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
    await browser.close();
    log("[BOT] Finalizado.");
  }
}

main();
