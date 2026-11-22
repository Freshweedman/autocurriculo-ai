"use client";

import { useCallback, useEffect, useState } from "react";

type Job = { id: string; title: string; company: string | null; source: string; url: string; status: string; reason: string | null; updated_at: string };
type Data = { queue: Job[]; linkedTelegram: boolean; telegramAvailable: boolean; live: boolean };
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
    <p>Somente formulários públicos sem login. Você aprova cada lote antes do envio. Confirmações incluem prova privada.</p>
    {note && <p className="notice" role="status">{note}</p>}
    {data ? <>
      <p><strong>{ready.length}</strong> prontas · <strong>{needs.length}</strong> precisam de você · <strong>{data.queue.filter((job) => job.status === "confirmed").length}</strong> confirmadas</p>
      {ready.length > 0 && <div className="run-list">{ready.map((job) => <label key={job.id}><input type="checkbox" checked={selected.includes(job.id)} disabled={busy || (!selected.includes(job.id) && selected.length >= 10)} onChange={() => setSelected((ids) => ids.includes(job.id) ? ids.filter((id) => id !== job.id) : [...ids, job.id])} /> <strong>{job.title}</strong> <small>{job.company || job.source}</small></label>)}</div>}
      {selected.length > 0 && <div className="page-actions"><button className="btn-outline" disabled={busy} onClick={() => void command("approve", { ids: selected })}>Aprovar {selected.length} por 24 horas</button>{data.live && <button className="btn-primary" disabled={busy} onClick={() => void command("apply")}>Enviar lote aprovado</button>}</div>}
      {needs.length > 0 && <div className="run-list">{needs.map((job) => <article key={job.id}><strong>{job.title}</strong><small>{reasons[job.reason || ""] || "Abra a vaga para concluir"}</small><a href={job.url} target="_blank" rel="noreferrer">Preparar candidatura</a></article>)}</div>}
      {data.telegramAvailable && <button className="btn-outline" disabled={busy} onClick={() => void command(data.linkedTelegram ? "telegram_disconnect" : "telegram")}>{data.linkedTelegram ? "Desligar Telegram" : "Receber avisos no Telegram"}</button>}
    </> : <p>Carregando a fila segura de formulários.</p>}
  </section>;
}
