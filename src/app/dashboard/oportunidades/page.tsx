"use client";

import { Bookmark, Download, ExternalLink, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Opportunity = { id: string; title: string; company: string | null; canonical_url: string; source: string; location_text: string | null };
type Row = { opportunity: Opportunity; saved: boolean };

export default function OportunidadesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [tracked, setTracked] = useState(new Set<string>());
  const [resume, setResume] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    let live = true;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!live) return;
      if (!user) { setLoading(false); setMessage("Entre para ver suas vagas."); return; }
      setUserId(user.id);
      const [relations, applications, pdf] = await Promise.all([
        supabase.from("user_opportunities").select("status,opportunities!inner(id,title,company,canonical_url,source,location_text)").eq("user_id", user.id).neq("status", "dismissed").order("created_at", { ascending: false }).limit(100),
        supabase.from("applications").select("vaga_url").eq("user_id", user.id).in("status", ["submitted_manual", "confirmed", "candidatado", "em_analise", "entrevista", "aprovado", "rejeitado"]),
        supabase.from("resumes").select("name").eq("user_id", user.id).eq("is_default", true).maybeSingle(),
      ]);
      if (!live) return;
      if (relations.error || applications.error || pdf.error) setMessage("Alguns dados da candidatura ficaram indisponíveis. Atualize a página para tentar novamente.");
      setRows((relations.data || []).flatMap((row) => row.opportunities ? [{ opportunity: row.opportunities as unknown as Opportunity, saved: row.status === "saved" }] : []));
      setTracked(new Set((applications.data || []).map((item) => item.vaga_url).filter(Boolean)));
      setResume(pdf.data?.name || null);
      setLoading(false);
    }
    void load();
    return () => { live = false; };
  }, []);

  async function save(item: Row) {
    const { error } = await supabase.from("user_opportunities").update({ status: item.saved ? "found" : "saved" }).eq("user_id", userId).eq("opportunity_id", item.opportunity.id);
    if (error) setMessage("A vaga não pôde ser atualizada.");
    else setRows((previous) => previous.map((row) => row.opportunity.id === item.opportunity.id ? { ...row, saved: !item.saved } : row));
  }

  async function register(item: Opportunity) {
    setBusy(item.id);
    setMessage("");
    try {
      const response = await fetch("/api/apply-assisted", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }),
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error);
      setTracked((current) => new Set([...current, item.canonical_url]));
      setMessage(body.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível registrar o envio."); }
    finally { setBusy(""); }
  }

  const filter = query.trim().toLowerCase();
  const filtered = rows.filter(({ opportunity }) => `${opportunity.title} ${opportunity.company || ""} ${opportunity.location_text || ""}`.toLowerCase().includes(filter));

  return <div className="resource-page">
    <header className="page-heading"><div><h1>Vagas para você</h1><p>Abra a vaga, candidate-se no portal e marque quando terminar.</p></div>
      <div className="page-actions"><Link className="btn-outline" href="/dashboard/automacao">Buscar vagas</Link><Link className="btn-outline" href="/dashboard/candidaturas">Ver meus envios</Link></div>
    </header>
    <div className="opportunity-filters"><label><Search size={16} /><input aria-label="Filtrar vagas" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cargo, empresa ou cidade" /></label></div>
    {message && <div className="notice" role="status">{message}</div>}
    {loading ? <div className="empty-panel"><Loader2 className="animate-spin" /> Consultando vagas…</div> : filtered.length === 0 ?
      <div className="empty-panel"><Search size={26} /><h2>Nenhuma vaga nesta lista</h2><Link className="btn-primary" href="/dashboard/automacao">Ir para busca de vagas</Link></div> :
      <div className="opportunity-list">{filtered.map((row) => {
        const item = row.opportunity;
        const sent = tracked.has(item.canonical_url);
        return <article className="opportunity-row assisted-job" key={item.id}>
          <div><p className="source-label">{item.source}</p><h2>{item.title}</h2>
            <p>{item.company || "Empresa não informada"}{item.location_text ? ` · ${item.location_text}` : ""}</p>
            {sent && <p>Já consta no seu histórico.</p>}
          </div>
          <div className="row-actions">
            <button className={row.saved ? "btn-secondary" : "btn-ghost"} aria-pressed={row.saved} aria-label="Salvar vaga" onClick={() => void save(row)}>
              <Bookmark size={17} fill={row.saved ? "currentColor" : "none"} />
            </button>
            <button className="btn-primary" aria-expanded={open === item.id} onClick={() => setOpen((current) => current === item.id ? "" : item.id)}>
              {open === item.id ? "Fechar" : "Preparar candidatura"}
            </button>
          </div>
          {open === item.id && <div className="assisted-job-steps">
            <div><strong>1. Separe o currículo</strong>{resume ? <a className="btn-outline" href="/api/apply-assisted"><Download size={15} /> Baixar PDF</a> : <Link className="btn-outline" href="/dashboard/curriculos">Adicionar currículo</Link>}</div>
            <div><strong>2. Envie no portal</strong><a className="btn-primary" target="_blank" rel="noreferrer" href={item.canonical_url}>Abrir vaga <ExternalLink size={15} /></a></div>
            <div><strong>3. Registre após enviar</strong><button className="btn-outline" disabled={sent || Boolean(busy)} onClick={() => void register(item)}>{sent ? "Registrado" : busy === item.id ? "Registrando…" : "Já enviei"}</button></div>
          </div>}
        </article>;
      })}</div>}
  </div>;
}
