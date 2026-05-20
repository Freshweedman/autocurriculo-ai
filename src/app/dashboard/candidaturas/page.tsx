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

const statusBadge: Record<string, string> = {
  enviado: "badge-success",
  falhou: "badge-danger",
  pendente: "badge-warning",
  duplicado: "badge-warning",
  sem_submit: "badge-warning",
  sem_file_input: "badge-warning",
  nao_suportado: "badge-warning",
};

const statusLabel: Record<string, string> = {
  enviado: "Enviado",
  falhou: "Falhou",
  pendente: "Pendente",
  duplicado: "Duplicado",
  sem_submit: "Sem submit",
  sem_file_input: "Sem upload",
  nao_suportado: "Não suportado",
};

const plataformaCor: Record<string, string> = {
  "99Freelas": "#00b4d8",
  Workana: "#ff6b35",
  LinkedIn: "#0a66c2",
  InfoJobs: "#ff6600",
  Catho: "#00a651",
  Indeed: "#2164f3",
  TrabalhaBrasil: "#e63946",
  Vagas: "#6a0dad",
  TrabalheConosco: "#457b9d",
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

    // Pegar URL do curriculo para exibir
    const { data: urlData } = await supabase.storage
      .from("curriculos")
      .createSignedUrl(`${user.id}/curriculo.pdf`, 3600);
    if (urlData?.signedUrl) setCvUrl(urlData.signedUrl);
  };

  const plataformas = ["todas", ...Array.from(new Set(apps.map(a => a.plataforma)))];

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

  if (loading) return <div className="text-muted">Carregando...</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Candidaturas</h1>
          <p className="text-muted" style={{ marginTop: 4 }}>
            {enviadas} enviadas no total · {hoje} hoje
          </p>
        </div>
        {cvUrl && (
          <a href={cvUrl} target="_blank" rel="noreferrer" className="btn-outline" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            📄 Ver meu currículo
          </a>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Buscar empresa ou vaga..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ width: "auto" }}>
          <option value="todos">Todos os status</option>
          <option value="enviado">Enviado</option>
          <option value="duplicado">Duplicado</option>
          <option value="falhou">Falhou</option>
          <option value="nao_suportado">Não suportado</option>
        </select>
        <select value={filtroPlatforma} onChange={e => setFiltroPlatforma(e.target.value)} style={{ width: "auto" }}>
          {plataformas.map(p => <option key={p} value={p}>{p === "todas" ? "Todas as plataformas" : p}</option>)}
        </select>
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div className="card">
          <p className="text-muted" style={{ textAlign: "center" }}>
            {apps.length === 0 ? "Nenhuma candidatura ainda. Ative o bot nas configuracoes." : "Nenhum resultado para os filtros selecionados."}
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Empresa / Vaga</th>
                <th>Plataforma</th>
                <th>Status</th>
                <th>Data</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((app) => (
                <tr key={app.id} style={{ cursor: "pointer" }} onClick={() => setSelected(app)}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{app.empresa || "-"}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      {app.vaga?.replace(/-/g, " ").slice(0, 60) || "-"}
                    </div>
                  </td>
                  <td>
                    <span className="badge" style={{
                      background: `${plataformaCor[app.plataforma] || "#6366f1"}22`,
                      color: plataformaCor[app.plataforma] || "var(--primary)",
                    }}>
                      {app.plataforma}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${statusBadge[app.status] || "badge-warning"}`}>
                      {statusLabel[app.status] || app.status}
                    </span>
                  </td>
                  <td className="text-muted" style={{ fontSize: 13 }}>
                    {new Date(app.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td>
                    {app.vaga_url && (
                      <a
                        href={app.vaga_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize: 12, color: "var(--primary)" }}
                      >
                        Ver vaga ↗
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de detalhes */}
      {selected && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 20,
          }}
          onClick={() => setSelected(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 520, width: "100%", position: "relative" }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-muted)" }}
            >
              ✕
            </button>

            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, paddingRight: 32 }}>
              {selected.empresa || "Empresa"}
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
              {selected.vaga?.replace(/-/g, " ") || "Vaga"}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>PLATAFORMA</div>
                <span className="badge" style={{
                  background: `${plataformaCor[selected.plataforma] || "#6366f1"}22`,
                  color: plataformaCor[selected.plataforma] || "var(--primary)",
                }}>
                  {selected.plataforma}
                </span>
              </div>
              <div style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>STATUS</div>
                <span className={`badge ${statusBadge[selected.status] || "badge-warning"}`}>
                  {statusLabel[selected.status] || selected.status}
                </span>
              </div>
              <div style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>DATA</div>
                <div style={{ fontSize: 14 }}>{new Date(selected.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
              </div>
              <div style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>HORA</div>
                <div style={{ fontSize: 14 }}>{new Date(selected.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {selected.vaga_url && (
                <a href={selected.vaga_url} target="_blank" rel="noreferrer" className="btn-primary" style={{ textDecoration: "none", flex: 1, textAlign: "center", padding: "10px 0" }}>
                  Ver vaga ↗
                </a>
              )}
              {cvUrl && (
                <a href={cvUrl} target="_blank" rel="noreferrer" className="btn-outline" style={{ textDecoration: "none", flex: 1, textAlign: "center", padding: "10px 0" }}>
                  📄 Ver currículo enviado
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
