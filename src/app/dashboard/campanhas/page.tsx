"use client";
import { useEffect, useState } from "react";

interface Service { id:string; name:string; }
interface Campaign {
  id:string; name:string; status:string; tone:string;
  objective:string; target_cities:string[]; main_offer:string; main_cta:string;
  services?:{ name:string; category:string; }; created_at:string;
}

const TONES = ["profissional","local","urgente","premium","informal","conversao"];
const STATUS = ["ativa","pausada","arquivada"];
const emptyForm = () => ({name:"",service_id:"",objective:"",target_cities:"",
  target_audience:"",tone:"profissional",main_offer:"",main_cta:"",
  recommended_frequency:"",status:"ativa"});

export default function CampanhasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(()=>{ load(); },[]);

  const load = async () => {
    const [cr, sr] = await Promise.all([fetch("/api/campaigns"), fetch("/api/services")]);
    if (cr.ok) { const d=await cr.json(); setCampaigns(d.campaigns); }
    if (sr.ok) { const d=await sr.json(); setServices(d.services); }
    setLoading(false);
  };

  const save = async (e:React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const body = { ...form, id:editId||undefined,
      target_cities: form.target_cities.split(",").map(s=>s.trim()).filter(Boolean),
      service_id: form.service_id||null };
    const r = await fetch("/api/campaigns",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    if (r.ok) { setMsg(editId?"Campanha atualizada!":"Campanha criada!"); setShowForm(false); setEditId(null); setForm(emptyForm()); load(); setTimeout(()=>setMsg(""),3000); }
    setSaving(false);
  };

  const del = async (id:string) => {
    if(!confirm("Remover campanha?"))return;
    await fetch(`/api/campaigns?id=${id}`,{method:"DELETE"}); load();
  };

  const edit = (c:Campaign) => {
    setForm({name:c.name,service_id:"",objective:c.objective||"",
      target_cities:(c.target_cities||[]).join(", "),target_audience:"",
      tone:c.tone||"profissional",main_offer:c.main_offer||"",main_cta:c.main_cta||"",
      recommended_frequency:"",status:c.status||"ativa"});
    setEditId(c.id); setShowForm(true);
  };

  const f = (k:string,v:string) => setForm(p=>({...p,[k]:v}));
  const lbl:React.CSSProperties={display:"block",fontSize:11,fontWeight:500,color:"var(--text-secondary)",marginBottom:5,letterSpacing:"0.04em"};

  const statusColor:Record<string,string>={ativa:"var(--green)",pausada:"var(--orange)",arquivada:"var(--text-tertiary)"};

  return (
    <div style={{maxWidth:860,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:28,gap:16,flexWrap:"wrap"}}>
        <div>
          <h1 style={{fontSize:26,fontWeight:700,letterSpacing:"-0.03em"}}>Campanhas</h1>
          <p style={{color:"var(--text-secondary)",marginTop:4,fontSize:14}}>
            Pacotes de divulgação por serviço e canal
          </p>
        </div>
        <button className="btn-primary" onClick={()=>{setForm(emptyForm());setEditId(null);setShowForm(true);}} style={{padding:"10px 20px",fontWeight:600}}>
          + Nova Campanha
        </button>
      </div>
      {/* Tutorial */}
      <div style={{background:"rgba(10,132,255,0.05)",border:"1px solid rgba(10,132,255,0.15)",borderRadius:"var(--radius-lg)",padding:"16px 20px",marginBottom:24}}>
        <div style={{fontWeight:600,fontSize:13,color:"var(--accent)",marginBottom:8}}>📣 Como usar Campanhas</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
          {[
            {n:"1",t:"Crie uma campanha",d:'Ex: "Vender sites para clínicas em SP" — vincule a um serviço'},
            {n:"2",t:"Defina o público",d:"Cidade, público-alvo e tom de voz (profissional, urgente, local...)"},
            {n:"3",t:"Use na Panfletagem",d:"Selecione a campanha ao gerar panfletos para textos mais direcionados"},
            {n:"4",t:"Acompanhe resultados",d:"Registre leads em Leads e publicações no Histórico"},
          ].map(s=>(
            <div key={s.n} style={{display:"flex",gap:10}}>
              <div style={{width:22,height:22,borderRadius:"50%",background:"rgba(10,132,255,0.2)",color:"var(--accent)",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>{s.n}</div>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:"var(--text)",marginBottom:2}}>{s.t}</div>
                <div style={{fontSize:11,color:"var(--text-tertiary)",lineHeight:1.4}}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {msg && <div className="toast toast-success" style={{position:"relative",bottom:"auto",right:"auto",marginBottom:16}}>✓ {msg}</div>}

      {showForm && (
        <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:24,marginBottom:24}}>
          <h3 style={{fontSize:17,fontWeight:600,marginBottom:20}}>{editId?"Editar campanha":"Nova campanha"}</h3>
          <form onSubmit={save}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
              <div><label style={lbl}>NOME DA CAMPANHA *</label><input value={form.name} onChange={e=>f("name",e.target.value)} placeholder="Ex: Vender sites para negócios locais" required/></div>
              <div><label style={lbl}>SERVIÇO</label>
                <select value={form.service_id} onChange={e=>f("service_id",e.target.value)}>
                  <option value="">— Selecionar serviço —</option>
                  {services.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{marginBottom:14}}><label style={lbl}>OBJETIVO</label><input value={form.objective} onChange={e=>f("objective",e.target.value)} placeholder="Ex: Conseguir 5 novos clientes de sites por mês"/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
              <div><label style={lbl}>CIDADES ALVO</label><input value={form.target_cities} onChange={e=>f("target_cities",e.target.value)} placeholder="São Paulo, Rio de Janeiro, Curitiba"/></div>
              <div><label style={lbl}>PÚBLICO ALVO</label><input value={form.target_audience} onChange={e=>f("target_audience",e.target.value)} placeholder="Clínicas, restaurantes, prestadores locais"/></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:14}}>
              <div><label style={lbl}>TOM DE VOZ</label>
                <select value={form.tone} onChange={e=>f("tone",e.target.value)}>
                  {TONES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label style={lbl}>STATUS</label>
                <select value={form.status} onChange={e=>f("status",e.target.value)}>
                  {STATUS.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label style={lbl}>FREQUÊNCIA</label><input value={form.recommended_frequency} onChange={e=>f("recommended_frequency",e.target.value)} placeholder="Ex: 2x por semana"/></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
              <div><label style={lbl}>OFERTA PRINCIPAL</label><input value={form.main_offer} onChange={e=>f("main_offer",e.target.value)} placeholder="Ex: Site completo por R$1.200"/></div>
              <div><label style={lbl}>CTA PRINCIPAL</label><input value={form.main_cta} onChange={e=>f("main_cta",e.target.value)} placeholder="Ex: Fale comigo no WhatsApp"/></div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button type="submit" className="btn-primary" disabled={saving} style={{flex:1,padding:"11px 0"}}>{saving?"Salvando...":editId?"Salvar":"Criar campanha"}</button>
              <button type="button" className="btn-outline" onClick={()=>{setShowForm(false);setEditId(null);}} style={{padding:"11px 20px"}}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <div style={{textAlign:"center",padding:60}}><div className="animate-spin" style={{width:24,height:24,border:"2px solid var(--border)",borderTopColor:"var(--accent)",borderRadius:"50%",margin:"0 auto"}}/></div>
      : campaigns.length===0&&!showForm ? (
        <div style={{textAlign:"center",padding:60,border:"1px dashed var(--border)",borderRadius:"var(--radius-lg)"}}>
          <div style={{fontSize:40,marginBottom:12}}>📣</div>
          <p style={{color:"var(--text-secondary)",fontSize:14,marginBottom:16}}>Nenhuma campanha ainda. Crie uma para organizar sua divulgação.</p>
          <button className="btn-primary" onClick={()=>setShowForm(true)}>Criar primeira campanha</button>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {campaigns.map(c=>(
            <div key={c.id} style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"16px 20px",display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:statusColor[c.status]||"var(--text-tertiary)",flexShrink:0,boxShadow:c.status==="ativa"?"0 0 8px rgba(48,209,88,0.5)":"none"}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:15}}>{c.name}</div>
                <div style={{fontSize:12,color:"var(--text-tertiary)",marginTop:2}}>
                  {c.services?.name||"Sem serviço"} · tom: {c.tone} · {c.status}
                  {(c.target_cities||[]).length>0?` · ${c.target_cities.slice(0,2).join(", ")}..`:""}
                </div>
              </div>
              <div style={{display:"flex",gap:8,flexShrink:0}}>
                <button className="btn-outline" style={{padding:"6px 14px",fontSize:12}} onClick={()=>edit(c)}>Editar</button>
                <button className="btn-danger" style={{padding:"6px 14px",fontSize:12}} onClick={()=>del(c.id)}>Remover</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
