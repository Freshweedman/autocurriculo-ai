"use client";

import { CalendarDays, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Snapshot = {
  profile: { cargo: string | null; cidade: string | null; bot_ativo: boolean } | null;
  resume: { name: string } | null;
  opportunityCount: number;
  runs: { id: string; status: string; trigger_type: string; created_at: string; error_message: string | null }[];
  events: { id: number; message: string; created_at: string }[];
};

const statuses: Record<string, string> = {
  queued: "Na fila", running: "Buscando vagas", succeeded: "Busca encerrada",
  failed: "Busca interrompida", cancelled: "Cancelada", paused: "Pausada",
};
const dateLabel = (value: string) => new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default function AutomacaoPage() {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/run-bot", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setSnapshot(data);
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível consultar a busca.");
    }
  }, []);
  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const poll = window.setInterval(() => void load(), 7000);
    return () => { window.clearTimeout(first); window.clearInterval(poll); };
  }, [load]);

  async function command(action: "start" | "schedule", enabled?: boolean) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/run-bot", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, enabled }),
      });
      const result = await response.json();
      setMessage(result.message || result.error || "Não foi possível atualizar a busca.");
      await load();
    } catch { setMessage("Não foi possível atualizar a busca."); }
    finally { setBusy(false); }
  }

  const latest = snapshot?.runs[0];
  const searching = latest && ["queued", "running"].includes(latest.status);
  const schedule = snapshot?.profile?.bot_ativo;
  return <div className="automation-page resource-page">
    <header className="page-heading"><div><h1>Busca de vagas</h1>
      <p>Encontre vagas compatíveis e prepare suas candidaturas pelo celular.</p></div>
      <div className="page-actions">
        <button className="btn-primary" disabled={!snapshot || busy || !snapshot.profile?.cargo || Boolean(searching)} onClick={() => void command("start")}>
          <Search size={16} />{searching ? statuses[latest.status] : "Buscar vagas agora"}
        </button>
        <Link className="btn-outline" href="/dashboard/oportunidades">Ver vagas</Link>
      </div>
    </header>
    {message && <p className="notice" role="status">{message}</p>}
    {error && <p className="notice" role="alert">{error}</p>}
    {snapshot && <>
      {!snapshot.profile?.cargo && <p className="notice">Defina o cargo que você procura em <Link href="/dashboard/configuracoes">Configurações</Link>.</p>}
      <section className="automation-summary" aria-label="Resumo da busca">
        <article><span>Perfil de busca</span><strong>{snapshot.profile?.cargo || "Cargo pendente"}</strong><small>{snapshot.profile?.cidade || "Sem cidade definida"}</small></article>
        <article><span>Vagas disponíveis</span><strong>{snapshot.opportunityCount}</strong><small><Link href="/dashboard/oportunidades">Preparar candidatura</Link></small></article>
        <article><span>Currículo padrão</span><strong>{snapshot.resume?.name || "Pendente"}</strong><small><Link href="/dashboard/curriculos">Gerenciar currículo</Link></small></article>
      </section>
      <section className="automation-panel">
        <div className="panel-heading">
          <h2><CalendarDays size={16} /> Busca automática</h2>
          <button className="btn-outline" disabled={busy || !snapshot.profile?.cargo} onClick={() => void command("schedule", !schedule)}>
            {schedule ? "Pausar busca automática" : "Ativar busca automática"}
          </button>
        </div>
        <p>{schedule ? "Ativada para dias úteis. As vagas aparecem na sua conta mesmo com o navegador fechado." : "Ative para receber novas vagas em dias úteis."}</p>
      </section>
      <section className="automation-layout">
        <div className="automation-panel">
          <div className="panel-heading"><h2>Última busca</h2></div>
          {latest ? <div className="run-list">
            <article><strong>{statuses[latest.status] || latest.status}</strong><small>{dateLabel(latest.created_at)}</small></article>
            {latest.error_message && <p>{latest.error_message}</p>}
          </div> : <p>Inicie uma busca para acompanhar o progresso.</p>}
          {snapshot.events.length > 0 && <ol className="run-timeline">{snapshot.events.map((item) => <li key={item.id}>
            <span className="timeline-dot"><Search size={13} /></span><div><strong>{item.message}</strong><small>{dateLabel(item.created_at)}</small></div>
          </li>)}</ol>}
        </div>
        <div className="automation-panel">
          <div className="panel-heading"><h2>Histórico de buscas</h2></div>
          <div className="run-list">{snapshot.runs.slice(1).map((run) => <article key={run.id}>
            <strong>{statuses[run.status] || run.status}</strong><small>{dateLabel(run.created_at)} · {run.trigger_type === "scheduled" ? "Automática" : "Manual"}</small>
          </article>)}</div>
          {snapshot.runs.length < 2 && <p>As próximas buscas aparecerão aqui.</p>}
        </div>
      </section>
    </>}
  </div>;
}
