"use client";
import { useEffect, useState } from "react";

interface Service { id:string; name:string; category:string; }
interface Campaign { id:string; name:string; }

interface Pamphlets {
  titulos:string[]; descricoes_curtas:string[]; ctas:string[];
  olx:string[]; facebook:string[]; workana:string[]; whatsapp:string[];
  fiverr:string[]; instagram:string[]; follow_up:string[]; objecao_preco:string[];
}

const TONES = [
  {v:"profissional",l:"Profissional"},
  {v:"local",l:"Local / Simples"},
  {v:"urgente",l:"Urgente"},
  {v:"premium",l:"Premium"},
  {v:"informal",l:"Informal"},
  {v:"conversao",l:"Conversão"},
];

const PLATFORM_SECTIONS = [
  {key:"titulos", label:"🏷️ Títulos", cols:2},
  {key:"descricoes_curtas", label:"📝 Descrições Curtas", cols:2},
  {key:"ctas", label:"📣 CTAs", cols:2},
  {key:"olx", label:"🟠 OLX", cols:1},
  {key:"facebook", label:"💙 Facebook / Grupos", cols:1},
  {key:"workana", label:"🌎 Workana / 99Freelas", cols:1},
  {key:"fiverr", label:"🟢 Fiverr", cols:2},
  {key:"instagram", label:"📸 Instagram", cols:1},
  {key:"whatsapp", label:"💬 WhatsApp", cols:2},
  {key:"follow_up", label:"🔁 Follow-up", cols:2},
  {key:"objecao_preco", label:"💰 Resposta à Objeção de Preço", cols:1},
];

export default function PanfletagemPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [tone, setTone] = useState("profissional");
  const [generating, setGenerating] = useState(false);
  const [pamphlets, setPamphlets] = useState<Pamphlets|null>(null);
  const [copied, setCopied] = useState<string|null>(null);
  const [activeSection, setActiveSection] = useState<string|null>(null);

  useEffect(()=>{
    fetch("/api/services").then(r=>r.ok?r.json():null).then(d=>{ if(d){setServices(d.services); if(d.services[0])setServiceId(d.services[0].id); }});
    fetch("/api/campaigns").then(r=>r.ok?r.json():null).then(d=>{ if(d)setCampaigns(d.campaigns); });
  },[]);

  const generate = async () => {
    if(!serviceId){alert("Selecione um serviço primeiro.");return;}
    setGenerating(true); setPamphlets(null);
    const r = await fetch("/api/generate-pamphlets",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({service_id:serviceId,campaign_id:campaignId||null,tone})});
    if(r.ok){ const d=await r.json(); setPamphlets(d.pamphlets); setActiveSection("titulos"); }
    setGenerating(false);
  };

  const copy = (text:string, key:string) => {
    navigator.clipboard.writeText(text);
    setCopied(key); setTimeout(()=>setCopied(null),1500);
  };

  const copyAll = (items:string[]) => {
    navigator.clipboard.writeText(items.join("\n\n---\n\n"));
    setCopied("all_"+items[0]?.slice(0,10)); setTimeout(()=>setCopied(null),1500);
  };

  return (
    <div style={{maxWidth:960,margin:"0 auto"}}>
      {/* Header */}
      <div style={{marginBottom:28}}>
        <h1 style={{fontSize:26,fontWeight:700,letterSpacing:"-0.03em"}}>Gerar Panfletos Digitais</h1>
        <p style={{color:"var(--text-secondary)",marginTop:4,fontSize:14}}>
          Gere dezenas de variações de anúncio prontas para cada canal externo
        </p>
      </div>

      {/* Config panel */}
      <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:24,marginBottom:24}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:20}}>
          <div>
            <label style={lbl}>SERVIÇO *</label>
            <select value={serviceId} onChange={e=>setServiceId(e.target.value)}>
              <option value="">— Selecionar —</option>
              {services.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>CAMPANHA (opcional)</label>
            <select value={campaignId} onChange={e=>setCampaignId(e.target.value)}>
              <option value="">— Sem campanha —</option>
              {campaigns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>TOM DE VOZ</label>
            <select value={tone} onChange={e=>setTone(e.target.value)}>
              {TONES.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </div>
        </div>
        <button className="btn-primary" onClick={generate} disabled={generating||!serviceId}
          style={{width:"100%",padding:14,fontSize:16,fontWeight:700,letterSpacing:"-0.02em",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
          {generating ? (
            <><span className="animate-spin" style={{display:"inline-block",width:18,height:18,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",borderRadius:"50%"}}/> Gerando panfletos...</>
          ) : (
            <><span style={{fontSize:20}}>⚡</span> Gerar Panfletos Digitais</>
          )}
        </button>
      </div>

      {services.length===0&&(
        <div style={{textAlign:"center",padding:"48px 32px",border:"1px dashed var(--border)",borderRadius:"var(--radius-lg)",marginBottom:20}}>
          <div style={{fontSize:44,marginBottom:14}}>⚡</div>
          <p style={{color:"var(--text-secondary)",fontSize:15,fontWeight:500,marginBottom:8}}>Cadastre seus serviços primeiro</p>
          <p style={{color:"var(--text-tertiary)",fontSize:13,marginBottom:24}}>
            O gerador usa os dados do seu serviço (nome, preço, público) para criar anúncios personalizados para cada canal.
          </p>
          <a href="/dashboard/servicos" className="btn-primary" style={{display:"inline-flex",alignItems:"center",gap:8,padding:"11px 28px",fontSize:14,fontWeight:600,textDecoration:"none"}}>
            💼 Ir para Meus Serviços
          </a>
        </div>
      )}

      {/* Results */}
      {pamphlets && (
        <div>
          {/* Section tabs */}
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:20}}>
            {PLATFORM_SECTIONS.map(s=>(
              <button key={s.key} onClick={()=>setActiveSection(s.key)} style={{
                padding:"6px 12px",borderRadius:100,fontSize:12,fontWeight:500,cursor:"pointer",
                background:activeSection===s.key?"var(--accent)":"var(--bg-card)",
                border:`1px solid ${activeSection===s.key?"var(--accent)":"var(--border)"}`,
                color:activeSection===s.key?"white":"var(--text-secondary)",transition:"all 0.15s",
              }}>{s.label}</button>
            ))}
            <button onClick={()=>setActiveSection(null)} style={{padding:"6px 12px",borderRadius:100,fontSize:12,cursor:"pointer",background:"transparent",border:"1px solid var(--border)",color:"var(--text-tertiary)"}}>
              Ver todos
            </button>
          </div>

          {PLATFORM_SECTIONS.filter(s=>!activeSection||s.key===activeSection).map(section=>{
            const items = (pamphlets as unknown as Record<string,string[]>)[section.key]||[];
            return (
              <div key={section.key} style={{marginBottom:24}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <h3 style={{fontSize:15,fontWeight:600}}>{section.label} <span style={{fontSize:12,color:"var(--text-tertiary)",fontWeight:400}}>({items.length})</span></h3>
                  <button className="btn-outline" style={{padding:"5px 12px",fontSize:11}} onClick={()=>copyAll(items)}>
                    {copied==="all_"+items[0]?.slice(0,10)?"✓ Copiados!":"Copiar todos"}
                  </button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:`repeat(${section.cols},1fr)`,gap:10}}>
                  {items.map((item,i)=>(
                    <div key={i} style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius)",padding:14,position:"relative",cursor:"pointer",transition:"all 0.15s"}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(10,132,255,0.3)";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";}}>
                      <p style={{fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap",color:"var(--text)",marginBottom:10}}>{item}</p>
                      <div style={{display:"flex",gap:8}}>
                        <button className="btn-primary" style={{flex:1,padding:"6px 0",fontSize:11}} onClick={()=>copy(item,`${section.key}_${i}`)}>
                          {copied===`${section.key}_${i}`?"✓ Copiado!":"Copiar"}
                        </button>
                        <button className="btn-outline" style={{padding:"6px 12px",fontSize:11}} onClick={async()=>{
                          const channels=await fetch("/api/channels").then(r=>r.json()).then(d=>d.channels||[]);
                          const ch=channels.find((c:{type:string})=>c.type.includes(section.key.split("_")[0]));
                          if(ch?.url){window.open(ch.url,"_blank");}else{alert("Configure o canal nas Configurações de Canais.");}
                        }}>Abrir Canal</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
const lbl:React.CSSProperties={display:"block",fontSize:11,fontWeight:500,color:"var(--text-secondary)",marginBottom:5,letterSpacing:"0.04em"};
