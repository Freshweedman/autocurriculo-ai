"use client";
import { supabase } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

interface AutoTask {
  id:string; platform:string; task_type:string; status:string;
  requires_human_confirmation:boolean; created_at:string;
  started_at:string|null; finished_at:string|null;
  result_json:{screenshot?:string;message?:string}|null;
  publishing_queue?:{generated_pamphlets?:{title:string}};
}

const ST_COLOR:Record<string,string>={pendente:"var(--text-tertiary)",rodando:"var(--accent)",aguardando_confirmacao:"var(--orange)",concluido:"var(--green)",erro:"var(--red)"};

export default function AutopilotPage() {
  const [tasks, setTasks] = useState<AutoTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [runnerOnline, setRunnerOnline] = useState<boolean|null>(null);

  useEffect(()=>{ load(); checkRunner(); },[]);

  const load = async () => {
    const { data:{user} } = await supabase.auth.getUser();
    if(!user){setLoading(false);return;}
    const { data } = await supabase.from("automation_tasks")
      .select("*, publishing_queue(generated_pamphlets(title))")
      .eq("user_id",user.id).order("created_at",{ascending:false}).limit(50);
    setTasks(data||[]); setLoading(false);
  };

  const checkRunner = async () => {
    try { const r=await fetch("http://localhost:8765/status",{signal:AbortSignal.timeout(2000)}); setRunnerOnline(r.ok); }
    catch { setRunnerOnline(false); }
  };

  const confirm = async (id:string) => {
    await supabase.from("automation_tasks").update({status:"concluido",requires_human_confirmation:false,finished_at:new Date().toISOString()}).eq("id",id);
    load();
  };

  const reject = async (id:string) => {
    await supabase.from("automation_tasks").update({status:"erro",finished_at:new Date().toISOString()}).eq("id",id);
    load();
  };

  return (
    <div style={{maxWidth:860,margin:"0 auto"}}>
      <div style={{marginBottom:28}}>
        <h1 style={{fontSize:26,fontWeight:700,letterSpacing:"-0.03em"}}>Autopilot</h1>
        <p style={{color:"var(--text-secondary)",marginTop:4,fontSize:14}}>Agente local que preenche plataformas externas com Playwright</p>
      </div>

      {/* Runner status */}
      <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:20,marginBottom:24}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:runnerOnline===null?"var(--text-tertiary)":runnerOnline?"var(--green)":"var(--red)",boxShadow:runnerOnline?"0 0 8px rgba(48,209,88,0.5)":"none"}}/>
            <div>
              <div style={{fontWeight:600,fontSize:15}}>Runner Local {runnerOnline===null?"(verificando...)":runnerOnline?"Online":"Offline"}</div>
              <div style={{fontSize:12,color:"var(--text-tertiary)",marginTop:1}}>Python + Playwright · porta 8765</div>
            </div>
          </div>
          <button className="btn-outline" style={{padding:"7px 16px",fontSize:13}} onClick={checkRunner}>Verificar</button>
        </div>

        {runnerOnline===false&&(
          <div style={{marginTop:16,padding:"14px 16px",background:"rgba(255,159,10,0.06)",border:"1px solid rgba(255,159,10,0.2)",borderRadius:"var(--radius-sm)"}}>
            <div style={{fontSize:13,fontWeight:600,color:"var(--orange)",marginBottom:8}}>Para iniciar o runner local:</div>
            <div style={{fontFamily:"monospace",fontSize:12,background:"rgba(0,0,0,0.3)",borderRadius:6,padding:"10px 14px",color:"var(--text-secondary)",lineHeight:1.8}}>
              cd automation-runner<br/>
              pip install -r requirements.txt<br/>
              python runner.py
            </div>
            <p style={{fontSize:12,color:"var(--text-tertiary)",marginTop:8}}>
              O runner abre o navegador, preenche os campos e aguarda sua confirmação antes de publicar.
            </p>
          </div>
        )}
      </div>

      {/* Regras */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:24}}>
        <div style={{background:"rgba(48,209,88,0.05)",border:"1px solid rgba(48,209,88,0.15)",borderRadius:"var(--radius-lg)",padding:16}}>
          <div style={{fontWeight:600,fontSize:13,color:"var(--green)",marginBottom:10}}>✅ O agente PODE</div>
          {["Abrir a URL da plataforma","Aguardar login manual","Preencher título, descrição, preço","Preencher categoria e tags","Fazer upload de imagens","Salvar rascunho","Tirar screenshot","Atualizar status no Supabase"].map(t=>(
            <div key={t} style={{fontSize:12,color:"var(--text-secondary)",padding:"3px 0"}}>{t}</div>
          ))}
        </div>
        <div style={{background:"rgba(255,69,58,0.05)",border:"1px solid rgba(255,69,58,0.15)",borderRadius:"var(--radius-lg)",padding:16}}>
          <div style={{fontWeight:600,fontSize:13,color:"var(--red)",marginBottom:10}}>🚫 O agente NÃO PODE</div>
          {["Publicar sem sua confirmação","Enviar proposta sem revisão","Resolver captcha","Burlar bloqueios","Criar conta falsa","Fazer spam em massa","Enviar mensagens sem revisão"].map(t=>(
            <div key={t} style={{fontSize:12,color:"var(--text-secondary)",padding:"3px 0"}}>{t}</div>
          ))}
        </div>
      </div>

      {/* Tasks */}
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <h2 style={{fontSize:16,fontWeight:600}}>Tarefas de Automação</h2>
          <button className="btn-outline" style={{padding:"6px 14px",fontSize:12}} onClick={load}>Atualizar</button>
        </div>

        {loading ? <div style={{textAlign:"center",padding:40}}><div className="animate-spin" style={{width:22,height:22,border:"2px solid var(--border)",borderTopColor:"var(--accent)",borderRadius:"50%",margin:"0 auto"}}/></div>
        : tasks.length===0 ? (
          <div style={{textAlign:"center",padding:60,border:"1px dashed var(--border)",borderRadius:"var(--radius-lg)"}}>
            <div style={{fontSize:36,marginBottom:12}}>🤖</div>
            <p style={{color:"var(--text-secondary)",fontSize:14}}>Nenhuma tarefa ainda.</p>
            <p style={{color:"var(--text-tertiary)",fontSize:13,marginTop:4}}>O runner cria tarefas automaticamente ao processar a fila.</p>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {tasks.map(t=>{
              const color=ST_COLOR[t.status]||"var(--text-tertiary)";
              return (
                <div key={t.id} style={{background:"var(--bg-card)",border:`1px solid ${t.status==="aguardando_confirmacao"?"rgba(255,159,10,0.3)":"var(--border)"}`,borderRadius:"var(--radius-lg)",padding:"14px 18px"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                    <div>
                      <div style={{fontWeight:600,fontSize:14}}>{t.publishing_queue?.generated_pamphlets?.title||t.task_type}</div>
                      <div style={{fontSize:12,color:"var(--text-tertiary)",marginTop:2}}>{t.platform} · {new Date(t.created_at).toLocaleString("pt-BR")}</div>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:11,padding:"3px 10px",borderRadius:100,background:`${color}18`,color,fontWeight:600}}>{t.status}</span>
                      {t.status==="aguardando_confirmacao"&&(
                        <>
                          <button className="btn-primary" style={{padding:"6px 14px",fontSize:12}} onClick={()=>confirm(t.id)}>✓ Confirmar e publicar</button>
                          <button className="btn-danger" style={{padding:"6px 14px",fontSize:12}} onClick={()=>reject(t.id)}>✕ Rejeitar</button>
                        </>
                      )}
                    </div>
                  </div>
                  {t.result_json?.screenshot&&(
                    <div style={{marginTop:12}}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={t.result_json.screenshot} alt="screenshot" style={{maxWidth:"100%",borderRadius:8,border:"1px solid var(--border)"}}/>
                    </div>
                  )}
                  {t.result_json?.message&&(
                    <div style={{marginTop:8,fontSize:12,color:"var(--text-tertiary)",background:"var(--bg)",borderRadius:6,padding:"8px 12px"}}>{t.result_json.message}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
