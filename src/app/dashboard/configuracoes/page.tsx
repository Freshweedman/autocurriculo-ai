"use client";

import { supabase } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [cargo, setCargo] = useState("");
  const [cidade, setCidade] = useState("");
  const [limiteDiario, setLimiteDiario] = useState(5);
  const [botAtivo, setBotAtivo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cvUploaded, setCvUploaded] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existing } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (existing) {
      setProfileId(existing.id);
      setCargo(existing.cargo || "");
      setCidade(existing.cidade || "");
      setLimiteDiario(existing.limite_diario || 5);
      setBotAtivo(existing.bot_ativo ?? false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      user_id: user.id,
      cargo,
      cidade,
      limite_diario: limiteDiario,
      bot_ativo: botAtivo,
    };

    if (profileId) {
      await supabase.from("profiles").update(payload).eq("id", profileId);
    } else {
      const { data } = await supabase.from("profiles").insert(payload).select().single();
      if (data) setProfileId(data.id);
    }

    setSalvo(true);
    setLoading(false);
    router.refresh();
    setTimeout(() => setSalvo(false), 3000);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();

    const fileName = `${user!.id}/curriculo.pdf`;
    await supabase.storage.from("curriculos").upload(fileName, file, {
      upsert: true,
      cacheControl: "3600",
    });

    setCvUploaded(true);
    setUploading(false);
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Configuracoes</h1>
        <p className="text-muted" style={{ marginTop: 4 }}>
          Configure seu bot de candidaturas
        </p>
      </div>

      <div style={{ display: "grid", gap: 24, maxWidth: 600 }}>
        {/* Upload Curriculo */}
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Curriculo PDF</h3>
          <p className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
            Envie seu curriculo em PDF. Use um arquivo otimizado para ATS.
          </p>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label className="btn-outline" style={{ cursor: "pointer", margin: 0 }}>
              {uploading ? "Enviando..." : cvUploaded ? "Substituir PDF" : "Selecionar PDF"}
              <input
                type="file"
                accept=".pdf"
                onChange={handleUpload}
                style={{ display: "none" }}
              />
            </label>
            {cvUploaded && (
              <span className="badge badge-success">Curriculo enviado</span>
            )}
          </div>
        </div>

        {/* Config Busca */}
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Configuracao de Busca</h3>

          <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--text-muted)" }}>
            Cargo desejado
          </label>
          <input
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            placeholder="Ex: gestor de trafego"
            style={{ marginBottom: 16 }}
          />

          <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--text-muted)" }}>
            Cidade / Regiao
          </label>
          <input
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            placeholder="Ex: Sao Paulo - SP"
            style={{ marginBottom: 16 }}
          />

          <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--text-muted)" }}>
            Limite diario de envios
          </label>
          <select
            value={limiteDiario}
            onChange={(e) => setLimiteDiario(Number(e.target.value))}
            style={{ marginBottom: 16 }}
          >
            {[10, 20, 50, 100, 150, 200].map((n) => (
              <option key={n} value={n}>{n} curriculos/dia</option>
            ))}
          </select>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>Bot automatico</div>
              <div className="text-muted" style={{ fontSize: 13 }}>Roda Seg-Sex as 9h via GitHub Actions</div>
            </div>
            <button
              onClick={() => setBotAtivo(!botAtivo)}
              style={{
                width: 52, height: 28, borderRadius: 14, border: "none", cursor: "pointer", padding: 2,
                background: botAtivo ? "var(--success)" : "var(--border)",
                position: "relative", transition: "background 0.2s",
              }}
            >
              <div style={{
                width: 24, height: 24, borderRadius: "50%", background: "white",
                transform: botAtivo ? "translateX(24px)" : "translateX(0)",
                transition: "transform 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              }} />
            </button>
          </div>

          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={loading}
            style={{ width: "100%", padding: 12 }}
          >
            {loading ? "Salvando..." : "Salvar Configuracoes"}
          </button>
          {salvo && (
            <p style={{ textAlign: "center", marginTop: 12, color: "var(--success)", fontSize: 13 }}>
              Configuracoes salvas com sucesso!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
