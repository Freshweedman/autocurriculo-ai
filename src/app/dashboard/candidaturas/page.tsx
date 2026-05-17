"use client";

import { supabase } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

interface Application {
  id: string;
  empresa: string;
  vaga: string;
  plataforma: string;
  status: string;
  created_at: string;
}

const statusBadge: Record<string, string> = {
  enviado: "badge-success",
  falhou: "badge-danger",
  pendente: "badge-warning",
  duplicado: "badge-warning",
};

export default function CandidaturasPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCandidaturas();
  }, []);

  const loadCandidaturas = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("applications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);

    setApps(data || []);
    setLoading(false);
  };

  if (loading) return <div className="text-muted">Carregando...</div>;

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Candidaturas</h1>
        <p className="text-muted" style={{ marginTop: 4 }}>
          Historico de todas as candidaturas enviadas
        </p>
      </div>

      {apps.length === 0 ? (
        <div className="card">
          <p className="text-muted" style={{ textAlign: "center" }}>
            Nenhuma candidatura ainda. Ative o bot nas configuracoes.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Vaga</th>
                <th>Plataforma</th>
                <th>Status</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.id}>
                  <td style={{ fontWeight: 500 }}>{app.empresa || "-"}</td>
                  <td>{app.vaga || "-"}</td>
                  <td>
                    <span className="badge">{app.plataforma}</span>
                  </td>
                  <td>
                    <span className={`badge ${statusBadge[app.status] || "badge-warning"}`}>
                      {app.status}
                    </span>
                  </td>
                  <td className="text-muted">
                    {new Date(app.created_at).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
