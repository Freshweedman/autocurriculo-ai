"use client";

import { supabase } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

// ─── Platform definitions ─────────────────────────────────────────────────────

const PLATFORMS = [
  // CLT / Emprego
  { key: "indeed",    nome: "Indeed",         icon: "🔵", tipo: "clt",       googleLogin: true,  descricao: "Maior plataforma de empregos do mundo" },
  { key: "linkedin",  nome: "LinkedIn",       icon: "💼", tipo: "clt",       googleLogin: true,  descricao: "Rede profissional + Easy Apply" },
  { key: "infojobs",  nome: "InfoJobs",       icon: "🟠", tipo: "clt",       googleLogin: false, descricao: "Grande plataforma brasileira de empregos" },
  { key: "catho",     nome: "Catho",          icon: "🟢", tipo: "clt",       googleLogin: false, descricao: "Plataforma premium de empregos no Brasil" },
  { key: "sine",      nome: "Sine",           icon: "🏛️", tipo: "clt",       googleLogin: false, descricao: "Plataforma governamental de empregos" },
  // Freelancer
  { key: "workana",   nome: "Workana",        icon: "🌎", tipo: "freelancer", googleLogin: false, descricao: "Maior plataforma freelancer da America Latina" },
  { key: "getninjas", nome: "GetNinjas",      icon: "🥷", tipo: "freelancer", googleLogin: false, descricao: "Servicos freelancer no Brasil" },
  { key: "freelas99", nome: "99Freelas",      icon: "🆓", tipo: "freelancer", googleLogin: false, descricao: "Plataforma brasileira de projetos freelancer" },
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
  const [cidade, setCidade]             = useState("");
  const [limiteDiario, setLimiteDiario] = useState(5);
  const [botAtivo, setBotAtivo]         = useState(false);
  const [loading, setLoading]           = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [cvUploaded, setCvUploaded]     = useState(false);
  const [salvo, setSalvo]               = useState(false);
  const [pageLoading, setPageLoading]   = useState(true);
  const [plataformas, setPlataformas]   = useState<PlataformasState>(initialPlataformas());

  useEffect(() => { loadConfig(); }, []);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadConfig = async () => {
    const res = await fetch("/api/config");
    if (!res.ok) return;
    const data = await res.json();

    setCargo(data.cargo || "");
    setCidade(data.cidade || "");
    setLimiteDiario(data.limite_diario || 5);
    setBotAtivo(data.bot_ativo ?? false);

    const updated = initialPlataformas();
    for (const p of PLATFORMS) {
      const pd = data.plataformas?.[p.key];
      if (pd) updated[p.key] = { ...emptyPlatform(), email: pd.email || "", configurado: pd.configurado || false };
    }
    setPlataformas(updated);
    setPageLoading(false);
  };

  // ── Save main config ──────────────────────────────────────────────────────

  const handleSave = async () => {
    setLoading(true);
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cargo, cidade, limite_diario: limiteDiario, bot_ativo: botAtivo }),
    });
    setSalvo(true);
    setLoading(false);
    setTimeout(() => setSalvo(false), 3000);
  };

  // ── Upload CV ─────────────────────────────────────────────────────────────

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.storage.from("curriculos").upload(`${user!.id}/curriculo.pdf`, file, {
      upsert: true, cacheControl: "3600",
    });
    setCvUploaded(true);
    setUploading(false);
  };

  // ── Platform helpers ──────────────────────────────────────────────────────

  const setPlatform = (key: PlatformKey, patch: Partial<PlatformCred>) =>
    setPlataformas((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const handleSavePlatform = async (key: PlatformKey) => {
    const p = plataformas[key];
    if (!p.email) return;
    setPlatform(key, { salvando: true });
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [`${key}_email`]: p.email, [`${key}_senha`]: p.senha }),
    });
    setPlatform(key, { salvando: false, editando: false, configurado: true, senha: "" });
  };

  const handleRemovePlatform = async (key: PlatformKey) => {
    setPlatform(key, { salvando: true });
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [`${key}_email`]: null, [`${key}_senha`]: null }),
    });
    setPlatform(key, { ...emptyPlatform() });
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (pageLoading) return <div className="text-muted">Carregando...</div>;

  const cltPlatforms      = PLATFORMS.filter((p) => p.tipo === "clt");
  const freelancerPlatforms = PLATFORMS.filter((p) => p.tipo === "freelancer");
  const connectedCount    = PLATFORMS.filter((p) => plataformas[p.key].configurado).length;

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Configuracoes</h1>
        <p className="text-muted" style={{ marginTop: 4 }}>Configure seu bot de candidaturas</p>
      </div>

      <div style={{ display: "grid", gap: 24, maxWidth: 680 }}>

        {/* ── Curriculo ── */}
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Curriculo PDF</h3>
          <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
            Envie seu curriculo em PDF. Use um arquivo otimizado para ATS.
          </p>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label className="btn-outline" style={{ cursor: "pointer", margin: 0 }}>
              {uploading ? "Enviando..." : cvUploaded ? "Substituir PDF" : "Selecionar PDF"}
              <input type="file" accept=".pdf" onChange={handleUpload} style={{ display: "none" }} />
            </label>
            {cvUploaded && <span className="badge badge-success">✓ Enviado</span>}
          </div>
        </div>

        {/* ── Busca ── */}
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Configuracao de Busca</h3>

          <label style={labelStyle}>Cargo desejado</label>
          <input value={cargo} onChange={(e) => setCargo(e.target.value)}
            placeholder="Ex: gestor de trafego, designer, desenvolvedor" style={{ marginBottom: 16 }} />

          <label style={labelStyle}>Cidade / Regiao</label>
          <input value={cidade} onChange={(e) => setCidade(e.target.value)}
            placeholder="Ex: Sao Paulo - SP (deixe vazio para remoto)" style={{ marginBottom: 16 }} />

          <label style={labelStyle}>Limite diario de envios por plataforma</label>
          <select value={limiteDiario} onChange={(e) => setLimiteDiario(Number(e.target.value))}
            style={{ marginBottom: 20 }}>
            {[10, 20, 50, 100, 150, 200].map((n) => (
              <option key={n} value={n}>{n} curriculos/dia</option>
            ))}
          </select>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>Bot automatico</div>
              <div className="text-muted" style={{ fontSize: 13 }}>Roda Seg-Sex as 9h via GitHub Actions</div>
            </div>
            <Toggle value={botAtivo} onChange={setBotAtivo} />
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

        {/* ── Plataformas CLT ── */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Plataformas de Emprego (CLT)</h3>
            <span className="badge badge-success" style={{ fontSize: 11 }}>
              {cltPlatforms.filter((p) => plataformas[p.key].configurado).length}/{cltPlatforms.length} conectadas
            </span>
          </div>
          <p className="text-muted" style={{ fontSize: 13, marginBottom: 20 }}>
            O bot candidata automaticamente nas plataformas conectadas.
            TrabalhaBrasil, Vagas.com e EmpregoLigado nao precisam de login.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Plataformas sem login — sempre ativas */}
            {["TrabalhaBrasil", "Vagas.com", "EmpregoLigado", "TrabalheConosco"].map((nome) => (
              <div key={nome} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border)",
                background: "rgba(34,197,94,0.04)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16 }}>🟢</span>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{nome}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Sem login necessario</div>
                  </div>
                </div>
                <span className="badge badge-success" style={{ fontSize: 11 }}>✓ Sempre ativo</span>
              </div>
            ))}

            {/* Plataformas com login */}
            {cltPlatforms.map((p) => (
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
            O bot envia propostas automaticamente. Workana e 99Freelas tem limite de propostas diarias — o bot respeita isso.
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
            Mais plataformas = mais candidaturas por dia. As credenciais ficam salvas no banco Supabase.
            Para Indeed e LinkedIn, prefira o login via Google OAuth executando{" "}
            <code style={{ background: "rgba(255,255,255,0.08)", padding: "1px 6px", borderRadius: 4 }}>
              node bot-engine/setup-session.js
            </code>{" "}
            localmente.
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
  label: { nome: string; icon: string; descricao: string; googleLogin: boolean };
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
          <span style={{ fontSize: 18 }}>{label.icon}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{label.nome}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {cred.configurado && !cred.editando ? cred.email : label.descricao}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {cred.configurado && !cred.editando ? (
            <>
              <span className="badge badge-success" style={{ fontSize: 11 }}>✓ Conectado</span>
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
      {cred.editando && (
        <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
          {label.googleLogin && (
            <div style={{
              display: "flex", gap: 10, marginBottom: 14, padding: "10px 14px",
              borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)",
            }}>
              <span style={{ fontSize: 18 }}>🔑</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Login via Google (recomendado)</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Execute <code style={{ background: "rgba(255,255,255,0.08)", padding: "1px 6px", borderRadius: 4 }}>
                    node bot-engine/setup-session.js
                  </code> localmente para salvar a sessao Google
                </div>
              </div>
            </div>
          )}
          <label style={labelStyle}>Email da conta {label.nome}</label>
          <input type="email" value={cred.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="seu@email.com" style={{ marginBottom: 12 }} />
          <label style={labelStyle}>Senha</label>
          <input type="password" value={cred.senha}
            onChange={(e) => onChange({ senha: e.target.value })}
            placeholder="Senha da conta" style={{ marginBottom: 16 }} />
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
