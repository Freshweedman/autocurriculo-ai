"use client";
import { useEffect, useState } from "react";

interface Service {
  id: string; name: string; category: string; base_description: string;
  price_min: number; price_mid: number; price_max: number; delivery_time: string;
  includes: string[]; target_audience: string; portfolio_url: string;
  whatsapp_url: string; instagram_url: string; active: boolean; created_at: string;
}

const CATS = ["Sites","Landing Pages","Lojas Virtuais","Sistemas","Criativos","Capturas","Portfólios","Outros"];
const emptyForm = () => ({
  name:"", category:"Sites", base_description:"", price_min:"", price_mid:"", price_max:"",
  delivery_time:"", includes:"", target_audience:"", portfolio_url:"",
  whatsapp_url:"", instagram_url:"", active:true,
});

export default function ServicosPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { load(); }, []);

  const load = async () => {
    const r = await fetch("/api/services");
    if (r.ok) { const d = await r.json(); setServices(d.services); }
    setLoading(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const body = { ...form, id: editId||undefined,
      price_min: form.price_min ? Number(form.price_min) : null,
      price_mid: form.price_mid ? Number(form.price_mid) : null,
      price_max: form.price_max ? Number(form.price_max) : null,
      includes: form.includes.split(",").map(s=>s.trim()).filter(Boolean),
    };
    const r = await fetch("/api/services",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
    if (r.ok) { setMsg(editId?"Serviço atualizado!":"Serviço criado!"); setShowForm(false); setEditId(null); setForm(emptyForm()); load(); setTimeout(()=>setMsg(""),3000); }
    setSaving(false);
  };

  const del = async (id:string) => {
    if (!confirm("Remover serviço?")) return;
    await fetch(`/api/services?id=${id}`,{method:"DELETE"}); load();
  };

  const edit = (s:Service) => {
    setForm({ name:s.name, category:s.category, base_description:s.base_description||"",
      price_min:s.price_min?.toString()||"", price_mid:s.price_mid?.toString()||"",
      price_max:s.price_max?.toString()||"", delivery_time:s.delivery_time||"",
      includes:(s.includes||[]).join(", "), target_audience:s.target_audience||"",
      portfolio_url:s.portfolio_url||"", whatsapp_url:s.whatsapp_url||"",
      instagram_url:s.instagram_url||"", active:s.active });
    setEditId(s.id); setShowForm(true);
  };

  const f = (k:string, v:string|boolean) => setForm(p=>({...p,[k]:v}));

  return (
    <div style={{maxWidth:860,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:28,gap:16,flexWrap:"wrap"}}>
        <div>
          <h1 style={{fontSize:26,fontWeight:700,letterSpacing:"-0.03em"}}>Meus Serviços</h1>
          <p style={{color:"var(--text-secondary)",marginTop:4,fontSize:14}}>{services.length} serviços cadastrados</p>
        </div>
        <button className="btn-primary" onClick={()=>{setForm(emptyForm());setEditId(null);setShowForm(true);}} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 20px",fontWeight:600}}>
          + Novo Serviço
        </button>
      </div>
      {msg && <div className="toast toast-success" style={{position:"relative",bottom:"auto",right:"auto",marginBottom:16}}>✓ {msg}</div>}

      {showForm && (
        <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:24,marginBottom:24}}>
          <h3 style={{fontSize:17,fontWeight:600,marginBottom:20}}>{editId?"Editar serviço":"Novo serviço"}</h3>
          <form onSubmit={save}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
              <div><label style={lbl}>NOME DO SERVIÇO *</label><input value={form.name} onChange={e=>f("name",e.target.value)} placeholder="Ex: Criação de Site Profissional" required/></div>
              <div><label style={lbl}>CATEGORIA</label>
                <select value={form.category} onChange={e=>f("category",e.target.value)}>
                  {CATS.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{marginBottom:14}}><label style={lbl}>DESCRIÇÃO BASE</label><textarea value={form.base_description} onChange={e=>f("base_description",e.target.value)} placeholder="Descreva o serviço, diferenciais e resultados..." style={{minHeight:80,resize:"vertical"}}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:14}}>
              <div><label style={lbl}>PREÇO MÍNIMO (R$)</label><input type="number" value={form.price_min} onChange={e=>f("price_min",e.target.value)} placeholder="500"/></div>
              <div><label style={lbl}>PREÇO MÉDIO (R$)</label><input type="number" value={form.price_mid} onChange={e=>f("price_mid",e.target.value)} placeholder="1200"/></div>
              <div><label style={lbl}>PREÇO PREMIUM (R$)</label><input type="number" value={form.price_max} onChange={e=>f("price_max",e.target.value)} placeholder="3000"/></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
              <div><label style={lbl}>PRAZO DE ENTREGA</label><input value={form.delivery_time} onChange={e=>f("delivery_time",e.target.value)} placeholder="Ex: 7 dias úteis"/></div>
              <div><label style={lbl}>PÚBLICO IDEAL</label><input value={form.target_audience} onChange={e=>f("target_audience",e.target.value)} placeholder="Ex: clínicas, restaurantes, advogados"/></div>
            </div>
            <div style={{marginBottom:14}}><label style={lbl}>O QUE INCLUI (separado por vírgula)</label><input value={form.includes} onChange={e=>f("includes",e.target.value)} placeholder="Domínio, hospedagem, SSL, 5 páginas..."/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:20}}>
              <div><label style={lbl}>LINK PORTFOLIO</label><input value={form.portfolio_url} onChange={e=>f("portfolio_url",e.target.value)} placeholder="https://..."/></div>
              <div><label style={lbl}>WHATSAPP</label><input value={form.whatsapp_url} onChange={e=>f("whatsapp_url",e.target.value)} placeholder="https://wa.me/55..."/></div>
              <div><label style={lbl}>INSTAGRAM</label><input value={form.instagram_url} onChange={e=>f("instagram_url",e.target.value)} placeholder="@seu_perfil"/></div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button type="submit" className="btn-primary" disabled={saving} style={{flex:1,padding:"11px 0"}}>{saving?"Salvando...":editId?"Salvar alterações":"Criar serviço"}</button>
              <button type="button" className="btn-outline" onClick={()=>{setShowForm(false);setEditId(null);setForm(emptyForm());}} style={{padding:"11px 20px"}}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <div style={{textAlign:"center",padding:60}}><div className="animate-spin" style={{width:24,height:24,border:"2px solid var(--border)",borderTopColor:"var(--accent)",borderRadius:"50%",margin:"0 auto"}}/></div>
      : services.length===0&&!showForm ? (
        <div style={{textAlign:"center",padding:60,border:"1px dashed var(--border)",borderRadius:"var(--radius-lg)"}}>
          <div style={{fontSize:40,marginBottom:12}}>💼</div>
          <p style={{color:"var(--text-secondary)",fontSize:14,marginBottom:16}}>Nenhum serviço cadastrado ainda.</p>
          <button className="btn-primary" onClick={()=>setShowForm(true)}>Cadastrar primeiro serviço</button>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {services.map(s=>(
            <div key={s.id} style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"16px 20px",display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:42,height:42,borderRadius:10,background:"rgba(10,132,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>💼</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:15}}>{s.name}</div>
                <div style={{fontSize:12,color:"var(--text-tertiary)",marginTop:2}}>
                  {s.category}{s.price_min?` · R$ ${s.price_min}`:""}{s.price_max?` – R$ ${s.price_max}`:""}{s.delivery_time?` · ${s.delivery_time}`:""}
                </div>
              </div>
              <div style={{display:"flex",gap:8,flexShrink:0}}>
                <button className="btn-outline" style={{padding:"6px 14px",fontSize:12}} onClick={()=>edit(s)}>Editar</button>
                <button className="btn-danger" style={{padding:"6px 14px",fontSize:12}} onClick={()=>del(s.id)}>Remover</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
const lbl:React.CSSProperties={display:"block",fontSize:11,fontWeight:500,color:"var(--text-secondary)",marginBottom:5,letterSpacing:"0.04em"};
