"use client";

import { supabase } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Metrics {
  today: number;
  semana: number;
  mes: number;
  leads: number;
  botAtivo: boolean;
  limiteDiario: number;
  cargo: string;
  totalEnviadas: number;
}

interface RecentApp {
  id: string;
  empresa: string;
  vaga: string;
  vaga_url: string | null;
  plataforma: string;
  status: string;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  enviado: "var(--green)",
  falhou: "var(--red)",
  duplicado: "var(--orange)",
  nao_suportado: "var(--text-tertiary)",
  sem_submit: "var(--text-tertiary)",
  sem_file_input: "var(--text-tertiary)",
  pendente: "var(--orange)",
};

const PLAT_COLOR: Record<string, string> = {
  LinkedIn: "#0A66C2", Indeed: "#2164F3", InfoJobs: "#FF6600",
  Catho: "#00A651", Workana: "#FF6B35", "99Freelas": "#00B4D8",
  GetNinjas: "#E63946", Sine: "#6A0DAD", TrabalhaBrasil: "#E63946",
  Vagas: "#6A0DAD", TrabalheConosco: "#457B9D", EmpregoLigado: "#F59E0B",
};

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics>({
    today: 0, semana: 0, mes: 0, leads: 0, botAtivo: false, limiteDiario: 5, cargo: "", totalEnviadas: 0,
  });
  const [recent, setRecent] = useState<RecentApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [rodando, setRodando] = useState(false);
  const [botMsg, setBotMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const hoje = new Date().toISOString().split("T")[0];
    const semanaAtras = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    const mesAtras = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

    const [
      { count: hojeCount },
      { count: semanaCount },
      { count: mesCount },
      { count: totalCount },
      { count: leadsCount },
      { data: profile },
      { data: recentData },
    ] = await Promise.all([
      supabase.from("applications").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "enviado").gte("created_at", hoje),
      supabase.from("applications").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "enviado").gte("created_at", semanaAtras),
      supabase.from("applications").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "enviado").gte("created_at", mesAtras),
      supabase.from("applications").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "enviado"),
      supabase.from("leads_google").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
      supabase.from("applications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8),
    ]);

    setMetrics({
      today: hojeCount || 0,
      semana: semanaCount || 0,
      mes: mesCount || 0,
      leads: leadsCount || 0,
      botAtivo: profile?.bot_ativo ?? false,
      limiteDiario: profile?.limite_diario ?? 5,
      cargo: profile?.cargo || "",
      totalEnviadas: totalCount || 0,
    });
    setRecent(recentData || []);
    setLoading(false);
  };

  const handleRodarBot = async () => {
    setRodando(true);
    setBotMsg(null);
    try {
      const res = await fetch("/api/run-bot", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setBotMsg({ text: "Bot iniciado! Candidaturas aparecem aqui em ~5 minutos.", type: "success" });
      } else {
        setBotMsg({ text: data.error || "Erro ao iniciar o bot.", type: "error" });
      }
    } catch {
      setBotMsg({ text: "Erro de conexão.", type: "error" });
    }
    setRodando(false);
    setTimeout(() => setBotMsg(null), 8000);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div className="animate-spin" style={{ width: 28, height: 28, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%" }} />
          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em" }}>Visão Geral</h1>
          {metrics.cargo && (
            <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>
              Buscando vagas para{" "}
              <span style={{ color: "var(--text)", fontWeight: 500 }}>{metrics.cargo}</span>
            </p>
          )}
        </div>
        <button
          className="btn-primary"
          onClick={handleRodarBot}
          disabled={rodando}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600 }}
        >
          {rodando ? (
            <>
              <span className="animate-spin" style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%" }} />
              Iniciando...
            </>
          ) : (
            <>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polygon points="5 3 19 12 5 21 5 3" fill="currentColor" /></svg>
              Rodar Bot
            </>
          )}
        </button>
      </div>

      {/* Toast */}
      {botMsg && (
        <div className={`toast ${botMsg.type === "success" ? "toast-success" : "toast-error"}`}>
          {botMsg.type === "success" ? "✓" : "⚠"} {botMsg.text}
        </div>
      )}

      {/* Bot status banner */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 18px", borderRadius: "var(--radius-lg)",
        background: metrics.botAtivo ? "rgba(48,209,88,0.06)" : "var(--bg-card)",
        border: `1px solid ${metrics.botAtivo ? "rgba(48,209,88,0.2)" : "var(--border)"}`,
        marginBottom: 24,
        flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: metrics.botAtivo ? "var(--green)" : "var(--text-tertiary)",
            boxShadow: metrics.botAtivo ? "0 0 10px rgba(48,209,88,0.6)" : "none",
            flexShrink: 0,
          }} />
          <div>
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              Bot {metrics.botAtivo ? "Ativo" : "Pausado"}
            </span>
            <span style={{ color: "var(--text-secondary)", fontSize: 13, marginLeft: 10 }}>
              {metrics.botAtivo
                ? `Executa Seg–Sex às 9h · Limite: ${metrics.limiteDiario} por plataforma`
                : "Ative nas configurações para execução automática diária"}
            </span>
          </div>
        </div>
        <Link href="/dashboard/configuracoes" className="btn-ghost" style={{ fontSize: 13, padding: "6px 14px" }}>
          Configurar
        </Link>
      </div>

      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 28 }}>
        <MetricCard label="Hoje" value={metrics.today} sub="candidaturas enviadas" color="var(--accent)" href="/dashboard/candidaturas" />
        <MetricCard label="7 dias" value={metrics.semana} sub="candidaturas enviadas" color="var(--purple)" href="/dashboard/candidaturas" />
        <MetricCard label="30 dias" value={metrics.mes} sub="candidaturas enviadas" color="var(--orange)" href="/dashboard/candidaturas" />
        <MetricCard label="Total" value={metrics.totalEnviadas} sub="desde o início" color="var(--green)" href="/dashboard/candidaturas" />
        <MetricCard label="Leads" value={metrics.leads} sub="empresas coletadas" color="#30D158" href="/dashboard/leads" />
      </div>

      {/* Recent activity + Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "start" }}>
        {/* Recent activity */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Atividade Recente</h2>
            <Link href="/dashboard/candidaturas" style={{ fontSize: 13, color: "var(--accent)" }}>Ver todas →</Link>
          </div>

          {recent.length === 0 ? (
            <div style={{
              padding: 32, borderRadius: "var(--radius-lg)", border: "1px dashed var(--border)",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🤖</div>
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Nenhuma candidatura ainda.</p>
              <p style={{ color: "var(--text-tertiary)", fontSize: 13, marginTop: 4 }}>Clique em &quot;Rodar Bot&quot; para começar.</p>
            </div>
          ) : (
            <div style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", overflow: "hidden", background: "var(--bg-card)" }}>
              {recent.map((app, i) => (
                <div
                  key={app.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                    borderBottom: i < recent.length - 1 ? "1px solid var(--divider)" : "none",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  {/* Platform dot */}
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: `${PLAT_COLOR[app.plataforma] || "#6366f1"}20`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: PLAT_COLOR[app.plataforma] || "var(--accent)" }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {app.empresa || app.plataforma}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {(app.vaga || "").replace(/-/g, " ").slice(0, 60) || app.plataforma}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLOR[app.status] || "var(--text-tertiary)" }} />
                    {app.vaga_url && (
                      <a href={app.vaga_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--accent)" }}>↗</a>
                    )}
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", minWidth: 42, textAlign: "right" }}>
                      {new Date(app.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 200 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Atalhos</h2>
          {[
            { href: "/dashboard/candidaturas", icon: "📋", label: "Candidaturas", sub: `${metrics.mes} este mês` },
            { href: "/dashboard/leads", icon: "📞", label: "Leads", sub: `${metrics.leads} coletados` },
            { href: "/dashboard/prospeccao", icon: "🎯", label: "Prospecção", sub: "Contatar empresas" },
            { href: "/dashboard/marketplace", icon: "🛒", label: "Marketplace", sub: "Anunciar serviços" },
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                borderRadius: "var(--radius)", background: "var(--bg-card)",
                border: "1px solid var(--border)", textDecoration: "none",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(10,132,255,0.3)"; e.currentTarget.style.background = "var(--bg-card-hover)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--bg-card)"; }}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{item.label}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{item.sub}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, color, href }: { label: string; value: number; sub: string; color: string; href: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        className="card"
        style={{ cursor: "pointer", transition: "all 0.15s", position: "relative", overflow: "hidden" }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}50`; e.currentTarget.style.transform = "translateY(-1px)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "translateY(0)"; }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          {label}
        </div>
        <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.04em", color, lineHeight: 1 }}>
          {value.toLocaleString("pt-BR")}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 6 }}>{sub}</div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}30, transparent)` }} />
      </div>
    </Link>
  );
}
