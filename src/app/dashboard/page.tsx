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
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics>({
    today: 0, semana: 0, mes: 0, leads: 0, botAtivo: false, limiteDiario: 5, cargo: "",
  });
  const [loading, setLoading] = useState(true);
  const [rodando, setRodando] = useState(false);
  const [botMsg, setBotMsg] = useState("");

  useEffect(() => { loadMetrics(); }, []);

  const loadMetrics = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const hoje = new Date().toISOString().split("T")[0];
    const semanaAtras = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    const mesAtras = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

    const [{ count: hojeCount }, { count: semanaCount }, { count: mesCount }, { count: leadsCount }, { data: profile }] =
      await Promise.all([
        supabase.from("applications").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", hoje),
        supabase.from("applications").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", semanaAtras),
        supabase.from("applications").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", mesAtras),
        supabase.from("leads_google").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
      ]);

    setMetrics({
      today: hojeCount || 0,
      semana: semanaCount || 0,
      mes: mesCount || 0,
      leads: leadsCount || 0,
      botAtivo: profile?.bot_ativo ?? false,
      limiteDiario: profile?.limite_diario ?? 5,
      cargo: profile?.cargo || "gestor de trafego",
    });
    setLoading(false);
  };

  const handleRodarBot = async () => {
    setRodando(true);
    setBotMsg("");
    try {
      const res = await fetch("/api/run-bot", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setBotMsg("✓ Bot iniciado! Candidaturas aparecem aqui em ~5 minutos.");
      } else {
        setBotMsg(`Erro: ${data.error}`);
      }
    } catch {
      setBotMsg("Erro ao conectar. Tente pelo GitHub Actions.");
    }
    setRodando(false);
    setTimeout(() => setBotMsg(""), 8000);
  };

  if (loading) return <div className="text-muted">Carregando...</div>;

  return (
    <div>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Dashboard</h1>
          <p className="text-muted" style={{ marginTop: 4 }}>
            Buscando: <strong style={{ color: "var(--text)" }}>{metrics.cargo}</strong>
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={handleRodarBot}
          disabled={rodando}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px" }}
        >
          {rodando ? (
            <><span className="animate-spin" style={{ display: "inline-block" }}>⟳</span> Iniciando...</>
          ) : (
            <><span>▶</span> Rodar Bot Agora</>
          )}
        </button>
      </div>

      {botMsg && (
        <div style={{
          marginBottom: 20, padding: "12px 16px", borderRadius: 8,
          background: botMsg.startsWith("✓") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${botMsg.startsWith("✓") ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
          color: botMsg.startsWith("✓") ? "var(--success)" : "var(--danger)",
          fontSize: 14,
        }}>
          {botMsg}
        </div>
      )}

      {/* Status do Bot */}
      <div className="card" style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 12, height: 12, borderRadius: "50%",
            background: metrics.botAtivo ? "var(--success)" : "var(--text-muted)",
            boxShadow: metrics.botAtivo ? "0 0 12px rgba(34,197,94,0.4)" : "none",
          }} />
          <div>
            <div style={{ fontWeight: 600 }}>Bot {metrics.botAtivo ? "Ativo" : "Pausado"}</div>
            <div style={{ fontSize: 13 }} className="text-muted">
              {metrics.botAtivo ? `Roda automaticamente Seg-Sex 9h · Limite: ${metrics.limiteDiario}/dia` : "Ative nas configurações para rodar automaticamente"}
            </div>
          </div>
        </div>
        <Link href="/dashboard/configuracoes" className="btn-outline" style={{ textDecoration: "none" }}>
          Configurar
        </Link>
      </div>

      {/* Métricas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
        <MetricCard label="Candidaturas Hoje" value={metrics.today} cor="var(--primary)" link="/dashboard/candidaturas" />
        <MetricCard label="Últimos 7 dias" value={metrics.semana} cor="#6366f1" link="/dashboard/candidaturas" />
        <MetricCard label="Últimos 30 dias" value={metrics.mes} cor="#8b5cf6" link="/dashboard/candidaturas" />
        <MetricCard label="Leads Coletados" value={metrics.leads} cor="var(--success)" link="/dashboard/leads" />
      </div>

      {/* Ações rápidas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <AcaoCard
          icon="🎯"
          titulo="Prospecção Ativa"
          descricao="Busque empresas e envie propostas direto"
          href="/dashboard/prospeccao"
          cor="#f59e0b"
        />
        <AcaoCard
          icon="📋"
          titulo="Ver Candidaturas"
          descricao={`${metrics.mes} candidaturas este mês`}
          href="/dashboard/candidaturas"
          cor="var(--primary)"
        />
        <AcaoCard
          icon="📞"
          titulo="Leads para Contatar"
          descricao={`${metrics.leads} empresas coletadas`}
          href="/dashboard/leads"
          cor="var(--success)"
        />
        <AcaoCard
          icon="⚙️"
          titulo="Configurações"
          descricao="Plataformas, cargo e currículo"
          href="/dashboard/configuracoes"
          cor="var(--text-muted)"
        />
      </div>

      {/* Como funciona */}
      <div className="card">
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Como maximizar resultados</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {[
            { n: "1", t: "Rodar o bot", d: "Clique em 'Rodar Bot Agora' ou aguarde 9h" },
            { n: "2", t: "Prospecção ativa", d: "Use a ferramenta de prospecção para contatar agências" },
            { n: "3", t: "Contatar leads", d: "Envie email/WhatsApp para as empresas coletadas" },
            { n: "4", t: "Acompanhar", d: "Veja candidaturas e status em tempo real" },
          ].map(s => (
            <div key={s.n} style={{ display: "flex", gap: 10 }}>
              <span className="badge badge-warning" style={{ flexShrink: 0, height: "fit-content" }}>{s.n}</span>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{s.t}</div>
                <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, cor, link }: { label: string; value: number; cor: string; link: string }) {
  return (
    <Link href={link} style={{ textDecoration: "none" }}>
      <div className="card" style={{ textAlign: "center", cursor: "pointer", transition: "border-color 0.2s" }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = cor)}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
        <div style={{ fontSize: 32, fontWeight: 700, color: cor }}>{value}</div>
        <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>{label}</div>
      </div>
    </Link>
  );
}

function AcaoCard({ icon, titulo, descricao, href, cor }: { icon: string; titulo: string; descricao: string; href: string; cor: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div className="card" style={{ cursor: "pointer", transition: "border-color 0.2s, background 0.2s" }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = cor; e.currentTarget.style.background = "var(--bg-card-hover)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--bg-card)"; }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{titulo}</div>
        <div className="text-muted" style={{ fontSize: 12 }}>{descricao}</div>
      </div>
    </Link>
  );
}
