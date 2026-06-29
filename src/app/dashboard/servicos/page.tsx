"use client";
import { useEffect, useState } from "react";

interface Service {
  id: string; name: string; category: string; base_description: string;
  price_min: number; price_mid: number; price_max: number; delivery_time: string;
  includes: string[]; target_audience: string; portfolio_url: string;
  whatsapp_url: string; instagram_url: string; active: boolean; created_at: string;
}

const CATS = ["Sites","Landing Pages","Lojas Virtuais","Sistemas","Criativos","Capturas","Portfólios","Outros"];

const SERVICOS_PADRAO = [
  {
    name:"Criação de Site Profissional",category:"Sites",
    base_description:"Criação de site profissional completo para pequenos e médios negócios. Layout moderno, responsivo, otimizado para Google e pronto para receber clientes.",
    price_min:"800",price_mid:"1500",price_max:"3000",delivery_time:"7 dias úteis",
    includes:"Domínio, hospedagem 1 ano, SSL, até 5 páginas, formulário de contato, integração WhatsApp, SEO básico",
    target_audience:"Clínicas, restaurantes, advogados, prestadores de serviços locais, delivery",
    portfolio_url:"",whatsapp_url:"",instagram_url:"",active:true,
  },
  {
    name:"Landing Page para Tráfego Pago",category:"Landing Pages",
    base_description:"Landing page de alta conversão para campanhas de Google Ads e Meta Ads. Foco total em captura de leads e vendas.",
    price_min:"600",price_mid:"1200",price_max:"2500",delivery_time:"5 dias úteis",
    includes:"1 página otimizada, formulário de captura, pixel instalado, integração WhatsApp, A/B ready",
    target_audience:"Infoprodutores, prestadores de serviços, cursos online, clínicas estéticas",
    portfolio_url:"",whatsapp_url:"",instagram_url:"",active:true,
  },
  {
    name:"Loja Virtual",category:"Lojas Virtuais",
    base_description:"Loja virtual completa com catálogo de produtos, carrinho de compras, checkout e integração com meios de pagamento.",
    price_min:"1500",price_mid:"3000",price_max:"6000",delivery_time:"15 dias úteis",
    includes:"Catálogo, checkout, pagamento online, gestão de estoque, painel admin, mobile-friendly",
    target_audience:"Lojistas, artesãos, empreendedores, marcas de roupas e calçados",
    portfolio_url:"",whatsapp_url:"",instagram_url:"",active:true,
  },
  {
    name:"Site para Clínica",category:"Sites",
    base_description:"Site especializado para clínicas médicas, odontológicas, estéticas e de saúde. Inclui agendamento online e apresentação dos profissionais.",
    price_min:"1000",price_mid:"2000",price_max:"4000",delivery_time:"10 dias úteis",
    includes:"Agendamento online, perfil dos profissionais, galeria, depoimentos, integração WhatsApp, LGPD",
    target_audience:"Clínicas médicas, odontológicas, psicólogos, fisioterapeutas, nutricionistas",
    portfolio_url:"",whatsapp_url:"",instagram_url:"",active:true,
  },
  {
    name:"Site para Delivery",category:"Sites",
    base_description:"Site de cardápio digital para restaurantes e delivery. Integrado com WhatsApp para receber pedidos diretamente.",
    price_min:"700",price_mid:"1200",price_max:"2500",delivery_time:"5 dias úteis",
    includes:"Cardápio digital, pedido via WhatsApp, galeria de pratos, horários, localização, mobile first",
    target_audience:"Restaurantes, hamburguerias, pizzarias, marmitarias, docerias",
    portfolio_url:"",whatsapp_url:"",instagram_url:"",active:true,
  },
  {
    name:"Criativo para Anúncio",category:"Criativos",
    base_description:"Criação de criativos profissionais para campanhas de Meta Ads e Google Ads. Formato story, feed e banner.",
    price_min:"200",price_mid:"500",price_max:"1200",delivery_time:"2 dias úteis",
    includes:"5 variações, formatos story e feed, arquivos editáveis, revisões incluídas",
    target_audience:"Negócios que fazem tráfego pago, e-commerces, infoprodutores",
    portfolio_url:"",whatsapp_url:"",instagram_url:"",active:true,
  },
];

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
  const [addingDefaults, setAddingDefaults] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const r = await fetch("/api/services");
    if (r.ok) { const d = await r.json(); setServices(d.services); }
    setLoading(false);
  };

  const addDefaults = async () => {
    setAddingDefaults(true);
    for (const s of SERVICOS_PADRAO) {
      await fetch("/api/services", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ ...s, includes: s.includes.split(",").map(x=>x.trim()).filter(Boolean) }) });
    }
    const r2 = await fetch("/api/services");
    if (r2.ok) { const d = await r2.json(); setServices(d.services); }
    setMsg("6 serviços padrão adicionados! Edite com seus dados reais.");
    setTimeout(()=>setMsg(""),5000);
    setAddingDefaults(false);
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
        <div style={{display:"flex",gap:10}}>
          {services.length===0 && (
            <button className="btn-outline" onClick={addDefaults} disabled={addingDefaults} style={{padding:"10px 16px",fontSize:13}}>
              {addingDefaults ? "Adicionando..." : "⚡ Adicionar meus serviços"}
            </button>
          )}
          <button className="btn-primary" onClick={()=>{setForm(emptyForm());setEditId(null);setShowForm(true);}} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 20px",fontWeight:600}}>
            + Novo Serviço
          </button>
        </div>
      </div>
      {/* Tutorial */}
      <div style={{background:"rgba(10,132,255,0.05)",border:"1px solid rgba(10,132,255,0.15)",borderRadius:"var(--radius-lg)",padding:"16px 20px",marginBottom:24}}>
        <div style={{fontWeight:600,fontSize:13,color:"var(--accent)",marginBottom:8}}>💼 Como usar Meus Serviços</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
          {[
            {n:"1",t:"Cadastre seus serviços",d:'Clique em "⚡ Adicionar serviços padrão" ou crie do zero com seus preços reais'},
            {n:"2",t:"Edite com seus dados",d:"Coloque seu preço real, prazo, WhatsApp e link do portfolio"},
            {n:"3",t:"Crie campanhas",d:"Vá em Campanhas e crie pacotes de divulgação por serviço"},
            {n:"4",t:"Gere os panfletos",d:"Na Panfletagem, selecione o serviço e clique ⚡ — 85+ variações prontas"},
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
        <div style={{textAlign:"center",padding:"48px 32px",border:"1px dashed var(--border)",borderRadius:"var(--radius-lg)"}}>
          <div style={{fontSize:44,marginBottom:14}}>💼</div>
          <p style={{color:"var(--text-secondary)",fontSize:15,marginBottom:8,fontWeight:500}}>Nenhum serviço cadastrado ainda.</p>
          <p style={{color:"var(--text-tertiary)",fontSize:13,marginBottom:28,maxWidth:420,margin:"0 auto 28px"}}>
            Adicione seus serviços reais (sites, landing pages, lojas…) para gerar anúncios automaticamente em todos os canais.
          </p>
          <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
            <button className="btn-primary" onClick={addDefaults} disabled={addingDefaults} style={{padding:"11px 24px",fontWeight:600,fontSize:14}}>
              {addingDefaults?"Adicionando...":"⚡ Adicionar serviços padrão"}
            </button>
            <button className="btn-outline" onClick={()=>setShowForm(true)} style={{padding:"11px 24px",fontSize:14}}>
              Criar do zero
            </button>
          </div>
          <p style={{color:"var(--text-tertiary)",fontSize:12,marginTop:16}}>
            Serviços padrão já vêm com descrição, preços e público-alvo preenchidos. Edite com seus dados depois.
          </p>
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
