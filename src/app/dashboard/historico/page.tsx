"use client";
import { supabase } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

interface PubItem {
  id:string; status:string; published_url:string|null; created_at:string; updated_at:string;
  channels?:{name:string;type:string}; services?:{name:string};
  generated_pamphlets?:{title:string;long_description:string};
}

const TYPE_ICON:Record<string,string>={olx:"🟠",facebook_marketplace:"💙",facebook_group:"👥",workana:"🌎","99freelas":"🆓",fiverr:"🟢",linkedin:"💼",instagram:"📸",whatsapp:"💬"};

export default function HistoricoPage() {
  const [items, setItems] = useState<PubItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("publicado");

  useEffect(()=>{ load(); },[]);

  const load = async () => {
    const { data:{user} } = await supabase.auth.getUser();
    if(!user){setLoading(false);return;}
    const { data } = await supabase.from("publishing_queue")
      .select("*, channels(name,type), services(name), generated_pamphlets(title,long_description)")
      .eq("user_id",user.id).order("updated_at",{ascending:false}).limit(300);
    setItems(data||[]); setLoading(false);
  };

  const filtered = filter==="todos"?items:items.filter(i=>i.status===filter);
  const publicados = items.filter(i=>i.status==="publicado").length;
  const pendentes = items.filter(i=>i.status==="pendente"||i.status==="pronto").length;

  return (
    <div style={{maxWidth:900,margin:"0 auto"}}>
      <div style={{marginBottom:28}}>
        <h1 style={{fontSize:26,fontWeight:700,letterSpacing:"-0.03em"}}>Histórico de Publicações</h1>
        <p style={{color:"var(--text-secondary)",marginTop:4,fontSize:14}}>{publicados} publicados · {pendentes} pendentes · {items.length} total</p>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {[["todos","Todos"],["publicado","Publicados ✓"],["pendente","Pendentes"],["erro","Erros"],["arquivado","Arquivados"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{padding:"6px 14px",borderRadius:100,fontSize:12,cursor:"pointer",background:filter===v?"var(--accent)":"var(--bg-card)",border:`1px solid ${filter===v?"var(--accent)":"var(--border)"}`,color:filter===v?"white":"var(--text-secondary)"}}>
            {l} ({v==="todos"?items.length:items.filter(i=>i.status===v).length})
          </button>
        ))}
      </div>

      {loading ? <div style={{textAlign:"center",padding:60}}><div className="animate-spin" style={{width:24,height:24,border:"2px solid var(--border)",borderTopColor:"var(--accent)",borderRadius:"50%",margin:"0 auto"}}/></div>
      : filtered.length===0 ? (
        <div style={{textAlign:"center",padding:60,border:"1px dashed var(--border)",borderRadius:"var(--radius-lg)"}}>
          <div style={{fontSize:36,marginBottom:12}}>📖</div>
          <p style={{color:"var(--text-secondary)",fontSize:14}}>Nenhuma publicação neste filtro.</p>
        </div>
      ) : (
        <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",overflow:"hidden"}}>
          <table><thead><tr><th>Canal</th><th>Título</th><th>Serviço</th><th>Status</th><th>Data</th><th></th></tr></thead>
          <tbody>
            {filtered.map(item=>(
              <tr key={item.id}>
                <td style={{fontWeight:500}}>{TYPE_ICON[item.channels?.type||""]||"⚡"} {item.channels?.name||"—"}</td>
                <td style={{maxWidth:200}}><div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:13}}>{item.generated_pamphlets?.title||"—"}</div></td>
                <td style={{fontSize:13,color:"var(--text-secondary)"}}>{item.services?.name||"—"}</td>
                <td><span style={{fontSize:11,padding:"3px 8px",borderRadius:100,background:item.status==="publicado"?"rgba(48,209,88,0.15)":"rgba(255,255,255,0.05)",color:item.status==="publicado"?"var(--green)":"var(--text-tertiary)",fontWeight:600}}>{item.status}</span></td>
                <td style={{fontSize:12,color:"var(--text-tertiary)"}}>{new Date(item.updated_at).toLocaleDateString("pt-BR")}</td>
                <td>{item.published_url&&<a href={item.published_url} target="_blank" rel="noreferrer" style={{fontSize:13,color:"var(--accent)"}}>↗</a>}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      )}
    </div>
  );
}
