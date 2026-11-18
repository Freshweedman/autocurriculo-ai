import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = process.env.GITHUB_TOKEN;
  const repo  = "Freshweedman/autocurriculo-ai";

  if (!token) {
    return NextResponse.json({ error: "GITHUB_TOKEN nao configurado" }, { status: 500 });
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("direct_submission_enabled")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: "Não foi possível verificar as preferências da automação." }, { status: 500 });

  // Consent only authorizes adapters that can provide a platform confirmation.
  // The worker independently verifies every connection before it opens a form.
  const mode = profile?.direct_submission_enabled ? "direct_authorized" : "discovery";
  const staleBefore = new Date(Date.now() - 90 * 60_000).toISOString();
  const { data: staleRuns } = await admin
    .from("automation_runs")
    .update({ status: "cancelled", finished_at: new Date().toISOString(), error_message: "Execução expirada antes de o worker concluir." })
    .eq("user_id", user.id)
    .in("status", ["queued", "running"])
    .lt("created_at", staleBefore)
    .select("id");
  if (staleRuns?.length) await admin.from("automation_run_events").insert(staleRuns.map((stale) => ({ run_id: stale.id, user_id: user.id, event_type: "cancelled", message: "Execução expirada foi encerrada com segurança antes de iniciar uma nova." })));
  const { data: run, error: runError } = await admin
    .from("automation_runs")
    .insert({ user_id: user.id, trigger_type: "manual", status: "queued", summary: { mode } })
    .select("id")
    .single();
  if (runError || !run) return NextResponse.json({ error: "Não foi possível registrar a execução. Verifique se a migration 011 foi aplicada." }, { status: 500 });
  await admin.from("automation_run_events").insert({ run_id: run.id, user_id: user.id, event_type: "queued", message: "Execução solicitada pela pessoa usuária.", metadata: { mode } });

  const resp = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/bot.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main", inputs: { user_id: user.id, run_id: run.id } }),
    }
  );

  if (resp.status === 204) {
    const message = mode === "direct_authorized"
      ? "Envio autorizado iniciado. O worker só registra candidatura quando a plataforma apresentar uma confirmação verificável."
      : "Descoberta iniciada. O sistema vai buscar e classificar vagas, sem enviar currículos.";
    return NextResponse.json({ ok: true, runId: run.id, mode, message });
  }

  await admin.from("automation_runs").update({ status: "failed", finished_at: new Date().toISOString(), error_message: `GitHub Actions: ${resp.status}` }).eq("id", run.id);
  await admin.from("automation_run_events").insert({ run_id: run.id, user_id: user.id, event_type: "failed", message: "Não foi possível iniciar a automação no GitHub Actions.", metadata: { status: resp.status } });

  const body = await resp.text();
  if (resp.status === 422 && body.includes("disabled workflow")) {
    return NextResponse.json({
      error: "A automação está desativada no GitHub. Um administrador do repositório precisa abrir Actions → AutoCurriculo AI Bot → Enable workflow. Depois, tente novamente.",
      code: "WORKFLOW_DISABLED",
    }, { status: 503 });
  }
  return NextResponse.json({ error: `GitHub API: ${resp.status} ${body}` }, { status: 500 });
}
