"use client";
import { supabase } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface QueueItem {
  id:string; task_type:string; status:string; priority:number;
  scheduled_for:string|null; target_url:string|null; published_url:string|null;
  observations:string|null; created_at:string; updated_at:string;
  services?:{name:string}; campaigns?:{name:string}; channels?:{name:string;type:string};
  generated_pamphlets?:{title:string;long_description:string};
}

const STATUS_MAP:Record<string,{l:string;c:string}>={
  pendente:{l:"Pendente",c:"var(--text-tertiary)"},
  gerado:{l:"Gerado",c:"var(--accent)"},
  pronto:{l:"Pronto",c:"var(--purple)"},
  em_preenchimento:{l:"Preenchendo...",c:"var(--orange)"},
  aguardando_confirmacao:{l:"Aguardando",c:"var(--orange)"},
  publicado:{l:"Publicado ✓",c:"var(--green)"},
  pausado:{l:"Pausado",c:"var(--text-tertiary)"},
  erro:{l:"Erro",c:"var(--red)"},
  rejeitado:{l:"Rejeitado",c:"var(--red)"},
  arquivado:{l:"Arquivado",c:"var(--text-tertiary)"},
};

const TYPE_ICON:Record<string,string>={olx:"🟠",facebook_marketplace:"💙",facebook_group:"👥",workana:"🌎","99freelas":"🆓",fiverr:"🟢",linkedin:"💼",instagram:"📸",whatsapp:"💬",telegram:"✈️"};

export default function FilaPage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("todos");
  const [selected, setSelected] = useState<QueueItem|null>(null);

  useEffect(()=>{ load(); },[]);

  const load = async () => {
    const { data:{ user } } = await supabase.auth.getUser();
    if(!user){setLoading(false);return;}
    const { data } = await supabase.from("publishing_queue")
      .select("*, services(name), campaigns(name), channels(name,type), generated_pamphlets(title,long_description)")
      .eq("user_id",user.id).order("priority",{ascending:false}).order("created_at",{ascending:false}).limit(200);
    setItems(data||[]); setLoading(false);
  };

  const updateStatus = async (id:string, status:string, extra:Record<string,string>={}) => {
    await supabase.from("publishing_queue").update({status,...extra,updated_at:new Date().toISOString()}).eq("id",id);
    setItems(prev=>prev.map(i=>i.id===id?{...i,status,...extra}:i));
  };

  const filtered = filter==="todos"?items:items.filter(i=>i.status===filter);
  const counts = Object.fromEntries(Object.keys(STATUS_MAP).map(k=>[k,items.filter(i=>i.status===k).length]));

  return (
    <div style={{maxWidth:960,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,gap:16,flexWrap:"wrap"}}>
        <div>
          <h1 style={{fontSize:26,fontWeight:700,letterSpacing:"-0.03em"}}>Fila de Publicação</h1>
          <p style={{color:"var(--text-secondary)",marginTop:4,fontSize:14}}>{items.length} tarefas · {counts.publicado||0} publicadas · {counts.pendente||0} pendentes</p>
        </div>
        <Link href="/dashboard/panfletagem" className="btn-primary" style={{padding:"10px 20px",fontWeight:600,textDecoration:"none"}}>+ Gerar Panfletos</Link>
      </div>

      {/* Status pills */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:20}}>
        <button onClick={()=>setFilter("todos")} style={{padding:"5px 12px",borderRadius:100,fontSize:12,cursor:"pointer",background:filter==="todos"?"var(--accent)":"var(--bg-card)",border:`1px solid ${filter==="todos"?"var(--accent)":"var(--border)"}`,color:filter==="todos"?"white":"var(--text-secondary)"}}>
          Todos ({items.length})
        </button>
        {Object.entries(STATUS_MAP).filter(([k])=>counts[k]>0).map(([k,v])=>(
          <button key={k} onClick={()=>setFilter(k)} style={{padding:"5px 12px",borderRadius:100,fontSize:12,cursor:"pointer",background:filter===k?`${v.c}22`:"var(--bg-card)",border:`1px solid ${filter===k?v.c+"60":"var(--border)"}`,color:v.c}}>
            {v.l} ({counts[k]})
          </button>
        ))}
      </div>

      {loading ? <div style={{textAlign:"center",padding:60}}><div className="animate-spin" style={{width:24,height:24,border:"2px solid var(--border)",borderTopColor:"var(--accent)",borderRadius:"50%",margin:"0 auto"}}/></div>
      : filtered.length===0 ? (
        <div style={{textAlign:"center",padding:60,border:"1px dashed var(--border)",borderRadius:"var(--radius-lg)"}}>
          <div style={{fontSize:40,marginBottom:12}}>📋</div>
          <p style={{color:"var(--text-secondary)",fontSize:14,marginBottom:16}}>Fila vazia. Gere panfletos e adicione à fila.</p>
          <Link href="/dashboard/panfletagem" className="btn-primary" style={{textDecoration:"none",display:"inline-block",padding:"10px 24px"}}>Gerar Panfletos</Link>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map(item=>{
            const st=STATUS_MAP[item.status]||{l:item.status,c:"var(--text-tertiary)"};
            const chIcon=TYPE_ICON[item.channels?.type||""]||"⚡";
            return (
              <div key={item.id} style={{background:"var(--bg-card)",border:`1px solid ${item.status==="publicado"?"rgba(48,209,88,0.2)":item.status==="erro"?"rgba(255,69,58,0.2)":"var(--border)"}`,borderRadius:"var(--radius-lg)",padding:"14px 18px",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}
                onClick={()=>setSelected(item)}>
                <span style={{fontSize:20,flexShrink:0}}>{chIcon}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:14}}>{item.generated_pamphlets?.title||item.task_type}</div>
                  <div style={{fontSize:12,color:"var(--text-tertiary)",marginTop:2}}>
                    {item.channels?.name||"—"} · {item.services?.name||"—"} {item.campaigns?.name?`· ${item.campaigns.name}`:""}
                  </div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
                  <span style={{fontSize:11,padding:"3px 10px",borderRadius:100,background:`${st.c}18`,color:st.c,fontWeight:600}}>{st.l}</span>
                  {item.status==="publicado"&&item.published_url&&(
                    <a href={item.published_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:12,color:"var(--accent)"}}>↗</a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {selected&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}} onClick={()=>setSelected(null)}>
          <div style={{maxWidth:560,width:"100%",background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-xl)",padding:24,maxHeight:"90vh",overflow:"auto",boxShadow:"var(--shadow-elevated)"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <h3 style={{fontSize:17,fontWeight:700,paddingRight:16}}>{selected.generated_pamphlets?.title||selected.task_type}</h3>
              <button onClick={()=>setSelected(null)} style={{background:"rgba(255,255,255,0.06)",border:"none",borderRadius:7,width:28,height:28,cursor:"pointer",color:"var(--text-secondary)",fontSize:14,flexShrink:0}}>✕</button>
            </div>
            {selected.generated_pamphlets?.long_description&&(
              <div style={{background:"var(--bg)",borderRadius:"var(--radius-sm)",padding:14,fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap",marginBottom:16,cursor:"pointer",border:"1px solid var(--border)"}}
                onClick={()=>{navigator.clipboard.writeText(selected.generated_pamphlets!.long_description);alert("Copiado!");}}>
                {selected.generated_pamphlets.long_description}
                <div style={{fontSize:11,color:"var(--text-tertiary)",marginTop:8}}>Clique para copiar</div>
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              {[
                {l:"CANAL",v:selected.channels?.name||"—"},
                {l:"STATUS",v:STATUS_MAP[selected.status]?.l||selected.status},
                {l:"SERVIÇO",v:selected.services?.name||"—"},
                {l:"PRIORIDADE",v:String(selected.priority)},
              ].map(item=>(
                <div key={item.l} style={{background:"var(--bg)",borderRadius:"var(--radius-sm)",padding:"10px 14px"}}>
                  <div style={{fontSize:10,color:"var(--text-tertiary)",marginBottom:3,fontWeight:600,letterSpacing:"0.06em"}}>{item.l}</div>
                  <div style={{fontSize:13}}>{item.v}</div>
                </div>
              ))}
            </div>
            {selected.target_url&&(
              <div style={{marginBottom:16}}>
                <label style={{fontSize:11,color:"var(--text-tertiary)",display:"block",marginBottom:5,fontWeight:600,letterSpacing:"0.06em"}}>LINK PUBLICADO</label>
                <input defaultValue={selected.published_url||""} placeholder="Cole o link após publicar..." onBlur={async e=>{if(e.target.value)await updateStatus(selected.id,"publicado",{published_url:e.target.value});}} style={{width:"100%"}}/>
              </div>
            )}
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {selected.channels?.type&&selected.channels?.type!=="whatsapp"&&(
                <a href={`https://api.whatsapp.com/send?text=${encodeURIComponent(selected.generated_pamphlets?.long_description||"")}`} target="_blank" rel="noreferrer" className="btn-outline" style={{textDecoration:"none",flex:1,textAlign:"center",padding:"9px 0",fontSize:12}}>Abrir Canal</a>
              )}
              {selected.status!=="publicado"&&<button className="btn-green" style={{flex:1,padding:"9px 0",fontSize:12}} onClick={()=>{updateStatus(selected.id,"publicado");setSelected(null);}}>✓ Marcar publicado</button>}
              {selected.status==="pendente"&&<button className="btn-outline" style={{flex:1,padding:"9px 0",fontSize:12}} onClick={()=>{updateStatus(selected.id,"arquivado");setSelected(null);}}>Arquivar</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
