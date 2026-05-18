"use client";

import { supabase } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformCred {
  email: string;
  senha: string;
  configurado: boolean;
  editando: boolean;
  salvando: boolean;
}

interface Plataformas {
  indeed: PlatformCred;
  linkedin: PlatformCred;
  infojobs: PlatformCred;
}

const PLATFORM_LABELS: Record<keyof Plataformas, { nome: string; cor: string; icon: string; googleLogin: boolean }> = {
  indeed:   { nome: "Indeed",   cor: "#2164f3", icon: "🔵", googleLogin: true  },
  linkedin: { nome: "LinkedIn", cor: "#0a66c2", icon: "💼", googleLogin: true  },
  infojobs: { nome: "InfoJobs", cor: "#ff6600", icon: "🟠", googleLogin: false },
};

const emptyPlatform = (): PlatformCred => ({
  email: "", senha: "", configurado: false, editando: false, salvando: false,
});

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

  const [plataformas, setPlataformas] = useState<Plataformas>({
    indeed:   emptyPlatform(),
    linkedin: emptyPlatform(),
    infojobs: emptyPlatform(),
  });

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

    setPlataformas({
      indeed:   { ...emptyPlatform(), email: data.plataformas?.indeed?.email   || "", configurado: data.plataformas?.indeed?.configurado   || false },
      linkedin: { ...emptyPlatform(), email: data.plataformas?.linkedin?.email || "", configurado: data.plataformas?.linkedin?.configurado || false },
      infojobs: { ...emptyPlatform(), email: data.plataformas?.infojobs?.email || "", configurado: data.plataformas?.infojobs?.configurado || false },
    });
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

  const setPlatform = (key: keyof Plataformas, patch: Partial<PlatformCred>) =>
    setPlataformas((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const handleSavePlatform = async (key: keyof Plataformas) => {
    const p = plataformas[key];
    if (!p.email) return;
    setPlatform(key, { salvando: true });

    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        [`${key}_email`]: p.email,
        [`${key}_senha`]: p.senha,
      }),
    });

    setPlatform(key, { salvando: false, editando: false, configurado: true, senha: "" });
  };

  const handleRemovePlatform = async (key: keyof Plataformas) => {
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

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Configuracoes</h1>
        <p className="text-muted" style={{ marginTop: 4 }}>Configure seu bot de candidaturas</p>
      </div>

      <div style={{ display: "grid", gap: 24, maxWidth: 640 }}>

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
            placeholder="Ex: gestor de trafego" style={{ marginBottom: 16 }} />

          <label style={labelStyle}>Cidade / Regiao</label>
          <input value={cidade} onChange={(e) => setCidade(e.target.value)}
            placeholder="Ex: Sao Paulo - SP" style={{ marginBottom: 16 }} />

          <label style={labelStyle}>Limite diario de envios</label>
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

        {/* ── Plataformas ── */}
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Plataformas de Emprego</h3>
          <p className="text-muted" style={{ fontSize: 13, marginBottom: 20 }}>
            Conecte suas contas para o bot candidatar automaticamente.
            Indeed e LinkedIn suportam login via Google.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {(Object.keys(PLATFORM_LABELS) as (keyof Plataformas)[]).map((key) => (
              <PlatformCard
                key={key}
                platformKey={key}
                label={PLATFORM_LABELS[key]}
                cred={plataformas[key]}
                onSave={() => handleSavePlatform(key)}
                onRemove={() => handleRemovePlatform(key)}
                onChange={(patch) => setPlatform(key, patch)}
              />
            ))}
          </div>

          <div style={{
            marginTop: 20, padding: "12px 16px", borderRadius: 8,
            background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
          }}>
            <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
              <strong style={{ color: "var(--text)" }}>Dica:</strong> Para Indeed e LinkedIn, prefira
              conectar via Google OAuth — e mais seguro e nao expira. Use email/senha como fallback.
              As credenciais ficam salvas no banco de dados criptografado do Supabase.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlatformCard({
  platformKey, label, cred, onSave, onRemove, onChange,
}: {
  platformKey: string;
  label: { nome: string; cor: string; icon: string; googleLogin: boolean };
  cred: PlatformCred;
  onSave: () => void;
  onRemove: () => void;
  onChange: (patch: Partial<PlatformCred>) => void;
}) {
  return (
    <div style={{
      border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px", background: "var(--bg-card-hover)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>{label.icon}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{label.nome}</div>
            {cred.configurado && !cred.editando && (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{cred.email}</div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {cred.configurado && !cred.editando ? (
            <>
              <span className="badge badge-success" style={{ fontSize: 11 }}>✓ Conectado</span>
              <button className="btn-outline" style={{ padding: "6px 12px", fontSize: 12 }}
                onClick={() => onChange({ editando: true })}>
                Editar
              </button>
              <button className="btn-danger" style={{ padding: "6px 12px", fontSize: 12 }}
                onClick={onRemove} disabled={cred.salvando}>
                Remover
              </button>
            </>
          ) : !cred.editando ? (
            <button className="btn-outline" style={{ padding: "6px 14px", fontSize: 13 }}
              onClick={() => onChange({ editando: true })}>
              + Conectar
            </button>
          ) : null}
        </div>
      </div>

      {/* Form */}
      {cred.editando && (
        <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
          {label.googleLogin && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
              padding: "10px 14px", borderRadius: 8,
              background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)",
            }}>
              <span style={{ fontSize: 18 }}>🔑</span>
              <div style={{ flex: 1 }}>
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
          <input
            type="email"
            value={cred.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder={`seu@email.com (conta ${label.nome})`}
            style={{ marginBottom: 12 }}
          />

          <label style={labelStyle}>Senha</label>
          <input
            type="password"
            value={cred.senha}
            onChange={(e) => onChange({ senha: e.target.value })}
            placeholder="Senha da conta"
            style={{ marginBottom: 16 }}
          />

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-primary" onClick={onSave}
              disabled={cred.salvando || !cred.email}
              style={{ flex: 1, padding: "10px 0" }}>
              {cred.salvando ? "Salvando..." : "Salvar"}
            </button>
            <button className="btn-outline" onClick={() => onChange({ editando: false, senha: "" })}
              style={{ padding: "10px 16px" }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 52, height: 28, borderRadius: 14, border: "none", cursor: "pointer", padding: 2,
        background: value ? "var(--success)" : "var(--border)",
        position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}
    >
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
