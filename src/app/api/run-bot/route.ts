import { randomBytes, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { digest, isUuid, record, runnerColumns, runnerError, runnerUser } from "@/lib/local-runner";

export async function GET(request: Request) {
  const user = await runnerUser();
  if (!user) return runnerError("Sessão expirada.", 401);
  const admin = createAdminClient();
  const evidence = new URL(request.url).searchParams.get("evidence");
  if (evidence) {
    if (!isUuid(evidence)) return runnerError("Vaga inválida.");
    const { data } = await admin.from("local_runner_jobs").select("screenshot_path")
      .eq("user_id", user.id).eq("id", evidence).maybeSingle();
    if (!data?.screenshot_path) return runnerError("Captura indisponível.", 404);
    const result = await admin.storage.from("runner-evidence").createSignedUrl(data.screenshot_path, 60);
    return result.data ? Response.redirect(result.data.signedUrl) : runnerError("Captura indisponível.", 404);
  }
  const results = await Promise.all([
    admin.from("local_runner_control").select(runnerColumns).eq("user_id", user.id).maybeSingle(),
    admin.from("local_runner_jobs").select("id,platform,url,title,company,status,detail,score,confirmation_text,confirmation_url,screenshot_path,updated_at")
      .eq("user_id", user.id).order("updated_at", { ascending: false }).limit(30),
    admin.from("local_runner_jobs").select("id,platform,url,title,company,status,detail")
      .eq("user_id", user.id).in("status", ["needs_login", "needs_review", "applied_unconfirmed"]).order("updated_at", { ascending: false }).limit(30),
    admin.from("local_runner_events").select("id,platform,message,created_at")
      .eq("user_id", user.id).order("id", { ascending: false }).limit(40),
    admin.rpc("local_runner_metrics", { p_user: user.id }),
    admin.from("resumes").select("id,name,is_default").eq("user_id", user.id).order("is_default", { ascending: false }),
  ]);
  if (results.some(({ error }) => error)) return runnerError("Dados do runner indisponíveis. Verifique a migration 012.", 503);
  const [control, jobs, review, events, metrics, resumes] = results.map(({ data }) => data);
  const station = control as { last_seen_at: string | null } | null;
  const online = Boolean(station?.last_seen_at && Date.now() - new Date(station.last_seen_at).getTime() < 90_000);
  return Response.json({ control, online, jobs, review, events, metrics, resumes });
}

export async function POST(request: Request) {
  const user = await runnerUser();
  if (!user) return runnerError("Sessão expirada.", 401);
  const admin = createAdminClient();
  const body: unknown = request.headers.get("content-type")?.includes("application/json")
    ? await request.json().catch(() => null) : { action: "start" };
  if (!record(body)) return runnerError("Ação inválida.");
  const action = body.action;
  const user_id = user.id;
  if (action === "pair") {
    const token = randomBytes(32).toString("hex");
    const { error } = await admin.from("local_runner_control").upsert({
      user_id, token_hash: digest(token), enabled: false, instance_id: null, last_seen_at: null, generation: randomUUID(),
    }, { onConflict: "user_id" });
    return error ? runnerError("Não foi possível vincular o runner. Verifique a migration 012.", 503) : Response.json({ token });
  }
  if (action === "retry") {
    if (!isUuid(body.id)) return runnerError("Vaga inválida.");
    const { data, error } = await admin.from("local_runner_jobs").update({
      status: "queued", updated_at: new Date().toISOString(), detail: "Aguardando a próxima busca do runner.",
    }).eq("user_id", user_id).eq("id", body.id).in("status", ["needs_review", "needs_login", "failed"])
      .is("attempt_at", null).select("id").maybeSingle();
    if (error || !data) return runnerError("Esta vaga não pode voltar à fila.", 409);
    return Response.json({ message: "Vaga recolocada na fila." });
  }
  if (action === "settings") {
    const limits = body.limits;
    const answers = body.answers;
    const resume = body.resume;
    if (!record(limits) || !record(answers) || Object.keys(limits).length > 15 || Object.keys(answers).length > 50
      || Object.entries(limits).some(([key, value]) => key.length > 50 || typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 40)
      || Object.entries(answers).some(([key, value]) => key.length > 300 || typeof value !== "string" || value.length > 1000)
      || (resume !== null && !isUuid(resume))) return runnerError("Confira limites de 1 a 40, respostas e currículo.");
    if (resume !== null) {
      const { data } = await admin.from("resumes").select("id").eq("user_id", user_id).eq("id", resume).maybeSingle();
      if (!data) return runnerError("Currículo indisponível.");
    }
    const { error } = await admin.from("local_runner_control").upsert({
      user_id, platform_limits: limits, screening_answers: answers, resume_id: resume,
    }, { onConflict: "user_id" });
    return error ? runnerError("Não foi possível salvar as configurações.", 503) : Response.json({ message: "Configurações salvas." });
  }
  if (action !== "start" && action !== "stop") return runnerError("Ação inválida.");
  const enabled = action === "start";
  const { data, error } = await admin.from("local_runner_control")
    .update({ enabled, generation: randomUUID() }).eq("user_id", user_id).eq("enabled", !enabled)
    .not("token_hash", "is", null).select("user_id").maybeSingle();
  if (error) return runnerError("Não foi possível atualizar o runner. Verifique a migration 012.", 503);
  if (!data) {
    const existing = await admin.from("local_runner_control").select("enabled").eq("user_id", user_id).not("token_hash", "is", null).maybeSingle();
    if (!existing.data) return runnerError("Vincule o runner na Central de Automação antes de iniciar.", 409);
  } else {
    await admin.from("local_runner_events").insert({ user_id, message: enabled ? "START solicitado pelo painel." : "STOP solicitado pelo painel." });
  }
  return Response.json({ enabled, ok: true, message: enabled ? "START registrado. O runner local recebe o comando na próxima consulta." : "STOP registrado." });
}
