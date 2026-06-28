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

interface UserProfile {
  cargo: string;
  email: string;
  nome: string;
}

const buildEmailMsg = (empresa: string, profile: UserProfile) =>
  `Olá, equipe ${empresa}!

Meu nome é ${profile.nome || profile.email}, sou especialista em ${profile.cargo || "Marketing Digital"}.

Gostaria de entender os desafios de marketing da ${empresa} e apresentar como posso ajudar a escalar os resultados.

Podemos marcar uma conversa rápida de 15 minutos?

Atenciosamente,
${profile.nome || profile.email}`;

const buildWhatsappMsg = (empresa: string, profile: UserProfile) =>
  `Olá! Sou ${profile.nome || profile.email}, especialista em ${profile.cargo || "marketing digital"}. Vi a ${empresa} e gostaria de conversar sobre uma parceria. Tem 5 minutos?`;

export default function ProspeccaoPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "email" | "whatsapp" | "site">("todos");
  const [contatados, setContatados] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Lead | null>(null);
  const [profile, setProfile] = useState<UserProfile>({ cargo: "", email: "", nome: "" });

  useEffect(() => {
    loadLeads();
    const saved = localStorage.getItem("prospeccao_contatados");
    if (saved) setContatados(new Set(JSON.parse(saved)));
  }, []);

  const loadLeads = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: leadsData }, { data: profileData }] = await Promise.all([
      supabase.from("leads_google").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500),
      supabase.from("profiles").select("cargo").eq("user_id", user.id).single(),
    ]);

    setLeads(leadsData || []);
    setProfile({ cargo: profileData?.cargo || "", email: user.email || "", nome: "" });
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

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
      <div className="animate-spin" style={{ width: 24, height: 24, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%" }} />
    </div>
  );

  return (
    <div style={{ maxWidth: 840, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em" }}>Prospecção Ativa</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>
          Contate empresas diretamente — {leads.length - contatados.size} para contatar · {contatados.size} já contatados
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Total", value: leads.length, color: "var(--accent)" },
          { label: "Com email", value: leads.filter(l => l.email).length, color: "var(--green)" },
          { label: "Com WhatsApp", value: leads.filter(l => l.telefone).length, color: "#25d366" },
          { label: "Contatados", value: contatados.size, color: "var(--text-tertiary)" },
          { label: "Restantes", value: leads.length - contatados.size, color: "var(--orange)" },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: "center", padding: 14 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 20, padding: "12px 16px", borderRadius: "var(--radius)", background: "rgba(255,159,10,0.06)", border: "1px solid rgba(255,159,10,0.15)" }}>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--orange)" }}>💡 Dica:</strong> Foque nos leads com email primeiro — taxa de resposta maior.
          Envie 10–20 por dia para não cair em spam.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", pointerEvents: "none" }}>
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input type="text" placeholder="Buscar empresa ou cidade..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["todos", "email", "whatsapp", "site"] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{
              padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)",
              background: filtro === f ? "var(--accent)" : "transparent",
              color: filtro === f ? "white" : "var(--text-secondary)",
              fontSize: 12, cursor: "pointer", transition: "all 0.15s",
            }}>
              {f === "todos" ? "Todos" : f === "email" ? "📧" : f === "whatsapp" ? "💬" : "🌐"}
            </button>
          ))}
        </div>
      </div>

      {leads.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, borderRadius: "var(--radius-lg)", border: "1px dashed var(--border)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
          <h3 style={{ marginBottom: 8 }}>Nenhum lead ainda</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20 }}>
            Rode o bot para coletar empresas automaticamente via Google Maps
          </p>
          <button className="btn-primary" onClick={async () => {
            const res = await fetch("/api/run-bot", { method: "POST" });
            const d = await res.json();
            alert(d.ok ? "Bot iniciado! Leads aparecem em ~5 minutos." : d.error);
          }}>▶ Rodar Bot Agora</button>
        </div>
      ) : (
        <>
          {naoContatados.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: "var(--orange)" }}>
                Para contatar ({naoContatados.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {naoContatados.map(lead => (
                  <LeadCard key={lead.id} lead={lead} contatado={false} onMarcar={() => marcarContatado(lead.id)} onSelect={() => setSelected(lead)} />
                ))}
              </div>
            </div>
          )}
          {jaContatados.length > 0 && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: "var(--text-tertiary)" }}>
                Já contatados ({jaContatados.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {jaContatados.map(lead => (
                  <LeadCard key={lead.id} lead={lead} contatado={true} onMarcar={() => marcarContatado(lead.id)} onSelect={() => setSelected(lead)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
          onClick={() => setSelected(null)}>
          <div style={{ maxWidth: 520, width: "100%", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", padding: 24, position: "relative", maxHeight: "90vh", overflow: "auto", boxShadow: "var(--shadow-elevated)" }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelected(null)} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, width: 28, height: 28, cursor: "pointer", color: "var(--text-secondary)", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, paddingRight: 36 }}>{selected.empresa}</h3>
            <p style={{ color: "var(--text-tertiary)", fontSize: 13, marginBottom: 20 }}>{selected.cidade}</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {selected.email && (
                <div style={{ background: "var(--bg)", borderRadius: "var(--radius-sm)", padding: "10px 14px" }}>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 3, letterSpacing: "0.06em", fontWeight: 600 }}>EMAIL</div>
                  <div style={{ fontSize: 14 }}>{selected.email}</div>
                </div>
              )}
              {selected.telefone && (
                <div style={{ background: "var(--bg)", borderRadius: "var(--radius-sm)", padding: "10px 14px" }}>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 3, letterSpacing: "0.06em", fontWeight: 600 }}>WHATSAPP / TELEFONE</div>
                  <div style={{ fontSize: 14 }}>{selected.telefone}</div>
                </div>
              )}
              {selected.site && (
                <div style={{ background: "var(--bg)", borderRadius: "var(--radius-sm)", padding: "10px 14px" }}>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 3, letterSpacing: "0.06em", fontWeight: 600 }}>SITE</div>
                  <a href={selected.site} target="_blank" rel="noreferrer" style={{ fontSize: 14 }}>{selected.site}</a>
                </div>
              )}
            </div>

            {selected.email && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 8, letterSpacing: "0.06em", fontWeight: 600 }}>MENSAGEM DE EMAIL (clique para copiar)</div>
                <div
                  style={{ background: "var(--bg)", borderRadius: "var(--radius-sm)", padding: 14, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", cursor: "pointer", border: "1px solid var(--border)" }}
                  onClick={() => { navigator.clipboard.writeText(buildEmailMsg(selected.empresa, profile)); alert("Copiado!"); }}
                >
                  {buildEmailMsg(selected.empresa, profile)}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {selected.email && (
                <a href={`mailto:${selected.email}?subject=Parceria em ${profile.cargo || "Marketing Digital"}&body=${encodeURIComponent(buildEmailMsg(selected.empresa, profile))}`}
                  className="btn-primary" style={{ textDecoration: "none", flex: 1, textAlign: "center", padding: "10px 0", fontSize: 13 }}
                  onClick={() => marcarContatado(selected.id)}>
                  ✉️ Enviar Email
                </a>
              )}
              {selected.telefone && (
                <a href={`https://wa.me/55${selected.telefone.replace(/\D/g, "")}?text=${encodeURIComponent(buildWhatsappMsg(selected.empresa, profile))}`}
                  target="_blank" rel="noreferrer"
                  style={{ textDecoration: "none", flex: 1, textAlign: "center", padding: "10px 0", fontSize: 13, background: "rgba(37,211,102,0.1)", border: "1px solid #25d36640", borderRadius: "var(--radius-sm)", color: "#25d366", fontWeight: 500 }}
                  onClick={() => marcarContatado(selected.id)}>
                  💬 WhatsApp
                </a>
              )}
              {selected.site && (
                <a href={selected.site} target="_blank" rel="noreferrer" className="btn-outline"
                  style={{ textDecoration: "none", flex: 1, textAlign: "center", padding: "10px 0", fontSize: 13 }}>
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
  lead: Lead; contatado: boolean; onMarcar: () => void; onSelect: () => void;
}) {
  return (
    <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", cursor: "pointer", opacity: contatado ? 0.55 : 1, gap: 12, flexWrap: "wrap" }}
      onClick={onSelect}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
          {contatado && <span style={{ color: "var(--green)", fontSize: 12 }}>✓</span>}
          {lead.empresa}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
          {[lead.cidade, lead.email, lead.telefone].filter(Boolean).join(" · ").slice(0, 80)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        {lead.email && <span style={{ fontSize: 15 }} title={lead.email}>📧</span>}
        {lead.telefone && <span style={{ fontSize: 15 }} title={lead.telefone}>💬</span>}
        {lead.site && <span style={{ fontSize: 15 }} title={lead.site}>🌐</span>}
        <button className={contatado ? "btn-outline" : "btn-primary"} style={{ padding: "5px 12px", fontSize: 11 }}
          onClick={e => { e.stopPropagation(); onMarcar(); }}>
          {contatado ? "Desfazer" : "Marcar contatado"}
        </button>
      </div>
    </div>
  );
}
