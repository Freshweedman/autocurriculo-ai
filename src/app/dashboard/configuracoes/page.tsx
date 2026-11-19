"use client";

import { supabase } from "@/lib/supabase/client";
import { BriefcaseBusiness, CheckCircle2, FileText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

// ─── Platform definitions ─────────────────────────────────────────────────────

const PLATFORMS = [
  { key: "indeed",    nome: "Indeed",         icon: "I", tipo: "emprego",   googleLogin: false, descricao: "Login por e-mail e senha da sua própria conta", loginUrl: "https://secure.indeed.com/account/login" },
  { key: "linkedin",  nome: "LinkedIn",       icon: "in", tipo: "emprego",  googleLogin: true,  descricao: "A candidatura é concluída no LinkedIn", manualOnly: true, loginUrl: "https://www.linkedin.com/login" },
  { key: "infojobs",  nome: "InfoJobs",       icon: "IJ", tipo: "emprego",  googleLogin: false, descricao: "Plataforma brasileira de oportunidades" },
  { key: "catho",     nome: "Catho",          icon: "C", tipo: "emprego",   googleLogin: false, descricao: "Plataforma brasileira de oportunidades" },
  { key: "sine",      nome: "Sine",           icon: "S", tipo: "emprego",   googleLogin: false, descricao: "Portal público de oportunidades" },
  // Freelancer
  { key: "workana",   nome: "Workana",        icon: "W", tipo: "freelancer", googleLogin: false, descricao: "Maior plataforma freelancer da America Latina" },
  { key: "getninjas", nome: "GetNinjas",      icon: "G", tipo: "freelancer", googleLogin: false, descricao: "Servicos freelancer no Brasil" },
  { key: "freelas99", nome: "99Freelas",      icon: "99", tipo: "freelancer", googleLogin: false, descricao: "Plataforma brasileira de projetos freelancer" },
] as const;

const PUBLIC_SOURCES = [
  { nome: "Google Jobs", url: "https://www.google.com/search?ibp=htl%3Bjobs&q=vagas", tipo: "Busca pública" }, { nome: "Remotar", url: "https://remotar.com.br/search/jobs", tipo: "Vagas remotas" },
  { nome: "Remote OK", url: "https://remoteok.com", tipo: "Vagas remotas" }, { nome: "We Work Remotely", url: "https://weworkremotely.com", tipo: "Vagas remotas" },
  { nome: "Jobicy", url: "https://jobicy.com", tipo: "Vagas remotas" }, { nome: "Arbeitnow", url: "https://arbeitnow.com", tipo: "Busca pública" },
  { nome: "TrabalhaBrasil", url: "https://www.trabalhabrasil.com.br/vagas-empregos", tipo: "Brasil" }, { nome: "Vagas.com", url: "https://www.vagas.com.br", tipo: "Brasil" },
  { nome: "EmpregoLigado", url: "https://www.empregoligado.com.br/vagas", tipo: "Brasil" }, { nome: "Trampos", url: "https://trampos.co", tipo: "Brasil" },
  { nome: "Programathor", url: "https://programathor.com.br/jobs", tipo: "Tecnologia" }, { nome: "APInfo", url: "https://www.apinfo.com", tipo: "Tecnologia" },
  { nome: "Catho", url: "https://www.catho.com.br/vagas/", tipo: "Cadastro simples" }, { nome: "InfoJobs", url: "https://www.infojobs.com.br", tipo: "Cadastro simples" },
  { nome: "Indeed", url: "https://br.indeed.com", tipo: "Cadastro simples" }, { nome: "LinkedIn Jobs", url: "https://www.linkedin.com/jobs", tipo: "Cadastro simples" },
  { nome: "Glassdoor", url: "https://www.glassdoor.com/Job/index.htm", tipo: "Cadastro simples" }, { nome: "Jooble", url: "https://br.jooble.org", tipo: "Busca pública" },
  { nome: "Turing", url: "https://www.turing.com/jobs", tipo: "Cadastro simples" }, { nome: "Wellfound", url: "https://wellfound.com/jobs", tipo: "Cadastro simples" },
  { nome: "Greenhouse", url: "https://boards.greenhouse.io", tipo: "Páginas de carreira" }, { nome: "Lever", url: "https://jobs.lever.co", tipo: "Páginas de carreira" },
  { nome: "Ashby", url: "https://jobs.ashbyhq.com", tipo: "Páginas de carreira" },
  { nome: "Emprega Brasil", url: "https://servicos.mte.gov.br", tipo: "Serviço público" }, { nome: "BNE", url: "https://www.bne.com.br", tipo: "Brasil" },
  { nome: "Empregos.com.br", url: "https://www.empregos.com.br", tipo: "Brasil" }, { nome: "CIEE", url: "https://www.ciee.org.br", tipo: "Estágio e jovem aprendiz" },
  { nome: "Nube", url: "https://www.nube.com.br", tipo: "Estágio e jovem aprendiz" }, { nome: "VAGAS Tecnologia", url: "https://www.vagas.com.br", tipo: "Tecnologia" },
  { nome: "GeekHunter", url: "https://www.geekhunter.com.br", tipo: "Tecnologia" }, { nome: "Revelo", url: "https://www.revelo.com.br", tipo: "Tecnologia" },
  { nome: "Taqe", url: "https://taqe.com.br", tipo: "Primeiro emprego" }, { nome: "Cia de Talentos", url: "https://www.ciadetalentos.com.br", tipo: "Trainee e estágio" },
  { nome: "Eureca", url: "https://www.eureca.me", tipo: "Estágio e trainee" }, { nome: "99jobs", url: "https://99jobs.com", tipo: "Brasil" },
  { nome: "Banco de Talentos", url: "https://www.bancodetalentos.com.br", tipo: "Brasil" }, { nome: "Jora", url: "https://br.jora.com", tipo: "Agregador" },
  { nome: "Talent.com", url: "https://br.talent.com", tipo: "Agregador" }, { nome: "Jobrapido", url: "https://br.jobrapido.com", tipo: "Agregador" },
  { nome: "Adzuna", url: "https://www.adzuna.com.br", tipo: "Agregador" }, { nome: "The Muse", url: "https://www.themuse.com/search/jobs", tipo: "Internacional" },
  { nome: "Built In", url: "https://builtin.com/jobs", tipo: "Tecnologia" }, { nome: "Dice", url: "https://www.dice.com/jobs", tipo: "Tecnologia" },
  { nome: "Himalayas", url: "https://himalayas.app/jobs", tipo: "Vagas remotas" }, { nome: "Remote.co", url: "https://remote.co/remote-jobs", tipo: "Vagas remotas" },
  { nome: "Working Nomads", url: "https://www.workingnomads.com/jobs", tipo: "Vagas remotas" }, { nome: "Dynamite Jobs", url: "https://dynamitejobs.com", tipo: "Vagas remotas" },
  { nome: "NoDesk", url: "https://nodesk.co/remote-jobs", tipo: "Vagas remotas" }, { nome: "FlexJobs", url: "https://www.flexjobs.com", tipo: "Vagas remotas" },
  { nome: "Virtual Vocations", url: "https://www.virtualvocations.com", tipo: "Vagas remotas" }, { nome: "AngelList Talent", url: "https://wellfound.com/jobs", tipo: "Startups" },
  { nome: "YC Work at a Startup", url: "https://www.workatastartup.com", tipo: "Startups" }, { nome: "Idealist", url: "https://www.idealist.org/en/jobs", tipo: "Impacto social" },
  { nome: "Devex", url: "https://www.devex.com/jobs", tipo: "Desenvolvimento internacional" }, { nome: "ReliefWeb", url: "https://reliefweb.int/jobs", tipo: "Humanitário" },
  { nome: "Behance Jobs", url: "https://www.behance.net/joblist", tipo: "Design e criativo" }, { nome: "Dribbble Jobs", url: "https://dribbble.com/jobs", tipo: "Design e criativo" },
  { nome: "Creativepool", url: "https://creativepool.com/jobs", tipo: "Design e criativo" }, { nome: "Authentic Jobs", url: "https://authenticjobs.com", tipo: "Design e tecnologia" },
  { nome: "Mediabistro", url: "https://www.mediabistro.com/jobs", tipo: "Mídia e comunicação" }, { nome: "eFinancialCareers", url: "https://www.efinancialcareers.com/jobs", tipo: "Finanças" },
  { nome: "HigherEdJobs", url: "https://www.higheredjobs.com", tipo: "Educação" }, { nome: "USAJOBS", url: "https://www.usajobs.gov", tipo: "Setor público internacional" },
] as const;

type PlatformKey = typeof PLATFORMS[number]["key"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformCred {
  email: string;
  senha: string;
  configurado: boolean;
  editando: boolean;
  salvando: boolean;
}

type PlataformasState = Record<PlatformKey, PlatformCred>;

const emptyPlatform = (): PlatformCred => ({
  email: "", senha: "", configurado: false, editando: false, salvando: false,
});

const initialPlataformas = (): PlataformasState =>
  Object.fromEntries(PLATFORMS.map((p) => [p.key, emptyPlatform()])) as PlataformasState;

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConfiguracoesPage() {
  const [cargo, setCargo]               = useState("");
  const [novoCargo, setNovoCargo]       = useState("");
  const [cidade, setCidade]             = useState("");
  const [limiteDiario, setLimiteDiario] = useState(5);
  const [botAtivo, setBotAtivo]         = useState(false);
  const [directSubmission, setDirectSubmission] = useState(false);
  const [countryCode, setCountryCode] = useState("BR");
  const [stateCode, setStateCode] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [internationalOnly, setInternationalOnly] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [professionalSummary, setProfessionalSummary] = useState("");
  const [loading, setLoading]           = useState(false);
  const [cvUploaded, setCvUploaded]     = useState(false);
  const [resumes, setResumes]           = useState<Array<{ id: string; name: string; is_default: boolean }>>([]);
  const [salvo, setSalvo]               = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [configMessage, setConfigMessage] = useState("");
  const [pageLoading, setPageLoading]   = useState(true);
  const [plataformas, setPlataformas]   = useState<PlataformasState>(initialPlataformas());

  // ── Load ──────────────────────────────────────────────────────────────────

  async function loadConfig() {
    setPageLoading(true);
    try {
      const res = await fetch("/api/config");
      if (!res.ok) { setConnectionError("Não foi possível carregar suas configurações. Tente novamente em instantes."); return; }
      const data = await res.json();

    setCargo(Array.isArray(data.cargos) ? data.cargos.join(", ") : data.cargo || "");
    setCidade(data.cidade || "");
    setLimiteDiario(data.limite_diario || 5);
    setBotAtivo(data.bot_ativo ?? false);
    setDirectSubmission(data.direct_submission_enabled ?? false);
    setCountryCode(data.discovery_preferences?.country_code || "BR");
    setStateCode(data.discovery_preferences?.state || "");
    setRemoteOnly(data.discovery_preferences?.remote_only ?? false);
    setInternationalOnly(data.discovery_preferences?.international_only ?? false);
    setFullName(data.applicant?.full_name || "");
    setPhone(data.applicant?.phone || "");
    setProfessionalSummary(data.applicant?.summary || "");

      const updated = initialPlataformas();
      for (const p of PLATFORMS) {
        const pd = data.plataformas?.[p.key];
        if (pd) updated[p.key] = { ...emptyPlatform(), email: pd.email || "", configurado: pd.configurado || false };
      }
      setPlataformas(updated);
      const { data: resumeRows, error: resumeError } = await supabase.from("resumes").select("id,name,is_default").order("created_at", { ascending: false });
      if (resumeError) { setConnectionError("Não foi possível carregar seus currículos. Tente novamente em instantes."); return; }
      setResumes(resumeRows || []);
      setCvUploaded(Boolean(resumeRows?.length));
      const shouldExtract = Boolean(resumeRows?.some((item) => item.is_default)) && (!data.applicant?.full_name || !data.applicant?.phone || !data.applicant?.summary);
      if (shouldExtract) {
        const extractResponse = await fetch("/api/resumes/extract", { method: "POST" });
        const extracted = await extractResponse.json().catch(() => ({}));
        if (extractResponse.ok) {
          setFullName(extracted.applicant?.full_name || "");
          setPhone(extracted.applicant?.phone || "");
          setProfessionalSummary(extracted.applicant?.summary || "");
          setConfigMessage("Dados encontrados no currículo e salvos para os formulários.");
        } else setConfigMessage(extracted.error || "Não foi possível ler o currículo automaticamente.");
      }
    } catch {
      setConnectionError("Não foi possível atualizar esta página. Verifique sua conexão e tente novamente.");
    } finally { setPageLoading(false); }
  }

  useEffect(() => {
    const task = window.setTimeout(() => { void loadConfig(); }, 0);
    return () => window.clearTimeout(task);
  }, []);

  // ── Save main config ──────────────────────────────────────────────────────

  const handleSave = async () => {
    setLoading(true);
    const response = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cargo, cidade, limite_diario: limiteDiario, bot_ativo: botAtivo, direct_submission_enabled: directSubmission, applicant: { full_name: fullName, phone, summary: professionalSummary }, discovery_preferences: { country_code: countryCode, city: cidade, state: stateCode, remote_only: remoteOnly, international_only: internationalOnly } }),
    });
    if (!response.ok) { setConnectionError("Não foi possível salvar as preferências."); setLoading(false); return; }
    setSalvo(true);
    setLoading(false);
    setTimeout(() => setSalvo(false), 3000);
  };

  // ── Platform helpers ──────────────────────────────────────────────────────

  const setPlatform = (key: PlatformKey, patch: Partial<PlatformCred>) =>
    setPlataformas((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const handleSavePlatform = async (key: PlatformKey) => {
    const p = plataformas[key];
    if (!p.email || !p.senha) {
      setConnectionError("Informe o e-mail e o segredo da plataforma para concluir a conexão.");
      return;
    }
    setConnectionError("");
    setPlatform(key, { salvando: true });
    const connectionResponse = await fetch("/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: key, authMode: "manual", accountHint: p.email, secret: p.senha }),
    });
    const connectionData = await connectionResponse.json().catch(() => ({}));
    if (!connectionResponse.ok) {
      setConnectionError(connectionData.error || "Não foi possível salvar a conexão.");
      setPlatform(key, { salvando: false });
      return;
    }
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [`${key}_email`]: p.email }),
    });
    setPlatform(key, { salvando: false, editando: false, configurado: true, senha: "" });
  };

  const handleRemovePlatform = async (key: PlatformKey) => {
    setPlatform(key, { salvando: true });
    await Promise.all([
      fetch(`/api/connections?platform=${encodeURIComponent(key)}`, { method: "DELETE" }),
      fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [`${key}_email`]: null }) }),
    ]);
    setPlatform(key, { ...emptyPlatform() });
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (pageLoading) return <div className="text-muted">Carregando...</div>;

  const jobPlatforms      = PLATFORMS.filter((p) => p.tipo === "emprego");
  const freelancerPlatforms = PLATFORMS.filter((p) => p.tipo === "freelancer");
  const connectedCount    = PLATFORMS.filter((p) => plataformas[p.key].configurado).length;

  return (
    <div className="settings-workspace">
      <div className="settings-hero">
        <p className="eyebrow">PREFERÊNCIAS DE BUSCA</p><h1>Prepare sua busca uma vez.</h1>
        <p>Defina o foco, escolha o currículo certo e use as fontes que fazem sentido para sua carreira.</p>
      </div>

      <div style={{ display: "grid", gap: 24, maxWidth: 680 }}>
        {connectionError && <div className="toast toast-error" style={{ position: "static", maxWidth: "none" }}>{connectionError}</div>}
        {configMessage && <div className="notice" role="status">{configMessage}</div>}

        {/* ── Curriculo ── */}
        <div className="resume-selector">
          <div className="resume-selector-icon"><FileText size={20} /></div><div><p className="eyebrow">CURRÍCULO PADRÃO</p><h2>{resumes.find((item) => item.is_default)?.name || "Nenhum currículo selecionado"}</h2><p>{cvUploaded ? `${resumes.length} versão(ões) disponível(is). Esta é a versão usada como padrão.` : "Envie um PDF para poder usá-lo nas candidaturas."}</p></div>
          <Link className="btn-primary" href="/dashboard/curriculos">{cvUploaded ? "Gerenciar versões" : "Adicionar currículo"}</Link>
        </div>

        {/* ── Busca ── */}
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Configuracao de Busca</h3>

          <details style={{ marginBottom: 18 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Dados lidos do currículo</summary>
            <p className="text-muted" style={{ fontSize: 12, margin: "8px 0 14px" }}>Revise apenas se quiser corrigir algo. O sistema não inventa informações ausentes.</p>
            <label style={labelStyle}>Nome para candidaturas</label>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Seu nome completo" style={{ marginBottom: 12 }} />
            <label style={labelStyle}>Telefone</label>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Ex.: +55 11 99999-9999" style={{ marginBottom: 12 }} />
            <label style={labelStyle}>Resumo profissional</label>
            <textarea value={professionalSummary} onChange={(event) => setProfessionalSummary(event.target.value)} placeholder="Informações verdadeiras do seu currículo." style={{ marginBottom: 4, minHeight: 90 }} />
          </details>

          <label style={labelStyle}>Cargos que você procura</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input value={novoCargo} onChange={(e) => setNovoCargo(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const value = novoCargo.trim(); if (value && !cargo.split(",").map(x => x.trim().toLowerCase()).includes(value.toLowerCase())) setCargo([cargo, value].filter(Boolean).join(", ")); setNovoCargo(""); } }}
              placeholder="Ex.: Analista de dados" />
            <button type="button" className="btn-outline" onClick={() => { const value = novoCargo.trim(); if (value && !cargo.split(",").map(x => x.trim().toLowerCase()).includes(value.toLowerCase())) setCargo([cargo, value].filter(Boolean).join(", ")); setNovoCargo(""); }}>Adicionar</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {cargo.split(",").map(x => x.trim()).filter(Boolean).map((item, index) => <button key={`${item}-${index}`} type="button" className="badge badge-gray" onClick={() => setCargo(cargo.split(",").filter((_, i) => i !== index).join(", "))} title="Remover cargo">{item} ×</button>)}
          </div>

          <label style={labelStyle}>Cidade / Regiao</label>
          <input value={cidade} onChange={(e) => setCidade(e.target.value)}
            placeholder="Ex: Sao Paulo - SP (deixe vazio para remoto)" style={{ marginBottom: 16 }} />

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 120px", gap: 10, marginBottom: 16 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>País
              <select value={countryCode} onChange={(event) => setCountryCode(event.target.value)} style={{ marginTop: 6 }}><option value="BR">Brasil</option><option value="PT">Portugal</option><option value="US">Estados Unidos</option><option value="CA">Canadá</option></select>
            </label>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Estado
              <input value={stateCode} onChange={(event) => setStateCode(event.target.value.toUpperCase())} maxLength={32} placeholder="SP" style={{ marginTop: 6 }} />
            </label>
          </div>

          <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}><div><div style={{ fontWeight: 500, fontSize: 14 }}>Somente remoto</div><div className="text-muted" style={{ fontSize: 12 }}>Descarta vagas presenciais e híbridas.</div></div><Toggle value={remoteOnly} onChange={setRemoteOnly} /></div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}><div><div style={{ fontWeight: 500, fontSize: 14 }}>Aceitar vagas internacionais</div><div className="text-muted" style={{ fontSize: 12 }}>Desativado por padrão. Vagas globais só aparecem quando forem elegíveis.</div></div><Toggle value={internationalOnly} onChange={setInternationalOnly} /></div>
          </div>

          <label style={labelStyle}>Limite diario de envios por plataforma</label>
          <select value={limiteDiario} onChange={(e) => setLimiteDiario(Number(e.target.value))}
            style={{ marginBottom: 20 }}>
            {[10, 20, 50, 100, 150, 200].map((n) => (
              <option key={n} value={n}>{n} curriculos/dia</option>
            ))}
          </select>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>Descoberta assistida</div>
              <div className="text-muted" style={{ fontSize: 13 }}>Consulta fontes configuradas em dias úteis. O envio final exige sua revisão.</div>
            </div>
            <Toggle value={botAtivo} onChange={setBotAtivo} />
          </div>

          <div className="direct-submission-setting">
            <div><div style={{ fontWeight: 650, fontSize: 14 }}>Permitir envio direto nas conexões habilitadas</div><div className="text-muted" style={{ fontSize: 12 }}>Só vale quando você inicia manualmente a automação. O agendamento nunca envia candidaturas.</div></div>
            <Toggle value={directSubmission} onChange={setDirectSubmission} />
          </div>

          <button className="btn-primary" onClick={handleSave} disabled={loading}
            style={{ width: "100%", padding: 12 }}>
            {loading ? "Salvando..." : "Salvar Configuracoes"}
          </button>
          {salvo && (
            <p style={{ textAlign: "center", marginTop: 12, color: "var(--success)", fontSize: 13 }}>
              Configuracoes salvas!
            </p>
          )}
        </div>

        {/* ── Plataformas de oportunidades ── */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Fontes e plataformas de oportunidades</h3>
            <span className="badge badge-success" style={{ fontSize: 11 }}>
              {jobPlatforms.filter((p) => plataformas[p.key].configurado).length}/{jobPlatforms.length} conectadas
            </span>
          </div>
          <p className="text-muted" style={{ fontSize: 13, marginBottom: 20 }}>
            {PUBLIC_SOURCES.length} atalhos de busca. Eles abrem vagas reais; candidatura e confirmação continuam no site de origem.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Fontes abertas para descoberta; o envio depende de cada vaga. */}
            {PUBLIC_SOURCES.map((source) => (
              <div key={source.nome} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card-hover)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <CheckCircle2 size={17} color="var(--accent)" />
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{source.nome}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{source.tipo}</div>
                  </div>
                </div>
                <a className="btn-outline" href={source.url} target="_blank" rel="noreferrer" style={{ padding: "5px 10px", fontSize: 11 }}>Abrir fonte</a>
              </div>
            ))}

            {/* Plataformas com login */}
            {jobPlatforms.map((p) => (
              <PlatformCard
                key={p.key}
                label={p}
                cred={plataformas[p.key]}
                onSave={() => handleSavePlatform(p.key)}
                onRemove={() => handleRemovePlatform(p.key)}
                onChange={(patch) => setPlatform(p.key, patch)}
              />
            ))}
          </div>
        </div>

        {/* ── Plataformas Freelancer ── */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Plataformas Freelancer</h3>
            <span className="badge badge-warning" style={{ fontSize: 11 }}>
              {freelancerPlatforms.filter((p) => plataformas[p.key].configurado).length}/{freelancerPlatforms.length} conectadas
            </span>
          </div>
          <p className="text-muted" style={{ fontSize: 13, marginBottom: 20 }}>
            Essas plataformas podem exigir conta, disponibilidade e validações próprias. A conexão só é utilizada quando o fluxo autorizado estiver disponível.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {freelancerPlatforms.map((p) => (
              <PlatformCard
                key={p.key}
                label={p}
                cred={plataformas[p.key]}
                onSave={() => handleSavePlatform(p.key)}
                onRemove={() => handleRemovePlatform(p.key)}
                onChange={(patch) => setPlatform(p.key, patch)}
              />
            ))}
          </div>
        </div>

        {/* ── Resumo ── */}
        <div style={{
          padding: "14px 18px", borderRadius: 10,
          background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
        }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
            {connectedCount} de {PLATFORMS.length} plataformas conectadas
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            Suas conexões são isoladas por conta e o segredo é cifrado antes de ser armazenado. Revise sempre a oportunidade e qualquer etapa de confirmação antes de concluir uma candidatura.
          </p>
        </div>

      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlatformCard({
  label, cred, onSave, onRemove, onChange,
}: {
  label: { nome: string; icon: string; descricao: string; googleLogin: boolean; manualOnly?: boolean; loginUrl?: string };
  cred: PlatformCred;
  onSave: () => void;
  onRemove: () => void;
  onChange: (patch: Partial<PlatformCred>) => void;
}) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", background: "var(--bg-card-hover)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span aria-hidden="true" style={{ width: 30, height: 30, display: "grid", placeItems: "center", border: "1px solid var(--border)", borderRadius: 7, color: "var(--accent)" }}><BriefcaseBusiness size={15} /></span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{label.nome}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {cred.configurado && !cred.editando ? cred.email : label.descricao}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {label.manualOnly ? (
            <a className="btn-outline" href={label.loginUrl} target="_blank" rel="noreferrer" style={{ padding: "5px 10px", fontSize: 12 }}>Abrir {label.nome}</a>
          ) : cred.configurado && !cred.editando ? (
            <>
              <span className="badge badge-success" style={{ fontSize: 11 }}>Conectada</span>
              <button className="btn-outline" style={{ padding: "5px 10px", fontSize: 12 }}
                onClick={() => onChange({ editando: true })}>Editar</button>
              <button className="btn-danger" style={{ padding: "5px 10px", fontSize: 12 }}
                onClick={onRemove} disabled={cred.salvando}>Remover</button>
            </>
          ) : !cred.editando ? (
            <button className="btn-outline" style={{ padding: "5px 12px", fontSize: 13 }}
              onClick={() => onChange({ editando: true })}>+ Conectar</button>
          ) : null}
        </div>
      </div>

      {/* Form */}
      {label.manualOnly ? (
        <div style={{ padding: 16, borderTop: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
          Entre na sua conta em uma nova aba e conclua a candidatura na plataforma. O AutoCurrículo não coleta senha, cookies ou tenta burlar verificações. Uma integração OAuth só é possível quando a plataforma aprovar e fornecer credenciais oficiais ao produto.
        </div>
      ) : cred.editando && (
        <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
          {label.googleLogin && (
            <div style={{
              display: "flex", gap: 10, marginBottom: 14, padding: "10px 14px",
              borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)",
            }}>
              <ShieldCheck size={18} aria-hidden="true" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Acesso da própria plataforma</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Use apenas dados da sua própria conta. Login por Google, MFA e verificações adicionais podem exigir que você conclua a etapa no site da plataforma.
                </div>
              </div>
            </div>
          )}
          <label style={labelStyle}>Email da conta {label.nome}</label>
          <input type="email" value={cred.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="seu@email.com" style={{ marginBottom: 12 }} />
          <label style={labelStyle}>{label.googleLogin ? "Senha fallback opcional" : "Senha"}</label>
          <input type="password" value={cred.senha}
            onChange={(e) => onChange({ senha: e.target.value })}
            placeholder={label.googleLogin ? "Deixe vazio se usa sessão salva/OAuth" : "Senha da conta"} style={{ marginBottom: 16 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-primary" onClick={onSave}
              disabled={cred.salvando || !cred.email} style={{ flex: 1, padding: "10px 0" }}>
              {cred.salvando ? "Salvando..." : "Salvar"}
            </button>
            <button className="btn-outline" onClick={() => onChange({ editando: false, senha: "" })}
              style={{ padding: "10px 16px" }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} style={{
      width: 52, height: 28, borderRadius: 14, border: "none", cursor: "pointer", padding: 2,
      background: value ? "var(--success)" : "var(--border)",
      position: "relative", transition: "background 0.2s", flexShrink: 0,
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: "50%", background: "white",
        transform: value ? "translateX(24px)" : "translateX(0)",
        transition: "transform 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }} />
    </button>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", marginBottom: 6, fontSize: 13, color: "var(--text-muted)",
};
