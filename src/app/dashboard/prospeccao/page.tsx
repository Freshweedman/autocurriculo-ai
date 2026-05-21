"use client";

import { supabase } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

interface Lead {
  id: string;
  empresa: string;
  telefone: string;
  site: string;
  email: string;
  cidade: string;
  fonte: string;
  created_at: string;
}

const MENSAGEM_EMAIL = (empresa: string) =>
  `Olá, equipe ${empresa}!

Meu nome é Juan Goes, sou especialista em Gestão de Tráfego Pago com 6 anos de experiência em Facebook Ads, Google Ads e TikTok Ads.

Trabalho com foco total em ROI/ROAS e crescimento previsível. Já gerenciei campanhas para e-commerces, infoprodutos e negócios locais, com resultados comprovados.

Gostaria de entender os desafios de marketing da ${empresa} e apresentar como posso ajudar a escalar os resultados.

Podemos marcar uma conversa rápida de 15 minutos?

Atenciosamente,
Juan Goes
(51) 98468-9725
emailjg4@gmail.com`;

const MENSAGEM_WHATSAPP = (empresa: string) =>
  `Olá! Sou Juan Goes, especialista em Gestão de Tráfego Pago (Facebook Ads, Google Ads, TikTok Ads). Vi a ${empresa} e gostaria de conversar sobre como posso ajudar a escalar os resultados de marketing. Podemos bater um papo rápido?`;

export default function ProspeccaoPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "email" | "whatsapp" | "site">("todos");
  const [contatados, setContatados] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Lead | null>(null);

  useEffect(() => {
    loadLeads();
    // Carregar contatados do localStorage
    const saved = localStorage.getItem("prospeccao_contatados");
    if (saved) setContatados(new Set(JSON.parse(saved)));
  }, []);

  const loadLeads = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("leads_google")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);

    setLeads(data || []);
    setLoading(false);
  };

  const marcarContatado = (id: string) => {
    const novo = new Set(contatados);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    setContatados(novo);
    localStorage.setItem("prospeccao_contatados", JSON.stringify(Array.from(novo)));
  };

  const filtered = leads.filter(l => {
    const matchSearch = !search ||
      l.empresa?.toLowerCase().includes(search.toLowerCase()) ||
      l.cidade?.toLowerCase().includes(search.toLowerCase());
    const matchFiltro =
      filtro === "todos" ||
      (filtro === "email" && l.email) ||
      (filtro === "whatsapp" && l.telefone) ||
      (filtro === "site" && l.site);
    return matchSearch && matchFiltro;
  });

  const naoContatados = filtered.filter(l => !contatados.has(l.id));
  const jaContatados = filtered.filter(l => contatados.has(l.id));

  const comEmail = leads.filter(l => l.email).length;
  const comTel = leads.filter(l => l.telefone).length;

  if (loading) return <div className="text-muted">Carregando...</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Prospecção Ativa</h1>
        <p className="text-muted" style={{ marginTop: 4 }}>
          Contate empresas diretamente — email, WhatsApp ou visita ao site
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total de leads", value: leads.length, cor: "var(--primary)" },
          { label: "Com email", value: comEmail, cor: "var(--success)" },
          { label: "Com WhatsApp", value: comTel, cor: "#25d366" },
          { label: "Já contatados", value: contatados.size, cor: "var(--text-muted)" },
          { label: "Para contatar", value: leads.length - contatados.size, cor: "#f59e0b" },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: "center", padding: 14 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.cor }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Dica */}
      <div style={{
        marginBottom: 20, padding: "12px 16px", borderRadius: 8,
        background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
      }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
          <strong style={{ color: "#f59e0b" }}>💡 Dica:</strong> Foque primeiro nos leads com email — a taxa de resposta é maior.
          Envie 10-20 emails por dia para não cair em spam. Use o botão &quot;Marcar contatado&quot; para acompanhar o progresso.
        </p>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Buscar empresa ou cidade..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          {(["todos", "email", "whatsapp", "site"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              style={{
                padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)",
                background: filtro === f ? "var(--primary)" : "transparent",
                color: filtro === f ? "white" : "var(--text-muted)",
                fontSize: 13, cursor: "pointer",
              }}
            >
              {f === "todos" ? "Todos" : f === "email" ? "📧 Email" : f === "whatsapp" ? "💬 WhatsApp" : "🌐 Site"}
            </button>
          ))}
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🎯</div>
          <h3 style={{ marginBottom: 8 }}>Nenhum lead ainda</h3>
          <p className="text-muted" style={{ marginBottom: 20 }}>
            Rode o bot para coletar empresas automaticamente via Google Maps
          </p>
          <button className="btn-primary" onClick={async () => {
            const res = await fetch("/api/run-bot", { method: "POST" });
            const d = await res.json();
            alert(d.ok ? "Bot iniciado! Leads aparecem em ~5 minutos." : d.error);
          }}>
            ▶ Rodar Bot Agora
          </button>
        </div>
      ) : (
        <>
          {/* Não contatados */}
          {naoContatados.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: "#f59e0b" }}>
                Para contatar ({naoContatados.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {naoContatados.map(lead => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    contatado={false}
                    onMarcar={() => marcarContatado(lead.id)}
                    onSelect={() => setSelected(lead)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Já contatados */}
          {jaContatados.length > 0 && (
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: "var(--text-muted)" }}>
                Já contatados ({jaContatados.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {jaContatados.map(lead => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    contatado={true}
                    onMarcar={() => marcarContatado(lead.id)}
                    onSelect={() => setSelected(lead)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {selected && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
          onClick={() => setSelected(null)}
        >
          <div className="card" style={{ maxWidth: 560, width: "100%", position: "relative", maxHeight: "90vh", overflow: "auto" }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelected(null)} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-muted)" }}>✕</button>

            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, paddingRight: 32 }}>{selected.empresa}</h3>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 20 }}>{selected.cidade}</p>

            {/* Contatos */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {selected.email && (
                <div style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>EMAIL</div>
                  <div style={{ fontSize: 14 }}>{selected.email}</div>
                </div>
              )}
              {selected.telefone && (
                <div style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>TELEFONE / WHATSAPP</div>
                  <div style={{ fontSize: 14 }}>{selected.telefone}</div>
                </div>
              )}
              {selected.site && (
                <div style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>SITE</div>
                  <a href={selected.site} target="_blank" rel="noreferrer" style={{ fontSize: 14 }}>{selected.site}</a>
                </div>
              )}
            </div>

            {/* Mensagem de email preview */}
            {selected.email && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>MENSAGEM DE EMAIL (clique para copiar)</div>
                <div
                  style={{
                    background: "var(--bg)", borderRadius: 8, padding: 14, fontSize: 13,
                    lineHeight: 1.6, whiteSpace: "pre-wrap", cursor: "pointer",
                    border: "1px solid var(--border)",
                  }}
                  onClick={() => {
                    navigator.clipboard.writeText(MENSAGEM_EMAIL(selected.empresa));
                    alert("Mensagem copiada!");
                  }}
                >
                  {MENSAGEM_EMAIL(selected.empresa)}
                </div>
              </div>
            )}

            {/* Botões de ação */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {selected.email && (
                <a
                  href={`mailto:${selected.email}?subject=Parceria em Gestão de Tráfego Pago - Juan Goes&body=${encodeURIComponent(MENSAGEM_EMAIL(selected.empresa))}`}
                  className="btn-primary"
                  style={{ textDecoration: "none", flex: 1, textAlign: "center", padding: "10px 0" }}
                  onClick={() => marcarContatado(selected.id)}
                >
                  ✉️ Enviar Email
                </a>
              )}
              {selected.telefone && (
                <a
                  href={`https://wa.me/55${selected.telefone.replace(/\D/g, "")}?text=${encodeURIComponent(MENSAGEM_WHATSAPP(selected.empresa))}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-outline"
                  style={{ textDecoration: "none", flex: 1, textAlign: "center", padding: "10px 0", background: "rgba(37,211,102,0.1)", borderColor: "#25d366", color: "#25d366" }}
                  onClick={() => marcarContatado(selected.id)}
                >
                  💬 WhatsApp
                </a>
              )}
              {selected.site && (
                <a
                  href={selected.site}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-outline"
                  style={{ textDecoration: "none", flex: 1, textAlign: "center", padding: "10px 0" }}
                >
                  🌐 Ver Site
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LeadCard({ lead, contatado, onMarcar, onSelect }: {
  lead: Lead;
  contatado: boolean;
  onMarcar: () => void;
  onSelect: () => void;
}) {
  return (
    <div
      className="card"
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px", cursor: "pointer", opacity: contatado ? 0.6 : 1,
        gap: 12, flexWrap: "wrap",
      }}
      onClick={onSelect}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
          {contatado && <span style={{ color: "var(--success)", fontSize: 12 }}>✓</span>}
          {lead.empresa}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
          {[lead.cidade, lead.email, lead.telefone].filter(Boolean).join(" · ").slice(0, 80)}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        {lead.email && <span style={{ fontSize: 16 }} title={lead.email}>📧</span>}
        {lead.telefone && <span style={{ fontSize: 16 }} title={lead.telefone}>💬</span>}
        {lead.site && <span style={{ fontSize: 16 }} title={lead.site}>🌐</span>}

        <button
          className={contatado ? "btn-outline" : "btn-primary"}
          style={{ padding: "6px 12px", fontSize: 12 }}
          onClick={e => { e.stopPropagation(); onMarcar(); }}
        >
          {contatado ? "Desfazer" : "Marcar contatado"}
        </button>
      </div>
    </div>
  );
}
