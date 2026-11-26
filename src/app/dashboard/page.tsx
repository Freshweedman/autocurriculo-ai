"use client";

import Link from "next/link";
import { ArrowRight, Bookmark, BriefcaseBusiness, Search, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Application = { id: string; empresa: string | null; vaga: string | null; plataforma: string; status: string; created_at: string; vaga_url: string | null };
type Metric = { label: string; value: number | null; detail: string };
const TECHNICAL_ATTEMPTS = ["falhou", "sem_file_input", "sem_submit", "nao_suportado", "duplicado"];

export default function DashboardPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [cargo, setCargo] = useState("");
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const [profile, applications, total, sent, saved, today, month, publicQueue] = await Promise.all([
      supabase.from("profiles").select("cargo").eq("user_id", user.id).maybeSingle(),
      supabase.from("applications").select("id,empresa,vaga,plataforma,status,created_at,vaga_url").eq("user_id", user.id).not("status", "in", `(${TECHNICAL_ATTEMPTS.join(",")})`).order("created_at", { ascending: false }).limit(5),
      supabase.from("applications").select("*", { count: "exact", head: true }).eq("user_id", user.id).not("status", "in", `(${TECHNICAL_ATTEMPTS.join(",")})`),
      supabase.from("applications").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "confirmed"),
      supabase.from("user_opportunities").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "saved"),
      supabase.from("applications").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "confirmed").gte("confirmed_at", new Date(new Date().setHours(0,0,0,0)).toISOString()),
      supabase.from("applications").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "confirmed").gte("confirmed_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      fetch("/api/public-applications", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]);
    const configuredRoles = profile.data?.cargo ? profile.data.cargo.split(/[,;\n]/).filter(Boolean).length : 0;
    setCargo(profile.data?.cargo || "");
    setApps(applications.data || []);
    setMetrics([
      { label: "Candidaturas registradas", value: total.count, detail: "na sua conta" },
      { label: "Envios confirmados", value: sent.count, detail: "com evidência registrada" },
      { label: "Oportunidades salvas", value: saved.error ? null : saved.count, detail: saved.error ? "disponível após migration" : "para revisar depois" },
      { label: "Cargos configurados", value: configuredRoles, detail: configuredRoles ? "na sua preferência" : "defina nas configurações" },
      { label: "Enviadas hoje", value: today.error ? null : today.count, detail: "somente com prova" },
      { label: "Enviadas no mês", value: month.error ? null : month.count, detail: "somente com prova" },
      { label: "Para enviar", value: publicQueue?.queue?.filter((item: { status: string }) => ["needs_action", "unconfirmed"].includes(item.status)).length ?? null, detail: "ação de um toque" },
    ]);
    setLoading(false);
  }

  useEffect(() => { const task = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(task); }, []);

  return <div className="career-dashboard"><header className="career-header"><div><p className="eyebrow">VISÃO GERAL</p><h1>Sua busca, em ordem.</h1><p>Use este espaço para acompanhar registros reais e decidir seu próximo passo.</p></div><div className="page-actions"><Link className="btn-primary career-primary" href="/dashboard/automacao"><Play size={16} /> START</Link><Link className="btn-outline career-primary" href="/dashboard/oportunidades"><Search size={16} /> Ver oportunidades</Link></div></header>
    <section className="career-summary">{metrics.map((item) => <div key={item.label}><small>{item.label}</small><strong>{loading || item.value === null ? "—" : item.value}</strong><span>{item.detail}</span></div>)}</section>
    <section className="career-grid"><div className="career-section"><div className="section-heading"><div><h2>Atividade recente</h2><p>Registros da sua conta.</p></div><Link href="/dashboard/candidaturas">Ver todas <ArrowRight size={15} /></Link></div>{loading ? <div className="page-skeleton" /> : apps.length ? <div className="activity-list">{apps.map((app) => <a href={app.vaga_url || undefined} target={app.vaga_url ? "_blank" : undefined} rel="noreferrer" key={app.id}><span className="activity-mark"><BriefcaseBusiness size={16} /></span><div><strong>{app.empresa || app.plataforma}</strong><small>{app.vaga || "Oportunidade registrada"}</small></div><em>{app.status}</em></a>)}</div> : <div className="empty-state"><BriefcaseBusiness size={22} /><p>Nenhuma candidatura registrada ainda.</p><Link href="/dashboard/oportunidades">Ver oportunidades</Link></div>}</div>
      <aside className="career-section next-step"><p className="eyebrow">PRÓXIMO PASSO</p><h2>{cargo ? "Revise suas preferências" : "Configure sua busca"}</h2><p>{cargo ? "Seus cargos e localização estão salvos. Revise as preferências antes de iniciar uma descoberta." : "Adicione cargos e localização para começar sua busca."}</p><Link href="/dashboard/configuracoes" className="btn-outline"><Bookmark size={16} /> Abrir configurações</Link></aside></section>
  </div>;
}
