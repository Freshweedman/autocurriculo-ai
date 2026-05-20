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
  tipo: string;
  created_at: string;
}

const fonteLabel: Record<string, string> = {
  google_search: "Google",
  google_maps: "Maps",
  google_freelancer: "Freelancer",
};

const fonteCor: Record<string, string> = {
  google_search: "#4285f4",
  google_maps: "#34a853",
  google_freelancer: "#fbbc04",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroFonte, setFiltroFonte] = useState("todas");
  const [selected, setSelected] = useState<Lead | null>(null);

  useEffect(() => { loadLeads(); }, []);

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

  const filtered = leads.filter(l => {
    const matchSearch = !search ||
      l.empresa?.toLowerCase().includes(search.toLowerCase()) ||
      l.site?.toLowerCase().includes(search.toLowerCase()) ||
      l.cidade?.toLowerCase().includes(search.toLowerCase());
    const matchFonte = filtroFonte === "todas" || l.fonte === filtroFonte;
    return matchSearch && matchFonte;
  });

  const comEmail = leads.filter(l => l.email).length;
  const comTelefone = leads.filter(l => l.telefone).length;

  const exportCSV = () => {
    const header = "Empresa,Telefone,Email,Site,Cidade,Fonte\n";
    const rows = filtered.map(l =>
      `"${l.empresa || ""}","${l.telefone || ""}","${l.email || ""}","${l.site || ""}","${l.cidade || ""}","${fonteLabel[l.fonte] || l.fonte || ""}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads_autocurriculo.csv";
    a.click();
  };

  if (loading) return <div className="text-muted">Carregando...</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Leads</h1>
          <p className="text-muted" style={{ marginTop: 4 }}>
            {leads.length} empresas · {comEmail} com email · {comTelefone} com telefone
          </p>
        </div>
        <button className="btn-primary" onClick={exportCSV}>Exportar CSV</button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total", value: leads.length, cor: "var(--primary)" },
          { label: "Com email", value: comEmail, cor: "var(--success)" },
          { label: "Com telefone", value: comTelefone, cor: "#f59e0b" },
          { label: "Google Maps", value: leads.filter(l => l.fonte === "google_maps").length, cor: "#34a853" },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: "center", padding: 16 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.cor }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Buscar empresa, site ou cidade..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <select value={filtroFonte} onChange={e => setFiltroFonte(e.target.value)} style={{ width: "auto" }}>
          <option value="todas">Todas as fontes</option>
          <option value="google_search">Google Search</option>
          <option value="google_maps">Google Maps</option>
          <option value="google_freelancer">Freelancer</option>
        </select>
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div className="card">
          <p className="text-muted" style={{ textAlign: "center" }}>
            {leads.length === 0 ? "Nenhum lead coletado ainda. O bot coleta automaticamente ao rodar." : "Nenhum resultado para os filtros."}
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Contato</th>
                <th>Site</th>
                <th>Cidade</th>
                <th>Fonte</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr key={lead.id} style={{ cursor: "pointer" }} onClick={() => setSelected(lead)}>
                  <td style={{ fontWeight: 500 }}>{lead.empresa || "-"}</td>
                  <td>
                    <div style={{ fontSize: 13 }}>{lead.email || ""}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{lead.telefone || ""}</div>
                    {!lead.email && !lead.telefone && <span style={{ color: "var(--text-muted)", fontSize: 12 }}>-</span>}
                  </td>
                  <td>
                    {lead.site ? (
                      <a href={lead.site} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 13 }}>
                        {lead.site.replace(/^https?:\/\//, "").split("/")[0].slice(0, 28)}
                      </a>
                    ) : "-"}
                  </td>
                  <td className="text-muted" style={{ fontSize: 13 }}>{lead.cidade || "-"}</td>
                  <td>
                    {lead.fonte && (
                      <span className="badge" style={{
                        background: `${fonteCor[lead.fonte] || "#6366f1"}22`,
                        color: fonteCor[lead.fonte] || "var(--primary)",
                        fontSize: 11,
                      }}>
                        {fonteLabel[lead.fonte] || lead.fonte}
                      </span>
                    )}
                  </td>
                  <td>
                    {lead.email && (
                      <a
                        href={`mailto:${lead.email}?subject=Oportunidade de parceria - Gestor de Tráfego&body=Olá! Sou Juan Goes, especialista em Gestão de Tráfego Pago com 6 anos de experiência. Gostaria de conversar sobre uma possível parceria.`}
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize: 12, color: "var(--primary)" }}
                      >
                        Enviar email ↗
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de detalhes do lead */}
      {selected && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
          onClick={() => setSelected(null)}
        >
          <div className="card" style={{ maxWidth: 480, width: "100%", position: "relative" }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelected(null)} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-muted)" }}>✕</button>

            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, paddingRight: 32 }}>{selected.empresa}</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              {selected.email && (
                <div style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>EMAIL</div>
                  <div style={{ fontSize: 14 }}>{selected.email}</div>
                </div>
              )}
              {selected.telefone && (
                <div style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>TELEFONE</div>
                  <div style={{ fontSize: 14 }}>{selected.telefone}</div>
                </div>
              )}
              {selected.site && (
                <div style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>SITE</div>
                  <a href={selected.site} target="_blank" rel="noreferrer" style={{ fontSize: 14 }}>{selected.site}</a>
                </div>
              )}
              {selected.cidade && (
                <div style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>CIDADE</div>
                  <div style={{ fontSize: 14 }}>{selected.cidade}</div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {selected.email && (
                <a
                  href={`mailto:${selected.email}?subject=Oportunidade de parceria - Gestor de Tráfego Pago&body=Olá!%0A%0ASou Juan Goes, especialista em Gestão de Tráfego Pago com 6 anos de experiência em Facebook Ads, Google Ads e TikTok Ads.%0A%0AGostaria de conversar sobre uma possível parceria ou oportunidade de trabalho.%0A%0AAtenciosamente,%0AJuan Goes%0A(51) 98468-9725`}
                  className="btn-primary"
                  style={{ textDecoration: "none", flex: 1, textAlign: "center", padding: "10px 0" }}
                >
                  ✉️ Enviar email
                </a>
              )}
              {selected.telefone && (
                <a
                  href={`https://wa.me/55${selected.telefone.replace(/\D/g, "")}?text=Olá! Sou Juan Goes, especialista em Gestão de Tráfego Pago. Gostaria de conversar sobre uma possível parceria.`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-outline"
                  style={{ textDecoration: "none", flex: 1, textAlign: "center", padding: "10px 0" }}
                >
                  💬 WhatsApp
                </a>
              )}
              {selected.site && (
                <a href={selected.site} target="_blank" rel="noreferrer" className="btn-outline" style={{ textDecoration: "none", flex: 1, textAlign: "center", padding: "10px 0" }}>
                  🌐 Site
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
