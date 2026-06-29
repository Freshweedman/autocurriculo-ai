"use client";
import { useEffect, useState } from "react";

interface Channel {
  id:string; name:string; type:string; platform:string; url:string;
  publication_mode:string; status:string; notes:string; last_posted_at:string;
}

const TYPES = ["olx","facebook_marketplace","facebook_group","workana","99freelas","fiverr","linkedin","instagram","whatsapp","telegram","reddit","outro"];
const MODES = [{v:"manual",l:"Manual"},{v:"copy_paste",l:"Copiar e Colar"},{v:"assisted",l:"Assistido"},{v:"runner",l:"Runner Local"},{v:"api",l:"API Oficial"}];
const TYPE_ICON:Record<string,string> = {olx:"🟠",facebook_marketplace:"💙",facebook_group:"👥",workana:"🌎",
  "99freelas":"🆓",fiverr:"🟢",linkedin:"💼",instagram:"📸",whatsapp:"💬",telegram:"✈️",reddit:"🔴",outro:"⚡"};
const MODE_COLOR:Record<string,string> = {manual:"var(--text-tertiary)",copy_paste:"var(--accent)",assisted:"var(--orange)",runner:"var(--green)",api:"var(--purple)"};

const DEFAULT_CHANNELS = [
  {name:"OLX São Paulo",type:"olx",url:"https://www.olx.com.br/servicos",publication_mode:"runner"},
  {name:"Facebook Marketplace",type:"facebook_marketplace",url:"https://www.facebook.com/marketplace/create/item",publication_mode:"runner"},
  {name:"Workana",type:"workana",url:"https://www.workana.com/pt/jobs",publication_mode:"runner"},
  {name:"99Freelas",type:"99freelas",url:"https://www.99freelas.com.br/projects",publication_mode:"runner"},
  {name:"Fiverr",type:"fiverr",url:"https://www.fiverr.com",publication_mode:"copy_paste"},
  {name:"LinkedIn",type:"linkedin",url:"https://www.linkedin.com",publication_mode:"copy_paste"},
  {name:"Instagram",type:"instagram",url:"https://www.instagram.com",publication_mode:"copy_paste"},
  {name:"WhatsApp Lista",type:"whatsapp",url:"",publication_mode:"manual"},
];

const emptyForm = () => ({name:"",type:"olx",platform:"",url:"",publication_mode:"manual",status:"ativo",notes:""});

export default function CanaisPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [addingDefaults, setAddingDefaults] = useState(false);
  const lbl:React.CSSProperties={display:"block",fontSize:11,fontWeight:500,color:"var(--text-secondary)",marginBottom:5,letterSpacing:"0.04em"};

  useEffect(()=>{ load(); },[]);
  const load = async () => {
    const r=await fetch("/api/channels"); if(r.ok){const d=await r.json();setChannels(d.channels);} setLoading(false);
  };
  const save = async (e:React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const r=await fetch("/api/channels",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,id:editId||undefined})});
    if(r.ok){setShowForm(false);setEditId(null);setForm(emptyForm());load();}
    setSaving(false);
  };
  const del = async (id:string) => { if(!confirm("Remover canal?"))return; await fetch(`/api/channels?id=${id}`,{method:"DELETE"}); load(); };
  const addDefaults = async () => {
    setAddingDefaults(true);
    for(const ch of DEFAULT_CHANNELS){
      await fetch("/api/channels",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...ch,platform:ch.type,status:"ativo"})});
    }
    load(); setAddingDefaults(false);
  };

  return (
    <div style={{maxWidth:860,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:28,gap:16,flexWrap:"wrap"}}>
        <div>
          <h1 style={{fontSize:26,fontWeight:700,letterSpacing:"-0.03em"}}>Canais</h1>
          <p style={{color:"var(--text-secondary)",marginTop:4,fontSize:14}}>Plataformas externas onde você divulga seus serviços</p>
        </div>
        <div style={{display:"flex",gap:10}}>
          {channels.length===0&&<button className="btn-outline" onClick={addDefaults} disabled={addingDefaults} style={{padding:"10px 16px",fontSize:13}}>{addingDefaults?"Adicionando...":"+ Adicionar padrões"}</button>}
          <button className="btn-primary" onClick={()=>{setForm(emptyForm());setEditId(null);setShowForm(true);}} style={{padding:"10px 20px",fontWeight:600}}>+ Novo Canal</button>
        </div>
      </div>

      {showForm && (
        <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:24,marginBottom:24}}>
          <h3 style={{fontSize:16,fontWeight:600,marginBottom:18}}>{editId?"Editar canal":"Novo canal"}</h3>
          <form onSubmit={save}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
              <div><label style={lbl}>NOME *</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Ex: OLX São Paulo" required/></div>
              <div><label style={lbl}>TIPO</label>
                <select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
                  {TYPES.map(t=><option key={t} value={t}>{TYPE_ICON[t]} {t}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
              <div><label style={lbl}>URL</label><input value={form.url} onChange={e=>setForm(p=>({...p,url:e.target.value}))} placeholder="https://..."/></div>
              <div><label style={lbl}>MODO DE PUBLICAÇÃO</label>
                <select value={form.publication_mode} onChange={e=>setForm(p=>({...p,publication_mode:e.target.value}))}>
                  {MODES.map(m=><option key={m.v} value={m.v}>{m.l}</option>)}
                </select>
              </div>
            </div>
            <div style={{marginBottom:20}}><label style={lbl}>OBSERVAÇÕES</label><input value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Notas sobre este canal..."/></div>
            <div style={{display:"flex",gap:10}}>
              <button type="submit" className="btn-primary" disabled={saving} style={{flex:1,padding:"11px 0"}}>{saving?"Salvando...":editId?"Salvar":"Criar canal"}</button>
              <button type="button" className="btn-outline" onClick={()=>{setShowForm(false);setEditId(null);}} style={{padding:"11px 20px"}}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <div style={{textAlign:"center",padding:60}}><div className="animate-spin" style={{width:24,height:24,border:"2px solid var(--border)",borderTopColor:"var(--accent)",borderRadius:"50%",margin:"0 auto"}}/></div>
      : channels.length===0&&!showForm ? (
        <div style={{textAlign:"center",padding:60,border:"1px dashed var(--border)",borderRadius:"var(--radius-lg)"}}>
          <div style={{fontSize:40,marginBottom:12}}>📡</div>
          <p style={{color:"var(--text-secondary)",fontSize:14,marginBottom:16}}>Nenhum canal cadastrado.</p>
          <button className="btn-primary" onClick={addDefaults}>{addingDefaults?"Adicionando...":"Adicionar canais padrão"}</button>
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
          {channels.map(ch=>(
            <div key={ch.id} style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:16}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <span style={{fontSize:22}}>{TYPE_ICON[ch.type]||"⚡"}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:14}}>{ch.name}</div>
                  <div style={{fontSize:11,color:"var(--text-tertiary)"}}>{ch.type}</div>
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <span style={{fontSize:11,padding:"2px 8px",borderRadius:100,background:`${MODE_COLOR[ch.publication_mode]||"var(--text-tertiary)"}18`,color:MODE_COLOR[ch.publication_mode]||"var(--text-tertiary)",fontWeight:600}}>
                  {MODES.find(m=>m.v===ch.publication_mode)?.l||ch.publication_mode}
                </span>
                {ch.url&&<a href={ch.url} target="_blank" rel="noreferrer" style={{fontSize:12,color:"var(--accent)"}}>Abrir ↗</a>}
              </div>
              <div style={{display:"flex",gap:8}}>
                <button className="btn-outline" style={{flex:1,padding:"5px 0",fontSize:11}} onClick={()=>{setForm({name:ch.name,type:ch.type,platform:ch.platform||"",url:ch.url||"",publication_mode:ch.publication_mode,status:ch.status,notes:ch.notes||""});setEditId(ch.id);setShowForm(true);}}>Editar</button>
                <button className="btn-danger" style={{padding:"5px 12px",fontSize:11}} onClick={()=>del(ch.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
