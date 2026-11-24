"use client";

import { useCallback, useEffect, useState } from "react";

type Job = { id: string; opportunity_id: string | null; title: string; company: string | null; source: string; url: string; status: string; reason: string | null; updated_at: string };
type Data = { queue: Job[]; linkedTelegram: boolean; telegramAvailable: boolean; live: boolean; configReason?: string };
const labels: Record<string, string> = { queued: "Aguardando verificação", checking: "Em verificação", ready: "Pronta para aprovação", approved: "Aprovada", applying: "Enviando", confirmed: "Confirmada", needs_action: "Precisa de você", unconfirmed: "Sem confirmação" };
const reasons: Record<string, string> = { unsupported: "Use o portal", captcha: "Verificação humana", authentication: "Login necessário", required_answers: "Pergunta pendente", unknown_form: "Formulário fora do padrão", reservation_denied: "Limite ou aprovação expirou", provider_uncertain: "Confira antes de repetir", interrupted: "Execução interrompida", form_observed: "Formulário público encontrado" };

export function PublicApplicationQueue() {
  const [data, setData] = useState<Data>(); const [selected, setSelected] = useState<string[]>([]); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const response = await fetch("/api/public-applications", { cache: "no-store" }); if (response.ok) setData(await response.json()); }, []);
  useEffect(() => { void load(); const id = window.setInterval(() => void load(), 8000); return () => window.clearInterval(id); }, [load]);
  async function command(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true); setNote("");
    try { const r = await fetch("/api/public-applications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...extra }) }); const body = await r.json(); setNote(body.message || body.error || "Não foi possível concluir."); if (body.url) window.open(body.url, "_blank", "noopener,noreferrer"); if (r.ok) { setSelected([]); await load(); } } catch { setNote("Não foi possível concluir."); } finally { setBusy(false); }
  }
  const ready = data?.queue.filter((job) => job.status === "ready") || []; const needs = data?.queue.filter((job) => ["needs_action", "unconfirmed"].includes(job.status)) || [];
  return <section className="automation-panel" aria-label="Candidaturas públicas">
    <div className="panel-heading"><h2>Candidaturas públicas</h2><button className="btn-outline" disabled={busy} onClick={() => void command("inspect")}>Verificar formulários</button></div>
    <p>Somente descoberta de formulários públicos sem login. O envio automático está desativado. O restante fica em “Para enviar”.</p>
    {note && <p className="notice" role="status">{note}</p>}
    {data ? <>
      {data.configReason && data.configReason !== "válida" && <p className="notice" role="alert">Configuração do serviço: {data.configReason}. O envio permanece desligado.</p>}
      <p><strong>{ready.length}</strong> prontas · <strong>{needs.length}</strong> precisam de você · <strong>{data.queue.filter((job) => job.status === "confirmed").length}</strong> confirmadas</p>
      {ready.length > 0 && <div className="run-list">{ready.map((job) => <article key={job.id}><strong>{job.title}</strong><small>{job.company || job.source} · formulário localizado</small><div className="page-actions"><a className="btn-outline" href={job.url} target="_blank" rel="noreferrer">Abrir vaga</a><a className="btn-outline" href="/api/apply-assisted" target="_blank" rel="noreferrer">Baixar PDF</a></div></article>)}</div>}
      {needs.length > 0 && <div className="run-list">{needs.map((job) => <article key={job.id}><strong>{job.title}</strong><small>{reasons[job.reason || ""] || "Abra a vaga para concluir"}</small><div className="page-actions"><a className="btn-outline" href={job.url} target="_blank" rel="noreferrer">Abrir vaga</a><a className="btn-outline" href="/api/apply-assisted" target="_blank" rel="noreferrer">Baixar PDF</a><button className="btn-outline" disabled={busy} onClick={() => void command("manual_sent", { id: job.id })}>Já enviei</button></div></article>)}</div>}
      {data.telegramAvailable && <button className="btn-outline" disabled={busy} onClick={() => void command(data.linkedTelegram ? "telegram_disconnect" : "telegram")}>{data.linkedTelegram ? "Desligar Telegram" : "Receber avisos no Telegram"}</button>}
    </> : <p>Carregando a fila segura de formulários.</p>}
  </section>;
}
