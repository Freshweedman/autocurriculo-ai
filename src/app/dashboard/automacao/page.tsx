"use client";

import { Activity, Clock3, Play, Square } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Control = {
  enabled: boolean;
  last_seen_at: string | null;
  platform_limits: Record<string, number>;
  screening_answers: Record<string, string>;
  resume_id: string | null;
};
type Job = { id: string; platform: string; url: string; title: string; company: string; status: string; detail?: string; confirmation_text?: string; confirmation_url?: string; screenshot_path?: string };
type Event = { id: number; platform: string | null; message: string; created_at: string };
type Metric = { platform: string; today: number; week: number; month: number };
type Snapshot = {
  control: Control | null; online: boolean; jobs: Job[]; review: Job[]; events: Event[]; metrics: Metric[];
  resumes: { id: string; name: string; is_default: boolean }[];
};

const labels: Record<string, string> = {
  discovered: "Descoberta", queued: "Na fila", applying: "Envio reservado", applied_confirmed: "Confirmada",
  applied_unconfirmed: "Confirme no portal", needs_login: "Login necessário", needs_review: "Revisão necessária",
  skipped_external: "Formulário externo", skipped_filter: "Fora do filtro", failed: "Falha",
};

const formatTime = (value: string) => new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

function parsePairs(text: string) {
  return text.split("\n").filter((line) => line.trim()).map((line) => {
    const boundary = line.indexOf("=");
    if (boundary < 1 || !line.slice(boundary + 1).trim()) throw Error("Preencha cada linha no formato indicado.");
    return [line.slice(0, boundary).trim(), line.slice(boundary + 1).trim()];
  });
}

function JobList({ items, retry }: { items: Job[]; retry?: (id: string) => void }) {
  return items.length ? <div className="run-list">{items.map((job) => <article key={job.id}>
    <div>
      <strong><a href={job.url} target="_blank" rel="noreferrer">{job.title}</a></strong>
      <small>{job.company} · {job.platform} · {labels[job.status] || job.status}</small>
      {job.detail && <p>{job.detail}</p>}
      {job.confirmation_text && <p>{job.confirmation_text}</p>}
      {retry && ["needs_review", "needs_login", "failed"].includes(job.status) && <button className="btn-outline" onClick={() => retry(job.id)}>Voltar à fila</button>}
      {job.screenshot_path && <a href={`/api/run-bot?evidence=${job.id}`} target="_blank" rel="noreferrer">Ver captura da confirmação</a>}
    </div>
  </article>)}</div> : <p>Nenhuma vaga nesta lista.</p>;
}

export default function AutomacaoPage() {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const [editing, setEditing] = useState(false);
  const [resume, setResume] = useState("");
  const [limits, setLimits] = useState("");
  const [answers, setAnswers] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/run-bot", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setSnapshot(data);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Não foi possível consultar o runner.");
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const poll = window.setInterval(() => void load(), 5000);
    return () => { window.clearTimeout(initial); window.clearInterval(poll); };
  }, [load]);

  async function command(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/run-bot", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error || "Não foi possível atualizar o runner.");
      if (action === "pair") setToken(body.token);
      if (action === "settings") setEditing(false);
      setMessage(body.message || "Código gerado. Cole-o no terminal do runner.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "O painel perdeu a comunicação com o runner.");
    } finally {
      setBusy(false);
    }
  }

  const control = snapshot?.control;
  const online = snapshot?.online;
  const totals = snapshot?.metrics.reduce((acc, item) => ({
    today: acc.today + item.today, week: acc.week + item.week, month: acc.month + item.month,
  }), { today: 0, week: 0, month: 0 });

  return <div className="automation-page resource-page">
    <header className="page-heading">
      <div><h1>Central de Automação</h1><p>Controle a busca e acompanhe as candidaturas que receberam confirmação da plataforma.</p></div>
      <div className="page-actions">
        <button className="btn-primary" disabled={busy || !snapshot} onClick={() => void command(control?.enabled ? "stop" : "start")}>
          {control?.enabled ? <Square size={16} /> : <Play size={16} />}{control?.enabled ? "STOP" : "START"}
        </button>
      </div>
    </header>
    {message && <p className="notice" role="status">{message}</p>}
    {loadError && <p className="notice" role="alert">{loadError}</p>}
    {snapshot && <section className="automation-summary" aria-label="Resumo do runner">
      <article><span>Runner local</span><strong>{online ? "Online" : "Offline"}</strong>
        <small>{control?.last_seen_at ? `Última batida em ${formatTime(control.last_seen_at)}` : "Vincule este computador para iniciar."}</small>
        <small>{control?.enabled ? "START ativo" : "Pausado"}</small>
      </article>
      <article><span>Confirmadas</span><strong>{totals?.today ?? 0} hoje</strong><small>{totals?.week ?? 0} nesta semana</small></article>
      <article><span>Meta mensal</span><strong>{totals?.month ?? 0} / 500</strong><progress max={500} value={totals?.month ?? 0} aria-label="Progresso da meta mensal" /></article>
    </section>}
    <section className="automation-panel">
      <div className="panel-heading">
        <h2>Configuração do runner</h2>
        <div className="page-actions">
          <button className="btn-outline" disabled={busy} onClick={() => {
            if (control?.last_seen_at && !window.confirm("Gerar outro código desvincula o runner atual e pausa a execução. Continuar?")) return;
            void command("pair");
          }}>Gerar código de vínculo</button>
          <button className="btn-outline" disabled={!snapshot || busy} onClick={() => {
            setLimits(Object.entries(control?.platform_limits || {}).map(([key, value]) => `${key} = ${value}`).join("\n"));
            setAnswers(Object.entries(control?.screening_answers || {}).map(([key, value]) => `${key} = ${value}`).join("\n"));
            setResume(control?.resume_id || "");
            setEditing((value) => !value);
          }}>{editing ? "Fechar ajustes" : "Ajustar limites e currículo"}</button>
        </div>
      </div>
      {token && <div className="notice"><label htmlFor="runner-code">Cole este código ao executar <code>runner.bat vincular</code></label>
        <input id="runner-code" readOnly autoComplete="off" value={token} onFocus={(event) => event.target.select()} />
        <button className="btn-outline" onClick={() => setToken("")}>Ocultar código</button>
      </div>}
      {editing && <form className="automation-runner-form" onSubmit={(event) => {
        event.preventDefault();
        try {
          const platformLimits = Object.fromEntries(parsePairs(limits).map(([key, value]) => [key, Number(value)]));
          void command("settings", { limits: platformLimits, answers: Object.fromEntries(parsePairs(answers)), resume: resume || null });
        } catch (error) { setMessage(error instanceof Error ? error.message : "Confira os campos."); }
      }}>
        <label>Currículo usado pelo runner<select value={resume} onChange={(event) => setResume(event.target.value)}>
          <option value="">Usar o currículo padrão</option>
          {snapshot?.resumes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <label>Limite diário por plataforma · padrão de 30<textarea rows={2} value={limits} onChange={(event) => setLimits(event.target.value)} placeholder="Indeed = 25" /></label>
        <label>Respostas de triagem · pergunta exata = resposta<textarea rows={3} value={answers} onChange={(event) => setAnswers(event.target.value)} placeholder="Qual é a sua disponibilidade? = Imediata" /></label>
        <button className="btn-primary" disabled={busy}>Salvar ajustes</button>
      </form>}
    </section>
    {snapshot && <>
      <section className="automation-layout">
        <div className="automation-panel">
          <div className="panel-heading"><h2>Vagas que precisam de você</h2></div>
          <JobList items={snapshot.review} retry={busy ? undefined : (id) => void command("retry", { id })} />
          <p>Acesse a vaga para revisar o formulário. Para login ou verificação, abra <code>runner.bat login</code> com o runner fechado.</p>
          <p className="runner-source-links">
            <a href="https://www.linkedin.com/jobs/" target="_blank" rel="noreferrer">LinkedIn Jobs</a>
            <a href="https://www.glassdoor.com.br/Vaga/index.htm" target="_blank" rel="noreferrer">Glassdoor</a>
            <a href="https://servicos.mte.gov.br/" target="_blank" rel="noreferrer">SINE / Emprega Brasil</a>
          </p>
        </div>
        <div className="automation-panel">
          <div className="panel-heading"><h2>Confirmadas por plataforma</h2></div>
          {snapshot.metrics.length ? <div className="run-list">{snapshot.metrics.map((metric) => <article key={metric.platform}>
            <strong>{metric.platform}</strong><small>{metric.today} hoje · {metric.week} semana · {metric.month} mês</small>
          </article>)}</div> : <p>Nenhuma confirmação registrada pelo runner neste mês.</p>}
        </div>
      </section>
      <section className="automation-layout">
        <div className="automation-panel"><div className="panel-heading"><h2>Fila e resultados recentes</h2></div><JobList items={snapshot.jobs} /></div>
        <div className="automation-panel">
          <div className="panel-heading"><h2>Atividade</h2><Activity size={17} /></div>
          {snapshot.events.length ? <ol className="run-timeline">{snapshot.events.map((event) => <li key={event.id}>
            <span className="timeline-dot"><Clock3 size={14} /></span>
            <div><strong>{event.platform ? `${event.platform} · ` : ""}{event.message}</strong><small>{formatTime(event.created_at)}</small></div>
          </li>)}</ol> : <p>As etapas do runner aparecem aqui após o START.</p>}
        </div>
      </section>
    </>}
  </div>;
}
