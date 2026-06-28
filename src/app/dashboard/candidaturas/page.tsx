"use client";

import { supabase } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

interface Application {
  id: string;
  empresa: string;
  vaga: string;
  vaga_url: string | null;
  plataforma: string;
  status: string;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  enviado:       { label: "Enviado",        color: "#30D158", bg: "rgba(48,209,88,0.1)" },
  falhou:        { label: "Falhou",         color: "#FF6961", bg: "rgba(255,69,58,0.1)" },
  pendente:      { label: "Pendente",       color: "#FF9F0A", bg: "rgba(255,159,10,0.1)" },
  duplicado:     { label: "Duplicado",      color: "#FF9F0A", bg: "rgba(255,159,10,0.1)" },
  sem_submit:    { label: "Sem submit",     color: "#636366", bg: "rgba(99,99,102,0.1)" },
  sem_file_input:{ label: "Sem upload",    color: "#636366", bg: "rgba(99,99,102,0.1)" },
  nao_suportado: { label: "Não suportado", color: "#636366", bg: "rgba(99,99,102,0.1)" },
};

const PLAT_COLOR: Record<string, string> = {
  LinkedIn: "#0A66C2", Indeed: "#2164F3", InfoJobs: "#FF6600",
  Catho: "#00A651", Workana: "#FF6B35", "99Freelas": "#00B4D8",
  GetNinjas: "#E63946", Sine: "#6A0DAD", TrabalhaBrasil: "#E63946",
  Vagas: "#6A0DAD", TrabalheConosco: "#457B9D", EmpregoLigado: "#F59E0B",
};

export default function CandidaturasPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroPlatforma, setFiltroPlatforma] = useState("todas");
  const [selected, setSelected] = useState<Application | null>(null);
  const [cvUrl, setCvUrl] = useState<string | null>(null);

  useEffect(() => { loadCandidaturas(); }, []);

  const loadCandidaturas = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("applications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);

    setApps(data || []);
    setLoading(false);

    const { data: urlData } = await supabase.storage
      .from("curriculos")
      .createSignedUrl(`${user.id}/curriculo.pdf`, 3600);
    if (urlData?.signedUrl) setCvUrl(urlData.signedUrl);
  };

  const plataformas = ["todas", ...Array.from(new Set(apps.map(a => a.plataforma))).sort()];

  const filtered = apps.filter(a => {
    const matchSearch = !search ||
      a.empresa?.toLowerCase().includes(search.toLowerCase()) ||
      a.vaga?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filtroStatus === "todos" || a.status === filtroStatus;
    const matchPlat = filtroPlatforma === "todas" || a.plataforma === filtroPlatforma;
    return matchSearch && matchStatus && matchPlat;
  });

  const enviadas = apps.filter(a => a.status === "enviado").length;
  const hoje = apps.filter(a => {
    const d = new Date(a.created_at).toDateString();
    return d === new Date().toDateString() && a.status === "enviado";
  }).length;

  // Stats by platform
  const statsByPlat = apps.filter(a => a.status === "enviado").reduce((acc, a) => {
    acc[a.plataforma] = (acc[a.plataforma] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <div className="animate-spin" style={{ width: 24, height: 24, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%" }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em" }}>Candidaturas</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>
            {enviadas.toLocaleString("pt-BR")} enviadas no total · {hoje} hoje
          </p>
        </div>
        {cvUrl && (
          <a href={cvUrl} target="_blank" rel="noreferrer" className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", fontSize: 13 }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Meu currículo
          </a>
        )}
      </div>

      {/* Platform stats */}
      {Object.keys(statsByPlat).length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {Object.entries(statsByPlat)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([plat, count]) => (
              <button
                key={plat}
                onClick={() => setFiltroPlatforma(filtroPlatforma === plat ? "todas" : plat)}
                style={{
                  padding: "5px 12px", borderRadius: 100, fontSize: 12, fontWeight: 500,
                  background: filtroPlatforma === plat ? `${PLAT_COLOR[plat] || "var(--accent)"}30` : "var(--bg-card)",
                  border: `1px solid ${filtroPlatforma === plat ? (PLAT_COLOR[plat] || "var(--accent)") + "60" : "var(--border)"}`,
                  color: PLAT_COLOR[plat] || "var(--accent)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {plat} · {count}
              </button>
            ))
          }
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", pointerEvents: "none" }}>
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar empresa ou vaga..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ width: "auto", paddingRight: 32 }}>
          <option value="todos">Todos os status</option>
          <option value="enviado">✓ Enviado</option>
          <option value="duplicado">⟲ Duplicado</option>
          <option value="falhou">✕ Falhou</option>
          <option value="nao_suportado">— Não suportado</option>
          <option value="sem_submit">— Sem submit</option>
        </select>
        <select value={filtroPlatforma} onChange={e => setFiltroPlatforma(e.target.value)} style={{ width: "auto", paddingRight: 32 }}>
          {plataformas.map(p => <option key={p} value={p}>{p === "todas" ? "Todas as plataformas" : p}</option>)}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ padding: 40, borderRadius: "var(--radius-lg)", border: "1px dashed var(--border)", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>
            {apps.length === 0 ? "🤖" : "🔍"}
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            {apps.length === 0 ? "Nenhuma candidatura ainda. Ative o bot nas configurações." : "Nenhum resultado para os filtros."}
          </p>
        </div>
      ) : (
        <div style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", overflow: "hidden", background: "var(--bg-card)" }}>
          <table>
            <thead>
              <tr>
                <th>Empresa / Vaga</th>
                <th>Plataforma</th>
                <th>Status</th>
                <th>Data</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(app => {
                const statusInfo = STATUS_MAP[app.status] || { label: app.status, color: "var(--text-tertiary)", bg: "rgba(99,99,102,0.1)" };
                return (
                  <tr
                    key={app.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelected(app)}
                  >
                    <td>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{app.empresa || app.plataforma}</div>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                        {(app.vaga || "").replace(/-/g, " ").slice(0, 65) || "—"}
                      </div>
                    </td>
                    <td>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "3px 10px", borderRadius: 100,
                        fontSize: 11, fontWeight: 600,
                        background: `${PLAT_COLOR[app.plataforma] || "#6366f1"}18`,
                        color: PLAT_COLOR[app.plataforma] || "var(--accent)",
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", flexShrink: 0 }} />
                        {app.plataforma}
                      </span>
                    </td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 600, background: statusInfo.bg, color: statusInfo.color }}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
                      {new Date(app.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      {app.vaga_url && (
                        <a href={app.vaga_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "var(--accent)", fontWeight: 500 }}>
                          ↗
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{ maxWidth: 480, width: "100%", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", padding: 24, position: "relative", boxShadow: "var(--shadow-elevated)", animation: "slideUp 0.2s ease" }}
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => setSelected(null)} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, width: 28, height: 28, fontSize: 14, cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>

            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, paddingRight: 40, marginBottom: 4 }}>{selected.empresa || "Empresa"}</h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{(selected.vaga || "").replace(/-/g, " ").slice(0, 80)}</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              {[
                { label: "PLATAFORMA", content: <span style={{ fontSize: 13, fontWeight: 600, color: PLAT_COLOR[selected.plataforma] || "var(--accent)" }}>{selected.plataforma}</span> },
                { label: "STATUS", content: <span style={{ fontSize: 13, fontWeight: 600, color: STATUS_MAP[selected.status]?.color || "var(--text-secondary)" }}>{STATUS_MAP[selected.status]?.label || selected.status}</span> },
                { label: "DATA", content: <span style={{ fontSize: 13 }}>{new Date(selected.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</span> },
                { label: "HORA", content: <span style={{ fontSize: 13 }}>{new Date(selected.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span> },
              ].map(item => (
                <div key={item.label} style={{ background: "var(--bg)", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 5, letterSpacing: "0.08em", fontWeight: 600 }}>{item.label}</div>
                  {item.content}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              {selected.vaga_url && (
                <a href={selected.vaga_url} target="_blank" rel="noreferrer" className="btn-primary" style={{ textDecoration: "none", flex: 1, textAlign: "center", padding: "10px 0", fontSize: 13 }}>
                  Ver vaga ↗
                </a>
              )}
              {cvUrl && (
                <a href={cvUrl} target="_blank" rel="noreferrer" className="btn-ghost" style={{ textDecoration: "none", flex: 1, textAlign: "center", padding: "10px 0", fontSize: 13 }}>
                  📄 Meu currículo
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
