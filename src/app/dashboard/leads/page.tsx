"use client";
import { supabase } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

interface ServiceLead {
  id: string; source_channel: string; platform: string; name: string;
  contact: string; service_interest: string; message: string; status: string;
  estimated_value: number|null; next_followup: string|null; created_at: string;
}
interface GoogleLead {
  id: string; empresa: string; telefone: string; site: string;
  email: string; cidade: string; fonte: string; created_at: string;
}

const STATUS_COLOR: Record<string,string> = {
  novo:"var(--accent)", em_contato:"var(--orange)", proposta_enviada:"var(--purple)",
  fechado:"var(--green)", perdido:"var(--text-tertiary)",
};
const STATUS_LABEL: Record<string,string> = {
  novo:"Novo", em_contato:"Em contato", proposta_enviada:"Proposta enviada",
  fechado:"Fechado ✓", perdido:"Perdido",
};

export default function LeadsPage() {
  const [tab, setTab] = useState<"servico"|"google">("servico");
  const [serviceLeads, setServiceLeads] = useState<ServiceLead[]>([]);
  const [googleLeads, setGoogleLeads] = useState<GoogleLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ServiceLead|null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name:"", contact:"", platform:"", service_interest:"", message:"", source_channel:"", estimated_value:"", status:"novo" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data:{ user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const [{ data: sl }, { data: gl }] = await Promise.all([
      supabase.from("service_leads").select("*").eq("user_id", user.id).order("created_at", { ascending:false }).limit(300),
      supabase.from("leads_google").select("*").eq("user_id", user.id).order("created_at", { ascending:false }).limit(500),
    ]);
    setServiceLeads(sl || []);
    setGoogleLeads(gl || []);
    setLoading(false);
  };

  const addLead = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const { data:{ user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("service_leads").insert({
      ...form, user_id: user.id,
      estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
    });
    setSaving(false); setShowAdd(false);
    setForm({ name:"", contact:"", platform:"", service_interest:"", message:"", source_channel:"", estimated_value:"", status:"novo" });
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("service_leads").update({ status }).eq("id", id);
    setServiceLeads(prev => prev.map(l => l.id===id ? {...l, status} : l));
    if (selected?.id===id) setSelected(prev => prev ? {...prev, status} : null);
  };

  const exportCSV = () => {
    const header = "Empresa,Telefone,Email,Site,Cidade,Fonte\n";
    const rows = googleLeads.map(l => `"${l.empresa||""}","${l.telefone||""}","${l.email||""}","${l.site||""}","${l.cidade||""}","${l.fonte||""}"`).join("\n");
    const blob = new Blob([header+rows], { type:"text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "leads_google.csv"; a.click();
  };

  const filteredSL = serviceLeads.filter(l =>
    !search || l.name?.toLowerCase().includes(search.toLowerCase()) ||
    l.service_interest?.toLowerCase().includes(search.toLowerCase()) ||
    l.platform?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredGL = googleLeads.filter(l =>
    !search || l.empresa?.toLowerCase().includes(search.toLowerCase()) ||
    l.cidade?.toLowerCase().includes(search.toLowerCase())
  );

  const novos = serviceLeads.filter(l => l.status==="novo").length;
  const emContato = serviceLeads.filter(l => l.status==="em_contato").length;
  const fechados = serviceLeads.filter(l => l.status==="fechado").length;

  return (
    <div style={{ maxWidth:960, margin:"0 auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, gap:16, flexWrap:"wrap" }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:700, letterSpacing:"-0.03em" }}>Leads</h1>
          <p style={{ color:"var(--text-secondary)", marginTop:4, fontSize:14 }}>
            {serviceLeads.length} leads de serviços · {googleLeads.length} leads do Google
          </p>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          {tab==="google" && <button className="btn-outline" onClick={exportCSV} style={{ padding:"8px 16px", fontSize:13 }}>Exportar CSV</button>}
          {tab==="servico" && <button className="btn-primary" onClick={() => setShowAdd(!showAdd)} style={{ padding:"10px 20px", fontWeight:600 }}>+ Registrar Lead</button>}
        </div>
      </div>

      {/* Tutorial */}
      <div style={{ background:"rgba(48,209,88,0.05)", border:"1px solid rgba(48,209,88,0.15)", borderRadius:"var(--radius-lg)", padding:"14px 18px", marginBottom:20 }}>
        <div style={{ fontWeight:600, fontSize:12, color:"var(--green)", marginBottom:6 }}>🎯 Como funciona Leads</div>
        <div style={{ fontSize:12, color:"var(--text-secondary)", lineHeight:1.7 }}>
          <strong style={{ color:"var(--text)" }}>Leads de Serviços</strong> — Registre manualmente quem entrou em contato via OLX, WhatsApp, Fiverr, etc. Acompanhe o funil de vendas (Novo → Em contato → Proposta → Fechado). <br/>
          <strong style={{ color:"var(--text)" }}>Leads do Google</strong> — Empresas coletadas automaticamente pelo bot CLT via Google Search e Maps. Use para prospecção ativa.
        </div>
      </div>

      {/* Stats - service leads */}
      {tab==="servico" && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(140px, 1fr))", gap:10, marginBottom:20 }}>
          {[
            { l:"Total", v:serviceLeads.length, c:"var(--accent)" },
            { l:"Novos", v:novos, c:"var(--accent)" },
            { l:"Em contato", v:emContato, c:"var(--orange)" },
            { l:"Fechados", v:fechados, c:"var(--green)" },
            { l:"Valor potencial", v:`R$ ${serviceLeads.filter(l=>l.estimated_value).reduce((a,l)=>a+(l.estimated_value||0),0).toLocaleString("pt-BR")}`, c:"var(--green)" },
          ].map(s => (
            <div key={s.l} className="card" style={{ textAlign:"center", padding:14 }}>
              <div style={{ fontSize: typeof s.v==="number"?28:16, fontWeight:700, color:s.c }}>{s.v}</div>
              <div style={{ fontSize:11, color:"var(--text-tertiary)", marginTop:3 }}>{s.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:20, borderBottom:"1px solid var(--border)", paddingBottom:0 }}>
        {([["servico","🎯 Leads de Serviços"],["google","🔍 Leads do Google"]] as const).map(([v,l]) => (
          <button key={v} onClick={() => setTab(v)} style={{
            padding:"8px 18px", background:"transparent", border:"none",
            borderBottom: tab===v?"2px solid var(--accent)":"2px solid transparent",
            color: tab===v?"var(--text)":"var(--text-secondary)",
            fontWeight: tab===v?600:400, fontSize:13, cursor:"pointer", marginBottom:-1,
          }}>{l}</button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position:"relative", marginBottom:16 }}>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"var(--text-tertiary)", pointerEvents:"none" }}>
          <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft:36 }} />
      </div>

      {/* Add form */}
      {showAdd && tab==="servico" && (
        <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:20, marginBottom:20 }}>
          <h3 style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>Registrar novo lead</h3>
          <form onSubmit={addLead}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
              <div><label style={lbl}>NOME / EMPRESA</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="João Silva ou Empresa X"/></div>
              <div><label style={lbl}>CONTATO (WhatsApp/email)</label><input value={form.contact} onChange={e=>setForm(p=>({...p,contact:e.target.value}))} placeholder="(51) 99999-9999"/></div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
              <div><label style={lbl}>PLATAFORMA/ORIGEM</label><input value={form.platform} onChange={e=>setForm(p=>({...p,platform:e.target.value}))} placeholder="OLX, WhatsApp, Fiverr..."/></div>
              <div><label style={lbl}>SERVIÇO DE INTERESSE</label><input value={form.service_interest} onChange={e=>setForm(p=>({...p,service_interest:e.target.value}))} placeholder="Site, landing page..."/></div>
              <div><label style={lbl}>VALOR ESTIMADO (R$)</label><input type="number" value={form.estimated_value} onChange={e=>setForm(p=>({...p,estimated_value:e.target.value}))} placeholder="1500"/></div>
            </div>
            <div style={{ marginBottom:16 }}><label style={lbl}>MENSAGEM / OBSERVAÇÕES</label><textarea value={form.message} onChange={e=>setForm(p=>({...p,message:e.target.value}))} placeholder="O que ele pediu, contexto..." style={{ minHeight:60, resize:"vertical" }}/></div>
            <div style={{ display:"flex", gap:10 }}>
              <button type="submit" className="btn-primary" disabled={saving} style={{ flex:1, padding:"10px 0" }}>{saving?"Salvando...":"Registrar lead"}</button>
              <button type="button" className="btn-outline" onClick={()=>setShowAdd(false)} style={{ padding:"10px 16px" }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <div style={{ textAlign:"center", padding:60 }}><div className="animate-spin" style={{ width:24, height:24, border:"2px solid var(--border)", borderTopColor:"var(--accent)", borderRadius:"50%", margin:"0 auto" }}/></div>

      : tab==="servico" ? (
        filteredSL.length===0 ? (
          <div style={{ textAlign:"center", padding:"48px 32px", border:"1px dashed var(--border)", borderRadius:"var(--radius-lg)" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🎯</div>
            <p style={{ color:"var(--text-secondary)", fontSize:14, marginBottom:16 }}>Nenhum lead de serviço ainda.</p>
            <p style={{ color:"var(--text-tertiary)", fontSize:13, marginBottom:20 }}>Quando alguém entrar em contato via OLX, WhatsApp ou Fiverr, registre aqui para acompanhar o funil.</p>
            <button className="btn-primary" onClick={()=>setShowAdd(true)} style={{ padding:"10px 24px" }}>+ Registrar primeiro lead</button>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {filteredSL.map(lead => {
              const sc = STATUS_COLOR[lead.status]||"var(--text-tertiary)";
              return (
                <div key={lead.id} style={{ background:"var(--bg-card)", border:`1px solid ${lead.status==="fechado"?"rgba(48,209,88,0.2)":"var(--border)"}`, borderRadius:"var(--radius-lg)", padding:"14px 18px", display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}
                  onClick={() => setSelected(lead)}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:sc, flexShrink:0, boxShadow:lead.status==="fechado"?"0 0 6px rgba(48,209,88,0.5)":"none" }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:14 }}>{lead.name||"—"}</div>
                    <div style={{ fontSize:12, color:"var(--text-tertiary)", marginTop:2 }}>
                      {[lead.platform, lead.service_interest, lead.contact].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
                    {lead.estimated_value && <span style={{ fontSize:12, fontWeight:600, color:"var(--green)" }}>R$ {lead.estimated_value.toLocaleString("pt-BR")}</span>}
                    <span style={{ fontSize:11, padding:"3px 10px", borderRadius:100, background:`${sc}18`, color:sc, fontWeight:600 }}>{STATUS_LABEL[lead.status]||lead.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )

      ) : (
        /* Google leads tab */
        filteredGL.length===0 ? (
          <div style={{ textAlign:"center", padding:"48px 32px", border:"1px dashed var(--border)", borderRadius:"var(--radius-lg)" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
            <p style={{ color:"var(--text-secondary)", fontSize:14, marginBottom:8 }}>Nenhum lead do Google ainda.</p>
            <p style={{ color:"var(--text-tertiary)", fontSize:13 }}>Execute o Bot CLT para coletar empresas via Google Search e Maps.</p>
          </div>
        ) : (
          <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", overflow:"hidden" }}>
            <table><thead><tr><th>Empresa</th><th>Contato</th><th>Site</th><th>Cidade</th><th></th></tr></thead>
            <tbody>
              {filteredGL.map(lead => (
                <tr key={lead.id}>
                  <td style={{ fontWeight:500 }}>{lead.empresa||"—"}</td>
                  <td>
                    <div style={{ fontSize:13 }}>{lead.email||""}</div>
                    <div style={{ fontSize:12, color:"var(--text-tertiary)" }}>{lead.telefone||""}</div>
                  </td>
                  <td>{lead.site?<a href={lead.site} target="_blank" rel="noreferrer" style={{ fontSize:13 }}>{lead.site.replace(/^https?:\/\//,"").split("/")[0].slice(0,28)}</a>:"-"}</td>
                  <td style={{ fontSize:13, color:"var(--text-secondary)" }}>{lead.cidade||"-"}</td>
                  <td>
                    {lead.email && <a href={`mailto:${lead.email}`} style={{ fontSize:12, color:"var(--accent)" }}>Email ↗</a>}
                    {lead.telefone && <a href={`https://wa.me/55${lead.telefone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{ fontSize:12, color:"#25d366", marginLeft:8 }}>WA</a>}
                  </td>
                </tr>
              ))}
            </tbody></table>
          </div>
        )
      )}

      {/* Service lead detail modal */}
      {selected && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }}
          onClick={() => setSelected(null)}>
          <div style={{ maxWidth:500, width:"100%", background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-xl)", padding:24, maxHeight:"90vh", overflow:"auto", boxShadow:"var(--shadow-elevated)" }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelected(null)} style={{ position:"absolute", top:16, right:16, background:"rgba(255,255,255,0.06)", border:"none", borderRadius:7, width:28, height:28, cursor:"pointer", color:"var(--text-secondary)", fontSize:14 }}>✕</button>
            <h3 style={{ fontSize:18, fontWeight:700, marginBottom:4, paddingRight:36 }}>{selected.name||"Lead"}</h3>
            <p style={{ color:"var(--text-tertiary)", fontSize:13, marginBottom:20 }}>{selected.platform} · {new Date(selected.created_at).toLocaleDateString("pt-BR")}</p>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
              {[
                { l:"CONTATO", v:selected.contact||"—" },
                { l:"SERVIÇO", v:selected.service_interest||"—" },
                { l:"VALOR ESTIMADO", v:selected.estimated_value?`R$ ${selected.estimated_value.toLocaleString("pt-BR")}`:"—" },
                { l:"STATUS", v:STATUS_LABEL[selected.status]||selected.status },
              ].map(item => (
                <div key={item.l} style={{ background:"var(--bg)", borderRadius:"var(--radius-sm)", padding:"10px 14px" }}>
                  <div style={{ fontSize:10, color:"var(--text-tertiary)", marginBottom:3, fontWeight:600, letterSpacing:"0.06em" }}>{item.l}</div>
                  <div style={{ fontSize:13 }}>{item.v}</div>
                </div>
              ))}
            </div>

            {selected.message && (
              <div style={{ background:"var(--bg)", borderRadius:"var(--radius-sm)", padding:"10px 14px", marginBottom:16 }}>
                <div style={{ fontSize:10, color:"var(--text-tertiary)", marginBottom:4, fontWeight:600, letterSpacing:"0.06em" }}>MENSAGEM</div>
                <p style={{ fontSize:13, lineHeight:1.6, color:"var(--text-secondary)" }}>{selected.message}</p>
              </div>
            )}

            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, color:"var(--text-tertiary)", marginBottom:8, fontWeight:600, letterSpacing:"0.06em" }}>ATUALIZAR STATUS</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {Object.entries(STATUS_LABEL).map(([k,v]) => (
                  <button key={k} onClick={() => updateStatus(selected.id, k)} style={{
                    padding:"5px 12px", borderRadius:100, fontSize:11, fontWeight:600, cursor:"pointer",
                    background: selected.status===k ? `${STATUS_COLOR[k]}25` : "var(--bg-card)",
                    border: `1px solid ${selected.status===k ? STATUS_COLOR[k]+"60" : "var(--border)"}`,
                    color: STATUS_COLOR[k],
                  }}>{v}</button>
                ))}
              </div>
            </div>

            <div style={{ display:"flex", gap:10 }}>
              {selected.contact?.includes("@") && (
                <a href={`mailto:${selected.contact}`} className="btn-primary" style={{ textDecoration:"none", flex:1, textAlign:"center", padding:"10px 0", fontSize:13 }}>✉️ Email</a>
              )}
              {selected.contact?.match(/\d{8,}/) && (
                <a href={`https://wa.me/55${selected.contact.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                  style={{ textDecoration:"none", flex:1, textAlign:"center", padding:"10px 0", fontSize:13, background:"rgba(37,211,102,0.1)", border:"1px solid #25d36640", borderRadius:"var(--radius-sm)", color:"#25d366", fontWeight:500 }}>
                  💬 WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
const lbl: React.CSSProperties = { display:"block", fontSize:11, fontWeight:500, color:"var(--text-secondary)", marginBottom:5, letterSpacing:"0.04em" };
