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
  created_at: string;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("leads_google")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);

    setLeads(data || []);
    setLoading(false);
  };

  const filtered = leads.filter((l) =>
    l.empresa?.toLowerCase().includes(search.toLowerCase()) ||
    l.site?.toLowerCase().includes(search.toLowerCase())
  );

  const exportCSV = () => {
    const header = "Empresa,Telefone,Site,Email,Cidade\n";
    const rows = filtered.map((l) =>
      `"${l.empresa}","${l.telefone}","${l.site}","${l.email}","${l.cidade}"`
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
      <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Leads</h1>
          <p className="text-muted" style={{ marginTop: 4 }}>
            Empresas e contatos coletados via Google
          </p>
        </div>
        <button className="btn-primary" onClick={exportCSV}>Exportar CSV</button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Buscar por empresa ou site..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <p className="text-muted" style={{ textAlign: "center" }}>
            Nenhum lead coletado ainda.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Telefone</th>
                <th>Email</th>
                <th>Site</th>
                <th>Cidade</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr key={lead.id}>
                  <td style={{ fontWeight: 500 }}>{lead.empresa || "-"}</td>
                  <td>{lead.telefone || "-"}</td>
                  <td>{lead.email || "-"}</td>
                  <td>
                    {lead.site ? (
                      <a href={lead.site} target="_blank" rel="noreferrer">
                        {lead.site.replace(/^https?:\/\//, "").slice(0, 30)}
                      </a>
                    ) : "-"}
                  </td>
                  <td className="text-muted">{lead.cidade || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
