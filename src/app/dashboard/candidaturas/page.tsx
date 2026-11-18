"use client";

import { supabase } from "@/lib/supabase/client";
import { BriefcaseBusiness, ExternalLink, FileText, LayoutGrid, List, RefreshCw, Search, Send, X } from "lucide-react";
import { useEffect, useState } from "react";

interface Application {
  id: string;
  empresa: string;
  vaga: string;
  vaga_url: string | null;
  plataforma: string;
  status: string;
  created_at: string;
  notes?: string | null;
  company_contact?: string | null;
  salary_text?: string | null;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  interessado:    { label: "Interessado",    color: "#7dd3fc", bg: "rgba(125,211,252,0.1)" },
  salvo:          { label: "Salvo",          color: "#c4b5fd", bg: "rgba(196,181,253,0.1)" },
  preparando:     { label: "Preparando",     color: "#fbbf77", bg: "rgba(251,191,119,0.1)" },
  candidatado:    { label: "Candidatado",    color: "#5eead4", bg: "rgba(94,234,212,0.1)" },
  em_analise:     { label: "Em análise",     color: "#7dd3fc", bg: "rgba(125,211,252,0.1)" },
  entrevista:     { label: "Entrevista",     color: "#fbbf77", bg: "rgba(251,191,119,0.1)" },
  aprovado:       { label: "Aprovado",       color: "#5eead4", bg: "rgba(94,234,212,0.1)" },
  rejeitado:      { label: "Rejeitado",      color: "#fda4af", bg: "rgba(253,164,175,0.1)" },
  desistencia:    { label: "Desistência",    color: "#a8bacb", bg: "rgba(168,186,203,0.1)" },
  enviado:       { label: "Enviado",        color: "#30D158", bg: "rgba(48,209,88,0.1)" },
  confirmed:     { label: "Confirmado",     color: "#5eead4", bg: "rgba(94,234,212,0.1)" },
  pending_confirmation: { label: "Pendente de confirmação", color: "#fbbf77", bg: "rgba(251,191,119,0.1)" },
  falhou:        { label: "Falhou",         color: "#FF6961", bg: "rgba(255,69,58,0.1)" },
  pendente:      { label: "Pendente",       color: "#FF9F0A", bg: "rgba(255,159,10,0.1)" },
  duplicado:     { label: "Duplicado",      color: "#FF9F0A", bg: "rgba(255,159,10,0.1)" },
  sem_submit:    { label: "Sem submit",     color: "#636366", bg: "rgba(99,99,102,0.1)" },
  sem_file_input:{ label: "Sem upload",    color: "#636366", bg: "rgba(99,99,102,0.1)" },
  nao_suportado: { label: "Não suportado", color: "#636366", bg: "rgba(99,99,102,0.1)" },
};

const TRACKING_STATUSES = ["interessado", "salvo", "preparando", "candidatado", "em_analise", "entrevista", "aprovado", "rejeitado", "desistencia"];
const TECHNICAL_STATUSES = new Set(["falhou", "sem_file_input", "sem_submit", "nao_suportado", "duplicado"]);

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
  const [filtroStatus, setFiltroStatus] = useState("candidaturas");
  const [filtroPlatforma, setFiltroPlatforma] = useState("todas");
  const [selected, setSelected] = useState<Application | null>(null);
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [botRunning, setBotRunning] = useState(false);
  const [botMsg, setBotMsg] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [view, setView] = useState<"list" | "kanban">("kanban");

  async function loadCandidaturas() {
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
  }

  useEffect(() => {
    const task = window.setTimeout(() => { void loadCandidaturas(); }, 0);
    return () => window.clearTimeout(task);
  }, []);

  const runBot = async () => {
    const confirmed = window.confirm("A busca consulta fontes compatíveis com suas preferências. Resultados e etapas aparecerão na Central de automação. Deseja continuar?");
    if (!confirmed) return;
    setBotRunning(true);
    setBotMsg(null);
    try {
      const r = await fetch("/api/run-bot", { method: "POST" });
      const d = await r.json();
      if (r.ok) {
        setBotMsg(d.message || "Bot iniciado. Aguarde alguns minutos para ver resultados.");
        window.setTimeout(() => { void loadCandidaturas(); }, 10_000);
      } else {
        setBotMsg(d.error || "Erro ao iniciar o envio.");
      }
    } catch {
      setBotMsg("Erro de conexão ao iniciar o envio.");
    }
    setBotRunning(false);
  };

  async function updateStatus(status: string) {
    if (!selected || status === selected.status) return;
    setSavingStatus(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingStatus(false); return; }
    const previousStatus = selected.status;
    const { error } = await supabase.from("applications").update({ status, updated_at: new Date().toISOString() }).eq("id", selected.id).eq("user_id", user.id);
    if (error) { setBotMsg("Não foi possível atualizar: aplique as migrations 007 e 008 antes de usar o acompanhamento."); setSavingStatus(false); return; }
    const { error: eventError } = await supabase.from("application_events").insert({ application_id: selected.id, user_id: user.id, from_status: previousStatus, to_status: status });
    setApps((current) => current.map((app) => app.id === selected.id ? { ...app, status } : app));
    setSelected({ ...selected, status });
    if (eventError) setBotMsg("Status atualizado, mas o histórico detalhado depende da migration 008.");
    setSavingStatus(false);
  }

  const plataformas = ["todas", ...Array.from(new Set(apps.map(a => a.plataforma))).sort()];

  const filtered = apps.filter(a => {
    const matchSearch = !search ||
      a.empresa?.toLowerCase().includes(search.toLowerCase()) ||
      a.vaga?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filtroStatus === "todos"
      ? true
      : filtroStatus === "sem_duplicados"
      ? a.status !== "duplicado"
      : filtroStatus === "candidaturas"
      ? !TECHNICAL_STATUSES.has(a.status)
      : a.status === filtroStatus;
    const matchPlat = filtroPlatforma === "todas" || a.plataforma === filtroPlatforma;
    return matchSearch && matchStatus && matchPlat;
  });

  const enviadas = apps.filter(a => a.status === "confirmed").length;
  const hoje = apps.filter(a => {
    const d = new Date(a.created_at).toDateString();
    return d === new Date().toDateString() && a.status === "confirmed";
  }).length;
  // Não conta duplicados no total visível
  const totalReal = apps.filter(a => !TECHNICAL_STATUSES.has(a.status)).length;

  // Stats by platform
  const statsByPlat = apps.filter(a => a.status === "confirmed").reduce((acc, a) => {
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em" }}>Candidaturas</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>
            {enviadas.toLocaleString("pt-BR")} enviadas · {totalReal.toLocaleString("pt-BR")} candidaturas úteis · {hoje} hoje
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {cvUrl && (
            <a href={cvUrl} target="_blank" rel="noreferrer" className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", fontSize: 13 }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Meu currículo
            </a>
          )}
          <button onClick={loadCandidaturas} className="btn-ghost" style={{ padding: "8px 14px", fontSize: 13 }}>
            <RefreshCw size={14} aria-hidden="true" /> Atualizar
          </button>
          <button
            onClick={runBot}
            disabled={botRunning}
            className="btn-primary"
            style={{ padding: "8px 18px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}
          >
            {botRunning
              ? <><span className="animate-spin" style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%" }} /> Iniciando...</>
              : <><Send size={15} aria-hidden="true" /> Buscar oportunidades</>
            }
          </button>
        </div>
      </div>

      {/* Bot feedback */}
      {botMsg && (
        <div style={{
          padding: "12px 16px", borderRadius: "var(--radius-lg)", marginBottom: 16, fontSize: 13,
          background: botMsg.startsWith("Erro") ? "rgba(163,72,60,0.08)" : "rgba(52,115,92,0.08)",
          border: `1px solid ${botMsg.startsWith("Erro") ? "rgba(163,72,60,0.25)" : "rgba(52,115,92,0.25)"}`,
          color: botMsg.startsWith("Erro") ? "var(--red)" : "var(--green)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span>{botMsg}</span>
          <button onClick={() => setBotMsg(null)} aria-label="Fechar mensagem" style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", opacity: 0.6, display: "inline-flex" }}><X size={16}/></button>
        </div>
      )}

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
          <option value="candidaturas">Candidaturas e revisão</option>
          <option value="sem_duplicados">Sem duplicados</option>
          <option value="todos">Todos os status</option>
          <option value="enviado">Enviado</option>
          <option value="confirmed">Confirmado</option>
          <option value="pending_confirmation">Pendente de confirmação</option>
          <option value="duplicado">Duplicado</option>
          <option value="falhou">Falhou</option>
          <option value="nao_suportado">Não suportado</option>
          <option value="sem_submit">Sem envio</option>
        </select>
        <select value={filtroPlatforma} onChange={e => setFiltroPlatforma(e.target.value)} style={{ width: "auto", paddingRight: 32 }}>
          {plataformas.map(p => <option key={p} value={p}>{p === "todas" ? "Todas as plataformas" : p}</option>)}
        </select>
        <div role="group" aria-label="Modo de visualização" style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          <button type="button" onClick={() => setView("kanban")} aria-label="Visualização em kanban" aria-pressed={view === "kanban"} className="btn-ghost" style={{ borderRadius: 0, padding: "8px 10px", background: view === "kanban" ? "var(--bg-elevated)" : "transparent" }}><LayoutGrid size={15} /></button>
          <button type="button" onClick={() => setView("list")} aria-label="Visualização em lista" aria-pressed={view === "list"} className="btn-ghost" style={{ borderRadius: 0, padding: "8px 10px", background: view === "list" ? "var(--bg-elevated)" : "transparent" }}><List size={15} /></button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ padding: 40, borderRadius: "var(--radius-lg)", border: "1px dashed var(--border)", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>
            {apps.length === 0 ? <BriefcaseBusiness size={30} strokeWidth={1.5} /> : <Search size={30} strokeWidth={1.5} />}
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            {apps.length === 0 ? "Nenhuma candidatura registrada ainda. Configure suas preferências antes de executar uma automação." : "Nenhum resultado para os filtros."}
          </p>
        </div>
      ) : view === "kanban" ? (
        <div className="application-kanban" aria-label="Quadro de candidaturas">
          {TRACKING_STATUSES.slice(0, 7).map((status) => {
            const column = filtered.filter((app) => app.status === status);
            const info = STATUS_MAP[status];
            return <section className="kanban-column" key={status}><header><span style={{ color: info.color }}>{info.label}</span><small>{column.length}</small></header>{column.length === 0 ? <p className="kanban-empty">Nenhuma candidatura</p> : column.map((app) => <button type="button" className="kanban-card" key={app.id} onClick={() => setSelected(app)}><strong>{app.empresa || app.plataforma}</strong><span>{(app.vaga || "Sem título").replace(/-/g, " ")}</span><small>{app.plataforma} · {new Date(app.created_at).toLocaleDateString("pt-BR")}</small></button>)}</section>;
          })}
        </div>
      ) : (
        <div className="applications-table" style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", overflow: "hidden", background: "var(--bg-card)" }}>
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
                          <ExternalLink size={15} aria-label="Abrir vaga" />
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
            <button onClick={() => setSelected(null)} aria-label="Fechar detalhes" style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, width: 28, height: 28, cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15}/></button>

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

            <label style={{ display: "grid", gap: 7, marginBottom: 18 }}>
              <span style={{ color: "var(--text-tertiary)", fontSize: 11, fontWeight: 700, letterSpacing: ".08em" }}>ACOMPANHAMENTO</span>
              <select value={selected.status} onChange={(event) => { void updateStatus(event.target.value); }} disabled={savingStatus}>
                <option value={selected.status}>{STATUS_MAP[selected.status]?.label || selected.status}</option>
                {TRACKING_STATUSES.filter((status) => status !== selected.status).map((status) => <option key={status} value={status}>{STATUS_MAP[status].label}</option>)}
              </select>
              <small style={{ color: "var(--text-tertiary)" }}>Altere para “Candidatado” somente depois de confirmar o envio no site de origem.</small>
            </label>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr", marginBottom: 18 }}>
              <label style={{ display: "grid", gap: 6 }}><span className="eyebrow">CONTATO</span><input value={selected.company_contact || ""} placeholder="Nome ou e-mail" onChange={(event) => setSelected({ ...selected, company_contact: event.target.value })} onBlur={async () => { await supabase.from("applications").update({ company_contact: selected.company_contact || null }).eq("id", selected.id); }} /></label>
              <label style={{ display: "grid", gap: 6 }}><span className="eyebrow">FAIXA SALARIAL</span><input value={selected.salary_text || ""} placeholder="Ex.: R$ 6.000–8.000" onChange={(event) => setSelected({ ...selected, salary_text: event.target.value })} onBlur={async () => { await supabase.from("applications").update({ salary_text: selected.salary_text || null }).eq("id", selected.id); }} /></label>
              <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}><span className="eyebrow">NOTAS</span><textarea rows={3} value={selected.notes || ""} placeholder="Próximo passo, contexto da entrevista ou lembrete." onChange={(event) => setSelected({ ...selected, notes: event.target.value })} onBlur={async () => { await supabase.from("applications").update({ notes: selected.notes || null }).eq("id", selected.id); }} /></label>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              {selected.vaga_url && (
                <a href={selected.vaga_url} target="_blank" rel="noreferrer" className="btn-primary" style={{ textDecoration: "none", flex: 1, textAlign: "center", padding: "10px 0", fontSize: 13 }}>
                  Ver vaga <ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
              {cvUrl && (
                <a href={cvUrl} target="_blank" rel="noreferrer" className="btn-ghost" style={{ textDecoration: "none", flex: 1, textAlign: "center", padding: "10px 0", fontSize: 13 }}>
                  <FileText size={14} aria-hidden="true" /> Meu currículo
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
