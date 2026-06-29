"use client";
import { supabase } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  servicos:number; campanhas:number; canais:number;
  panfletos_hoje:number; publicados_total:number; pendentes:number; leads:number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({servicos:0,campanhas:0,canais:0,panfletos_hoje:0,publicados_total:0,pendentes:0,leads:0});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<{text:string;type:"success"|"error"}|null>(null);

  useEffect(()=>{ load(); },[]);

  const load = async () => {
    const { data:{user} } = await supabase.auth.getUser();
    if(!user){setLoading(false);return;}
    const hoje = new Date().toISOString().split("T")[0];
    const [sv,ca,ch,ph,pt,pe,ld] = await Promise.all([
      supabase.from("services").select("*",{count:"exact",head:true}).eq("user_id",user.id).eq("active",true),
      supabase.from("campaigns").select("*",{count:"exact",head:true}).eq("user_id",user.id).eq("status","ativa"),
      supabase.from("channels").select("*",{count:"exact",head:true}).eq("user_id",user.id).eq("status","ativo"),
      supabase.from("generated_pamphlets").select("*",{count:"exact",head:true}).eq("user_id",user.id).gte("created_at",hoje),
      supabase.from("publishing_queue").select("*",{count:"exact",head:true}).eq("user_id",user.id).eq("status","publicado"),
      supabase.from("publishing_queue").select("*",{count:"exact",head:true}).eq("user_id",user.id).in("status",["pendente","pronto","aguardando_confirmacao"]),
      supabase.from("service_leads").select("*",{count:"exact",head:true}).eq("user_id",user.id),
    ]);
    setStats({servicos:sv.count||0,campanhas:ca.count||0,canais:ch.count||0,panfletos_hoje:ph.count||0,publicados_total:pt.count||0,pendentes:pe.count||0,leads:ld.count||0});
    setLoading(false);
  };

  const handleBotCLT = async () => {
    setRunning(true); setMsg(null);
    try {
      const r=await fetch("/api/run-bot",{method:"POST"});
      const d=await r.json();
      setMsg(d.ok?{text:"Bot CLT iniciado! ~5 minutos.",type:"success"}:{text:d.error||"Erro",type:"error"});
    } catch { setMsg({text:"Erro de conexão.",type:"error"}); }
    setRunning(false); setTimeout(()=>setMsg(null),8000);
  };

  if(loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:300}}><div className="animate-spin" style={{width:28,height:28,border:"2px solid var(--border)",borderTopColor:"var(--accent)",borderRadius:"50%"}}/></div>;

  const actions = [
    {href:"/dashboard/panfletagem",icon:"⚡",label:"Gerar Panfletos",sub:"IA gera variações para todos os canais",primary:true},
    {href:"/dashboard/servicos",icon:"💼",label:"Meus Serviços",sub:`${stats.servicos} cadastrados`},
    {href:"/dashboard/campanhas",icon:"📣",label:"Campanhas",sub:`${stats.campanhas} ativas`},
    {href:"/dashboard/canais",icon:"📡",label:"Canais",sub:`${stats.canais} configurados`},
    {href:"/dashboard/fila",icon:"📋",label:"Fila de Publicação",sub:`${stats.pendentes} pendentes`},
    {href:"/dashboard/autopilot",icon:"🤖",label:"Autopilot",sub:"Preencher plataformas"},
    {href:"/dashboard/leads",icon:"🎯",label:"Leads",sub:`${stats.leads} recebidos`},
    {href:"/dashboard/historico",icon:"📖",label:"Histórico",sub:`${stats.publicados_total} publicados`},
  ];

  return (
    <div style={{maxWidth:920,margin:"0 auto"}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:32,flexWrap:"wrap",gap:16}}>
        <div>
          <h1 style={{fontSize:26,fontWeight:700,letterSpacing:"-0.03em"}}>Máquina de Panfletagem</h1>
          <p style={{color:"var(--text-secondary)",marginTop:4,fontSize:14}}>
            Distribua seus serviços em todos os canais externos
          </p>
        </div>
        <Link href="/dashboard/panfletagem" style={{display:"flex",alignItems:"center",gap:8,padding:"10px 20px",background:"var(--accent)",color:"white",borderRadius:"var(--radius-sm)",fontWeight:700,fontSize:14,textDecoration:"none",letterSpacing:"-0.01em"}}>
          <span style={{fontSize:16}}>⚡</span> Gerar Panfletos
        </Link>
      </div>

      {msg&&<div className={`toast ${msg.type==="success"?"toast-success":"toast-error"}`} style={{position:"relative",bottom:"auto",right:"auto",marginBottom:16}}>{msg.text}</div>}

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:32}}>
        {[
          {label:"Serviços",value:stats.servicos,color:"var(--accent)",href:"/dashboard/servicos"},
          {label:"Campanhas",value:stats.campanhas,color:"var(--purple)",href:"/dashboard/campanhas"},
          {label:"Canais",value:stats.canais,color:"var(--orange)",href:"/dashboard/canais"},
          {label:"Panfletos hoje",value:stats.panfletos_hoje,color:"var(--green)",href:"/dashboard/panfletagem"},
          {label:"Publicados",value:stats.publicados_total,color:"var(--green)",href:"/dashboard/historico"},
          {label:"Na fila",value:stats.pendentes,color:"var(--orange)",href:"/dashboard/fila"},
          {label:"Leads",value:stats.leads,color:"#30D158",href:"/dashboard/leads"},
        ].map(s=>(
          <Link key={s.label} href={s.href} style={{textDecoration:"none"}}>
            <div className="card" style={{cursor:"pointer",transition:"all 0.15s",position:"relative",overflow:"hidden"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=`${s.color}50`;e.currentTarget.style.transform="translateY(-1px)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.transform="translateY(0)";}}>
              <div style={{fontSize:10,fontWeight:600,color:"var(--text-tertiary)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>{s.label}</div>
              <div style={{fontSize:32,fontWeight:700,color:s.color,letterSpacing:"-0.04em",lineHeight:1}}>{s.value.toLocaleString("pt-BR")}</div>
              <div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${s.color}40,transparent)`}}/>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{marginBottom:32}}>
        <h2 style={{fontSize:16,fontWeight:600,marginBottom:14}}>Atalhos Rápidos</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
          {actions.map(a=>(
            <Link key={a.href} href={a.href} style={{textDecoration:"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:a.primary?"rgba(10,132,255,0.08)":"var(--bg-card)",border:`1px solid ${a.primary?"rgba(10,132,255,0.25)":"var(--border)"}`,borderRadius:"var(--radius-lg)",transition:"all 0.15s",cursor:"pointer"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=a.primary?"var(--accent)":"rgba(255,255,255,0.15)";e.currentTarget.style.transform="translateY(-1px)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=a.primary?"rgba(10,132,255,0.25)":"var(--border)";e.currentTarget.style.transform="translateY(0)";}}>
                <span style={{fontSize:22}}>{a.icon}</span>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:a.primary?"var(--accent)":"var(--text)"}}>{a.label}</div>
                  <div style={{fontSize:11,color:"var(--text-tertiary)",marginTop:1}}>{a.sub}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Bot CLT section */}
      <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:20}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontWeight:600,fontSize:15}}>Bot de Candidaturas CLT</div>
            <div style={{fontSize:13,color:"var(--text-secondary)",marginTop:2}}>
              Indeed, LinkedIn, InfoJobs, Catho, Sine e mais — executa Seg–Sex 9h
            </div>
          </div>
          <div style={{display:"flex",gap:10}}>
            <Link href="/dashboard/candidaturas" className="btn-outline" style={{padding:"8px 16px",fontSize:13,textDecoration:"none"}}>Ver candidaturas</Link>
            <button className="btn-primary" onClick={handleBotCLT} disabled={running} style={{padding:"8px 16px",fontSize:13,display:"flex",alignItems:"center",gap:8}}>
              {running?<><span className="animate-spin" style={{display:"inline-block",width:12,height:12,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",borderRadius:"50%"}}/>Iniciando...</>:"▶ Rodar Bot"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
