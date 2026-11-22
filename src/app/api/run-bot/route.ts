import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid, record, runnerError, runnerUser } from "@/lib/local-runner";

const active = ["queued", "running"];

export async function GET(request: Request) {
  const user = await runnerUser();
  if (!user) return runnerError("Sessão expirada.", 401);
  const admin = createAdminClient();
  const evidence = new URL(request.url).searchParams.get("evidence");
  if (evidence) {
    if (!isUuid(evidence)) return runnerError("Vaga inválida.");
    const { data } = await admin.from("local_runner_jobs").select("screenshot_path").eq("user_id", user.id).eq("id", evidence).maybeSingle();
    if (!data?.screenshot_path) return runnerError("Captura indisponível.", 404);
    const result = await admin.storage.from("runner-evidence").createSignedUrl(data.screenshot_path, 60);
    return result.data ? Response.redirect(result.data.signedUrl) : runnerError("Captura indisponível.", 404);
  }

  const [profile, runs, resumes, opportunities] = await Promise.all([
    admin.from("profiles").select("cargo,cidade,bot_ativo").eq("user_id", user.id).maybeSingle(),
    admin.from("automation_runs").select("id,status,trigger_type,created_at,finished_at,error_message").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(8),
    admin.from("resumes").select("id,name").eq("user_id", user.id).eq("is_default", true).maybeSingle(),
    admin.from("user_opportunities").select("opportunity_id", { count: "exact", head: true }).eq("user_id", user.id).neq("status", "dismissed"),
  ]);
  if (profile.error || runs.error || resumes.error || opportunities.error) return runnerError("Não foi possível carregar a busca.", 503);

  const oldestActive = Date.now() - 60 * 60_000;
  const displayRuns = runs.data?.map((run) => active.includes(run.status) && Date.parse(run.created_at) < oldestActive
    ? { ...run, status: "failed", error_message: "A busca excedeu o tempo de execução." } : run);
  const latest = displayRuns?.[0];
  const events = latest
    ? await admin.from("automation_run_events").select("id,message,created_at").eq("run_id", latest.id).eq("user_id", user.id).order("created_at").limit(30)
    : null;
  return Response.json({ profile: profile.data, runs: displayRuns, resume: resumes.data, opportunityCount: opportunities.count, events: events?.data ?? [] });
}

export async function POST(request: Request) {
  const user = await runnerUser();
  if (!user) return runnerError("Sessão expirada.", 401);
  const admin = createAdminClient();
  const body: unknown = request.headers.get("content-type")?.includes("application/json")
    ? await request.json().catch(() => null) : { action: "start" };
  if (!record(body)) return runnerError("Ação inválida.");

  const { data: profile, error } = await admin.from("profiles").select("cargo,bot_ativo").eq("user_id", user.id).maybeSingle();
  if (error) return runnerError("Não foi possível consultar seu perfil.", 503);
  if (body.action === "schedule" && typeof body.enabled === "boolean") {
    if (body.enabled && !profile?.cargo?.trim()) return runnerError("Adicione um cargo em Configurações antes de ativar a busca automática.", 409);
    const { error: updateError } = await admin.from("profiles").update({ bot_ativo: body.enabled }).eq("user_id", user.id);
    if (updateError) return runnerError("Não foi possível alterar a busca automática.", 503);
    return Response.json({ message: body.enabled ? "Busca automática ativada para dias úteis." : "Busca automática pausada." });
  }
  if (body.action !== "start") return runnerError("Ação inválida.");
  if (!profile?.cargo?.trim()) return runnerError("Adicione um cargo em Configurações antes de buscar.", 409);

  const token = process.env.GITHUB_TOKEN;
  if (!token) return runnerError("O serviço de busca está indisponível.", 503);
  const stale = new Date(Date.now() - 60 * 60_000).toISOString();
  const { error: recoverError } = await admin.from("automation_runs").update({
    status: "failed", finished_at: new Date().toISOString(), error_message: "A busca excedeu o tempo de execução.",
  }).eq("user_id", user.id).in("status", active).lt("created_at", stale);
  if (recoverError) return runnerError("Não foi possível verificar buscas anteriores.", 503);

  const { data: existing, error: lookupError } = await admin.from("automation_runs").select("id,status")
    .eq("user_id", user.id).gte("created_at", new Date(Date.now() - 90_000).toISOString()).neq("status", "failed").limit(1).maybeSingle();
  if (lookupError) return runnerError("Não foi possível verificar buscas anteriores.", 503);
  if (existing) return Response.json({ runId: existing.id, message: "Já há uma busca recente. Confira a atividade abaixo." });
  const { data: running, error: runningError } = await admin.from("automation_runs").select("id")
    .eq("user_id", user.id).in("status", active).limit(1).maybeSingle();
  if (runningError) return runnerError("Não foi possível verificar buscas anteriores.", 503);
  if (running) return Response.json({ runId: running.id, message: "Sua busca já está na fila ou em andamento." });

  const { data: run, error: runError } = await admin.from("automation_runs")
    .insert({ user_id: user.id, trigger_type: "manual", status: "queued", summary: { mode: "discovery" } }).select("id").single();
  if (runError || !run) return runnerError("Não foi possível registrar a busca.", 503);

  try {
    const dispatch = await fetch("https://api.github.com/repos/Freshweedman/autocurriculo-ai/actions/workflows/bot.yml/dispatches", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "main", inputs: { user_id: user.id, run_id: run.id } }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!dispatch.ok) throw Error(`GitHub Actions respondeu HTTP ${dispatch.status}.`);
    return Response.json({ runId: run.id, message: "Busca colocada na fila. Você pode sair da tela enquanto ela roda." });
  } catch (cause) {
    console.error("Falha ao solicitar busca", cause instanceof Error ? cause.message : cause);
    await admin.from("automation_runs").update({
      status: "failed", finished_at: new Date().toISOString(), error_message: "O serviço de busca não aceitou a execução.",
    }).eq("id", run.id).eq("user_id", user.id);
    return runnerError("A busca não pôde ser iniciada. Tente novamente.", 503);
  }
}
