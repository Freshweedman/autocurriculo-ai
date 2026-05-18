"use client";

import { supabase } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

interface Metrics {
  today: number;
  semana: number;
  mes: number;
  leads: number;
  botAtivo: boolean;
  limiteDiario: number;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics>({
    today: 0, semana: 0, mes: 0, leads: 0, botAtivo: false, limiteDiario: 5,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

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
    });
    setLoading(false);
  };

  if (loading) {
    return <div className="text-muted">Carregando...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Dashboard</h1>
        <p className="text-muted" style={{ marginTop: 4 }}>
          {metrics.botAtivo ? "Bot ativo - enviando curriculos automaticamente" : "Bot pausado - ative nas configuracoes"}
        </p>
      </div>

      {/* Status do Bot */}
      <div className="card" style={{
        marginBottom: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 12, height: 12, borderRadius: "50%",
            background: metrics.botAtivo ? "var(--success)" : "var(--text-muted)",
            boxShadow: metrics.botAtivo ? "0 0 12px rgba(34,197,94,0.4)" : "none",
          }} />
          <div>
            <div style={{ fontWeight: 600 }}>Bot {metrics.botAtivo ? "Online" : "Offline"}</div>
            <div style={{ fontSize: 13 }} className="text-muted">
              Limite diario: {metrics.limiteDiario} curriculos
            </div>
          </div>
        </div>
        <a href="/dashboard/configuracoes" className="btn-outline" style={{ textDecoration: "none" }}>
          Configurar
        </a>
      </div>

      {/* Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
        <MetricCard label="Candidaturas Hoje" value={metrics.today} />
        <MetricCard label="Ultimos 7 dias" value={metrics.semana} />
        <MetricCard label="Ultimos 30 dias" value={metrics.mes} />
        <MetricCard label="Leads Coletados" value={metrics.leads} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Proximos passos</h3>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
            <li style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span className="badge badge-warning">1</span>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>Upload do curriculo</div>
                <div className="text-muted" style={{ fontSize: 13 }}>Envie seu curriculo em PDF</div>
              </div>
            </li>
            <li style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span className="badge badge-warning">2</span>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>Configurar cargo e cidade</div>
                <div className="text-muted" style={{ fontSize: 13 }}>Defina o cargo e localizacao da busca</div>
              </div>
            </li>
            <li style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span className="badge badge-warning">3</span>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>Ativar bot</div>
                <div className="text-muted" style={{ fontSize: 13 }}>Ligue o bot e ele roda todo dia as 9h</div>
              </div>
            </li>
          </ul>
        </div>
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Como funciona</h3>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
            <li style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ color: "var(--success)", fontSize: 16 }}>&#10003;</span>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>GitHub Actions</div>
                <div className="text-muted" style={{ fontSize: 13 }}>Roda em servidor externo, nao usa sua maquina</div>
              </div>
            </li>
            <li style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ color: "var(--success)", fontSize: 16 }}>&#10003;</span>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>Playwright</div>
                <div className="text-muted" style={{ fontSize: 13 }}>Simula um navegador real, mais discreto</div>
              </div>
            </li>
            <li style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ color: "var(--success)", fontSize: 16 }}>&#10003;</span>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>Delay humano</div>
                <div className="text-muted" style={{ fontSize: 13 }}>Intervalos aleatorios para evitar deteccao</div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div style={{ fontSize: 32, fontWeight: 700, color: "var(--primary)" }}>{value}</div>
      <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>{label}</div>
    </div>
  );
}
