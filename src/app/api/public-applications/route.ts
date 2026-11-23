import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid, record, runnerError, runnerUser } from "@/lib/local-runner";
import { opaqueLane, PUBLIC_MODES } from "@/lib/public-applications";

export async function GET(request: Request) {
  const user = await runnerUser();
  if (!user) return runnerError("Sessão expirada.", 401);
  const admin = createAdminClient();
  const actionsToken = process.env.ACTIONS_PUBLIC_APPLICATION_TOKEN?.trim() || "";
  const workerSecret = process.env.ACTIONS_PUBLIC_APPLICATION_WORKER_SECRET?.trim() || "";
  const configReason = !actionsToken ? "token ausente" : !actionsToken.startsWith("github_pat_") ? "token não é fine-grained" : workerSecret.length < 32 ? "segredo do worker ausente ou curto" : "válida";
  const requested = new URL(request.url).searchParams.get("proof");
  if (requested) {
    if (!isUuid(requested)) return runnerError("Prova inválida.");
    const { data } = await admin.from("public_application_queue").select("proof_path").eq("id", requested).eq("user_id", user.id).eq("status", "confirmed").maybeSingle();
    if (!data?.proof_path) return runnerError("Prova indisponível.", 404);
    const signed = await admin.storage.from("runner-evidence").createSignedUrl(data.proof_path, 60);
    return signed.data ? Response.redirect(signed.data.signedUrl) : runnerError("Prova indisponível.", 503);
  }
  const [queue, runs, telegram, answers] = await Promise.all([
    admin.from("public_application_queue").select("id,opportunity_id,title,company,source,url,status,reason,proof_path,updated_at").eq("user_id", user.id)
      .order("updated_at", { ascending: false }).limit(60),
    admin.from("automation_runs").select("id,status,created_at,summary,error_message").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(20),
    admin.from("public_application_telegram").select("chat_id").eq("user_id", user.id).maybeSingle(),
    admin.from("public_application_answers").select("answers").eq("user_id", user.id).maybeSingle(),
  ]);
  if (queue.error || runs.error || telegram.error || answers.error) return runnerError("A fila de formulários ainda não está disponível.", 503);
  return NextResponse.json({
    queue: queue.data, runs: (runs.data || []).filter((run) => PUBLIC_MODES.includes(String(run.summary?.mode))).slice(0, 2), answers: answers.data?.answers || {}, linkedTelegram: Boolean(telegram.data?.chat_id),
    telegramAvailable: Boolean(process.env.PUBLIC_TELEGRAM_BOT_USERNAME && process.env.PUBLIC_TELEGRAM_BOT_TOKEN), configReason,
    live: process.env.PUBLIC_APPLY_LIVE === "enabled",
  });
}

export async function POST(request: Request) {
  const user = await runnerUser();
  if (!user) return runnerError("Sessão expirada.", 401);
  const body: unknown = await request.json().catch(() => null);
  if (!record(body)) return runnerError("Ação inválida.");
  const admin = createAdminClient();
  if (body.action === "answers") {
    const answers = body.answers;
    if (!record(answers) || Object.keys(answers).length > 30 || Object.entries(answers).some(([label, value]) =>
      !label.trim() || label.length > 240 || typeof value !== "string" || !value.trim() || value.length > 500))
      return runnerError("Preencha perguntas e respostas válidas.");
    const { error } = await admin.from("public_application_answers").upsert({ user_id: user.id, answers });
    return error ? runnerError("Não foi possível salvar as respostas.", 503) : Response.json({ message: "Respostas salvas." });
  }
  if (body.action === "telegram") {
    const bot = process.env.PUBLIC_TELEGRAM_BOT_USERNAME;
    if (!bot || !/^\w{5,32}$/.test(bot) || !process.env.PUBLIC_TELEGRAM_BOT_TOKEN) return runnerError("Telegram indisponível.", 503);
    const value = randomBytes(24).toString("base64url");
    const hash = createHash("sha256").update(value).digest("hex");
    const { error } = await admin.from("public_application_telegram").upsert({
      user_id: user.id, pair_hash: hash, expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    return error ? runnerError("Não foi possível gerar o vínculo.", 503) : Response.json({ url: `https://t.me/${bot}?start=${value}` });
  }
  if (body.action === "telegram_disconnect") {
    const { error } = await admin.from("public_application_telegram").delete().eq("user_id", user.id);
    return error ? runnerError("Não foi possível desligar o Telegram.", 503) : Response.json({ message: "Telegram desligado." });
  }
  if (body.action === "approve") {
    if (!Array.isArray(body.ids) || !body.ids.length || body.ids.length > 10 || !body.ids.every(isUuid)) return runnerError("Selecione de 1 a 10 vagas.");
    const { data, error } = await admin.rpc("public_apply_approve", { p_user: user.id, p_jobs: [...new Set(body.ids)] });
    if (error || !data) return runnerError("Selecione um PDF padrão e vagas verificadas recentemente.", 409);
    return Response.json({ message: `${data} vaga(s) aprovada(s) por 24 horas.` });
  }
  if (body.action === "manual_sent") {
    if (!isUuid(body.id)) return runnerError("Vaga inválida.");
    const { data, error } = await admin.from("public_application_queue").select("id,opportunity_id").eq("id", body.id).eq("user_id", user.id).in("status", ["needs_action", "unconfirmed"]).maybeSingle();
    if (error || !data?.opportunity_id) return runnerError("Vaga indisponível.", 404);
    const { data: resume } = await admin.from("resumes").select("id").eq("user_id", user.id).eq("is_default", true).maybeSingle();
    const { data: opportunity } = await admin.from("opportunities").select("id,title,company,source,canonical_url").eq("id", data.opportunity_id).maybeSingle();
    if (!opportunity) return runnerError("Vaga indisponível.", 404);
    const { error: insertError } = await admin.from("applications").insert({ user_id: user.id, opportunity_id: opportunity.id, resume_id: resume?.id || null, vaga: opportunity.title, empresa: opportunity.company, plataforma: opportunity.source, vaga_url: opportunity.canonical_url, status: "submitted_manual", sent_at: new Date().toISOString(), notes: "Envio informado pela pessoa candidata." });
    if (insertError && insertError.code !== "23505") return runnerError("Não foi possível registrar o envio.", 503);
    await admin.from("public_application_queue").update({ status: "needs_action", reason: "manual_sent", updated_at: new Date().toISOString() }).eq("id", data.id).eq("user_id", user.id);
    return Response.json({ message: "Marcado como já enviado. Não conta como envio confirmado automaticamente." });
  }
  if (body.action !== "inspect" && body.action !== "apply") return runnerError("Ação inválida.");

  const live = body.action === "apply";
  if (live && process.env.PUBLIC_APPLY_LIVE !== "enabled") return runnerError("O envio real está desligado neste ambiente.", 409);
  const token = process.env.ACTIONS_PUBLIC_APPLICATION_TOKEN?.trim();
  const secret = process.env.ACTIONS_PUBLIC_APPLICATION_WORKER_SECRET?.trim();
  if (!token?.startsWith("github_pat_") || !secret || secret.length < 32)
    return runnerError("Configuração inválida: token fine-grained ou segredo do worker ausente.", 503);
  if (!live) {
    const sync = await admin.rpc("public_apply_sync", { p_user: user.id });
    if (sync.error) return runnerError("Não foi possível atualizar a fila de vagas.", 503);
  } else {
    const count = await admin.from("public_application_queue").select("id", { count: "exact", head: true }).eq("user_id", user.id)
      .eq("status", "approved").gte("approved_at", new Date(Date.now() - 86400000).toISOString());
    if (count.error || !count.count) return runnerError("Aprove uma vaga verificada antes de enviar.", 409);
  }
  const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();
  const possibleStale = await admin.from("automation_runs").select("id,summary").eq("user_id", user.id).in("status", ["queued", "running"]).lt("created_at", cutoff);
  if (possibleStale.error) return runnerError("Não foi possível conferir execuções anteriores.", 503);
  const staleIds = (possibleStale.data || []).filter((item) => PUBLIC_MODES.includes(String(item.summary?.mode))).map((item) => item.id);
  if (staleIds.length) {
    const stale = await admin.from("automation_runs").update({ status: "failed", error_message: "A execução anterior perdeu o prazo.", finished_at: new Date().toISOString() }).in("id", staleIds);
    if (stale.error) return runnerError("Não foi possível encerrar a execução anterior.", 503);
    const ids = staleIds;
    await admin.from("public_application_queue").update({ status: "unconfirmed", reason: "interrupted" }).eq("user_id", user.id).in("run_id", ids).eq("status", "applying");
    await admin.from("public_application_queue").update({ status: "needs_action", reason: "interrupted" }).eq("user_id", user.id).in("run_id", ids).eq("status", "checking");
  }
  const mode = live ? "public_form_apply" : "public_form_inspect";
  const { data: run, error } = await admin.from("automation_runs").insert({
    user_id: user.id, status: "queued", trigger_type: "manual", summary: { mode },
  }).select("id").single();
  if (error?.code === "23505") return runnerError("Já existe um lote de formulários para esta conta.", 409);
  if (error || !run) return runnerError("Não foi possível criar a execução.", 503);
  try {
    const result = await fetch("https://api.github.com/repos/Freshweedman/autocurriculo-ai/actions/workflows/public-apply.yml/dispatches", {
      method: "POST", headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "main", inputs: { run_id: run.id, lane: opaqueLane(user.id, secret) } }), signal: AbortSignal.timeout(10_000),
    });
    if (!result.ok) throw Error();
    return Response.json({ runId: run.id, message: "Lote colocado na fila do GitHub Actions." });
  } catch {
    await admin.from("automation_runs").update({ status: "failed", error_message: "O GitHub recusou ou não confirmou a execução.", finished_at: new Date().toISOString() })
      .eq("id", run.id).eq("status", "queued");
    return runnerError("Não foi possível disparar o lote.", 503);
  }
}
