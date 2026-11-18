"use client";

import { Bookmark, ExternalLink, Loader2, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Opportunity = { id: string; title: string; company: string | null; canonical_url: string; source: string; location_text: string | null; work_mode: string | null; contract_type: string | null; seniority: string | null; published_at: string | null; discovered_at: string; raw_data?: { compatibility_score?: number; match_reasons?: string[] } };

export default function OportunidadesPage() {
  const [items, setItems] = useState<Opportunity[]>([]); const [saved, setSaved] = useState(new Set<string>()); const [query, setQuery] = useState(""); const [mode, setMode] = useState("todos"); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const [relations, savedRelations] = await Promise.all([
      supabase.from("user_opportunities").select("opportunity_id,status,opportunities!inner(id,title,company,canonical_url,source,location_text,work_mode,contract_type,seniority,published_at,discovered_at,raw_data)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("user_opportunities").select("opportunity_id").eq("user_id", user.id).in("status", ["saved", "preparing", "awaiting_submission"]),
    ]);
    const scoped = (relations.data || []).flatMap((row) => row.opportunities ? [row.opportunities as unknown as Opportunity] : []);
    setItems(scoped); setSaved(new Set((savedRelations.data || []).map((row) => row.opportunity_id))); setMessage(relations.error ? "As oportunidades estarão disponíveis depois que a busca registrar resultados para esta conta." : ""); setLoading(false);
  }
  useEffect(() => { const task = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(task); }, []);
  const filtered = useMemo(() => items.filter((item) => (!query || `${item.title} ${item.company || ""} ${item.location_text || ""}`.toLowerCase().includes(query.toLowerCase())) && (mode === "todos" || item.work_mode === mode)), [items, query, mode]);
  async function toggleSave(item: Opportunity) {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    if (saved.has(item.id)) { const { error } = await supabase.from("user_opportunities").delete().eq("user_id", user.id).eq("opportunity_id", item.id); if (error) setMessage(error.message); else setSaved((current) => { const next = new Set(current); next.delete(item.id); return next; }); return; }
    const { error } = await supabase.from("user_opportunities").upsert({ user_id: user.id, opportunity_id: item.id, status: "saved" }); if (error) setMessage(error.message); else setSaved((current) => new Set([...current, item.id]));
  }
  return <div className="resource-page"><header className="page-heading"><div><p className="eyebrow">OPORTUNIDADES</p><h1>Vagas encontradas para você.</h1><p>Esta lista contém somente oportunidades vinculadas à sua busca. Abrir uma vaga não envia currículo.</p></div></header><div className="opportunity-filters"><label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cargo, empresa ou cidade" /></label><label><SlidersHorizontal size={16} /><select value={mode} onChange={(event) => setMode(event.target.value)}><option value="todos">Todas as modalidades</option><option value="remote">Remoto</option><option value="hybrid">Híbrido</option><option value="onsite">Presencial</option></select></label></div>{message && <div className="notice" role="status">{message}</div>}{loading ? <div className="empty-panel"><Loader2 className="animate-spin" /> Consultando oportunidades…</div> : filtered.length === 0 ? <div className="empty-panel"><Search size={28} /><h2>Nenhuma oportunidade para esta busca</h2><p>Revise localização e cargos em Configurações e inicie uma busca. Resultados internacionais só aparecem quando essa opção está autorizada.</p></div> : <div className="opportunity-list">{filtered.map((item) => <article className="opportunity-row" key={item.id}><div><p className="source-label">{item.source}{item.raw_data?.compatibility_score ? ` · ${item.raw_data.compatibility_score}% compatível` : ""}</p><h2>{item.title}</h2><p>{item.company || "Empresa não informada"}{item.location_text ? ` · ${item.location_text}` : ""}</p>{item.raw_data?.match_reasons?.length ? <p className="match-reasons">{item.raw_data.match_reasons.join(" · ")}</p> : null}<div className="opportunity-tags">{item.work_mode && <span>{item.work_mode}</span>}{item.contract_type && <span>{item.contract_type}</span>}{item.seniority && <span>{item.seniority}</span>}</div></div><div className="row-actions"><button className={saved.has(item.id) ? "btn-secondary" : "btn-ghost"} onClick={() => toggleSave(item)} aria-label="Salvar oportunidade"><Bookmark size={16} fill={saved.has(item.id) ? "currentColor" : "none"} /></button><a className="btn-primary" href={item.canonical_url} target="_blank" rel="noreferrer">Abrir vaga <ExternalLink size={15} /></a></div></article>)}</div>}</div>;
}
