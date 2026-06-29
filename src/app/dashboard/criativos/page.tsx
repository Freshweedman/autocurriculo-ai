"use client";
import { supabase } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

interface Creative {
  id: string; service_id: string|null; url: string; format: string;
  recommended_channel: string; status: string; tags: string[]; created_at: string;
  services?: { name: string };
}

const FORMATS = [
  { v:"story", l:"Story (9:16)", icon:"📱" },
  { v:"feed", l:"Feed (4:5)", icon:"🖼️" },
  { v:"square", l:"Quadrado (1:1)", icon:"⬜" },
  { v:"banner_olx", l:"Banner OLX", icon:"🟠" },
  { v:"mockup", l:"Mockup de Site", icon:"💻" },
  { v:"portfolio", l:"Print Portfólio", icon:"📂" },
  { v:"before_after", l:"Antes/Depois", icon:"↔️" },
  { v:"fiverr_cover", l:"Capa Fiverr", icon:"🟢" },
  { v:"marketplace_cover", l:"Capa Marketplace", icon:"🛒" },
];

const FORMAT_DIMENSIONS: Record<string,string> = {
  story:"1080×1920", feed:"1080×1350", square:"1080×1080",
  banner_olx:"1200×628", mockup:"1280×800", portfolio:"1280×720",
  before_after:"1200×628", fiverr_cover:"1550×620", marketplace_cover:"1200×628",
};

export default function CriativosPage() {
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [services, setServices] = useState<{id:string;name:string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ url:"", service_id:"", format:"story", recommended_channel:"", tags:"", status:"ativo" });

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data:{ user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const [{ data: cr }, { data: sv }] = await Promise.all([
      supabase.from("creatives").select("*, services(name)").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("services").select("id, name").eq("user_id", user.id).eq("active", true),
    ]);
    setCreatives(cr || []);
    setServices(sv || []);
    setLoading(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const { data:{ user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = { ...form, user_id: user.id, service_id: form.service_id || null,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean) };
    const { error } = await supabase.from("creatives").insert(payload);
    if (!error) { setMsg("Criativo adicionado!"); setShowForm(false); setForm({ url:"", service_id:"", format:"story", recommended_channel:"", tags:"", status:"ativo" }); load(); setTimeout(() => setMsg(""), 3000); }
    setSaving(false);
  };

  const del = async (id: string) => {
    if (!confirm("Remover criativo?")) return;
    await supabase.from("creatives").delete().eq("id", id);
    load();
  };

  const grouped = FORMATS.map(f => ({
    ...f, items: creatives.filter(c => c.format === f.v)
  })).filter(g => g.items.length > 0);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, gap:16, flexWrap:"wrap" }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:700, letterSpacing:"-0.03em" }}>Criativos</h1>
          <p style={{ color:"var(--text-secondary)", marginTop:4, fontSize:14 }}>
            Banco de imagens para panfletagem digital — {creatives.length} criativos
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)} style={{ padding:"10px 20px", fontWeight:600 }}>
          + Adicionar Criativo
        </button>
      </div>

      {/* Tutorial */}
      <div style={{ background:"rgba(10,132,255,0.05)", border:"1px solid rgba(10,132,255,0.15)", borderRadius:"var(--radius-lg)", padding:"16px 20px", marginBottom:24 }}>
        <div style={{ fontWeight:600, fontSize:13, color:"var(--accent)", marginBottom:8 }}>📸 Como usar Criativos</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:10 }}>
          {[
            { n:"1", t:"Adicione a URL da imagem", d:"Cole o link direto de uma imagem (Imgur, Drive, sua hospedagem)" },
            { n:"2", t:"Escolha o formato", d:"Story, Feed, Banner OLX, Capa Fiverr, etc." },
            { n:"3", t:"Vincule ao serviço", d:"Cada criativo fica associado a um serviço específico" },
            { n:"4", t:"Use na panfletagem", d:"Abra o canal e use o criativo junto com o texto gerado" },
          ].map(s => (
            <div key={s.n} style={{ display:"flex", gap:10 }}>
              <div style={{ width:22, height:22, borderRadius:"50%", background:"rgba(10,132,255,0.2)", color:"var(--accent)", fontSize:11, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>{s.n}</div>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:"var(--text)", marginBottom:2 }}>{s.t}</div>
                <div style={{ fontSize:11, color:"var(--text-tertiary)", lineHeight:1.4 }}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {msg && <div className="toast toast-success" style={{ position:"relative", bottom:"auto", right:"auto", marginBottom:16 }}>✓ {msg}</div>}

      {/* Form */}
      {showForm && (
        <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:24, marginBottom:24 }}>
          <h3 style={{ fontSize:16, fontWeight:600, marginBottom:18 }}>Novo criativo</h3>
          <form onSubmit={save}>
            <div style={{ marginBottom:14 }}>
              <label style={lbl}>URL DA IMAGEM *</label>
              <input value={form.url} onChange={e => setForm(p => ({...p, url:e.target.value}))} placeholder="https://i.imgur.com/... ou link direto da imagem" required />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:14 }}>
              <div>
                <label style={lbl}>FORMATO</label>
                <select value={form.format} onChange={e => setForm(p => ({...p, format:e.target.value}))}>
                  {FORMATS.map(f => <option key={f.v} value={f.v}>{f.icon} {f.l}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>SERVIÇO (opcional)</label>
                <select value={form.service_id} onChange={e => setForm(p => ({...p, service_id:e.target.value}))}>
                  <option value="">— Todos —</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>CANAL RECOMENDADO</label>
                <input value={form.recommended_channel} onChange={e => setForm(p => ({...p, recommended_channel:e.target.value}))} placeholder="olx, instagram, fiverr..." />
              </div>
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={lbl}>TAGS (separadas por vírgula)</label>
              <input value={form.tags} onChange={e => setForm(p => ({...p, tags:e.target.value}))} placeholder="site, profissional, mockup..." />
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button type="submit" className="btn-primary" disabled={saving} style={{ flex:1, padding:"11px 0" }}>{saving ? "Salvando..." : "Adicionar criativo"}</button>
              <button type="button" className="btn-outline" onClick={() => setShowForm(false)} style={{ padding:"11px 20px" }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:"center", padding:60 }}><div className="animate-spin" style={{ width:24, height:24, border:"2px solid var(--border)", borderTopColor:"var(--accent)", borderRadius:"50%", margin:"0 auto" }}/></div>
      ) : creatives.length === 0 ? (
        <div style={{ textAlign:"center", padding:"48px 32px", border:"1px dashed var(--border)", borderRadius:"var(--radius-lg)" }}>
          <div style={{ fontSize:44, marginBottom:14 }}>🎨</div>
          <p style={{ color:"var(--text-secondary)", fontSize:15, fontWeight:500, marginBottom:8 }}>Nenhum criativo ainda.</p>
          <p style={{ color:"var(--text-tertiary)", fontSize:13, marginBottom:24 }}>
            Adicione imagens, mockups e banners para usar junto com seus anúncios nos canais externos.
          </p>
          <button className="btn-primary" onClick={() => setShowForm(true)} style={{ padding:"11px 24px" }}>+ Adicionar primeiro criativo</button>
        </div>
      ) : (
        <>
          {/* Gallery by format */}
          {grouped.map(group => (
            <div key={group.v} style={{ marginBottom:32 }}>
              <h3 style={{ fontSize:15, fontWeight:600, marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
                {group.icon} {group.l}
                <span style={{ fontSize:11, color:"var(--text-tertiary)", fontWeight:400 }}>
                  ({group.items.length}) · {FORMAT_DIMENSIONS[group.v] || ""}
                </span>
              </h3>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap:12 }}>
                {group.items.map(c => (
                  <div key={c.id} style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", overflow:"hidden" }}>
                    <div style={{ position:"relative", aspectRatio: group.v==="story"?"9/16":"16/9", background:"var(--bg)", overflow:"hidden", maxHeight:160 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.url} alt={c.format} style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e => { (e.target as HTMLImageElement).style.display="none"; }} />
                      <div style={{ position:"absolute", top:8, right:8 }}>
                        <span style={{ fontSize:10, padding:"2px 8px", borderRadius:100, background:"rgba(0,0,0,0.6)", color:"white", fontWeight:600 }}>
                          {FORMATS.find(f=>f.v===c.format)?.icon} {group.l}
                        </span>
                      </div>
                    </div>
                    <div style={{ padding:"12px 14px" }}>
                      <div style={{ fontSize:12, fontWeight:500, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {c.services?.name || "Todos os serviços"}
                      </div>
                      {(c.tags||[]).length > 0 && (
                        <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:8 }}>
                          {c.tags.slice(0,3).map(t => (
                            <span key={t} style={{ fontSize:10, padding:"1px 6px", borderRadius:100, background:"rgba(10,132,255,0.1)", color:"var(--accent)" }}>{t}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ display:"flex", gap:6 }}>
                        <a href={c.url} target="_blank" rel="noreferrer" className="btn-outline" style={{ flex:1, textAlign:"center", padding:"5px 0", fontSize:11, textDecoration:"none" }}>Abrir ↗</a>
                        <button onClick={() => { navigator.clipboard.writeText(c.url); }} className="btn-outline" style={{ padding:"5px 10px", fontSize:11 }} title="Copiar URL">📋</button>
                        <button onClick={() => del(c.id)} className="btn-danger" style={{ padding:"5px 10px", fontSize:11 }}>✕</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
const lbl: React.CSSProperties = { display:"block", fontSize:11, fontWeight:500, color:"var(--text-secondary)", marginBottom:5, letterSpacing:"0.04em" };
