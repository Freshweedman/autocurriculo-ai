import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const eventTypes = new Set(["started", "source_started", "source_finished", "opportunity_found", "opportunity_filtered", "application_pending", "application_confirmed", "login_required", "failed", "completed", "cancelled"]);

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { apiKey?: string; runId?: string; userId?: string; eventType?: string; message?: string; metadata?: Record<string, unknown>; runStatus?: "running" | "succeeded" | "failed" | "cancelled" } | null;
  if (!body?.apiKey || body.apiKey !== process.env.BOT_API_KEY) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!body.userId || !body.eventType || !eventTypes.has(body.eventType) || !body.message) return NextResponse.json({ error: "Evento de automação inválido" }, { status: 400 });

  const admin = createAdminClient();
  let runId = body.runId;
  if (!runId && body.eventType === "started") {
    const { data: created, error: createError } = await admin.from("automation_runs").insert({ user_id: body.userId, trigger_type: "scheduled", status: "queued", summary: { mode: "discovery" } }).select("id").single();
    if (createError || !created) return NextResponse.json({ error: "Não foi possível criar a execução agendada" }, { status: 500 });
    runId = created.id;
  }
  if (!runId) return NextResponse.json({ error: "Execução ausente" }, { status: 400 });
  const { data: run } = await admin.from("automation_runs").select("id,user_id").eq("id", runId).eq("user_id", body.userId).maybeSingle();
  if (!run) return NextResponse.json({ error: "Execução não encontrada" }, { status: 404 });

  const { error: eventError } = await admin.from("automation_run_events").insert({
    run_id: runId, user_id: body.userId, event_type: body.eventType, message: body.message.slice(0, 500), metadata: body.metadata || {},
  });
  if (eventError) return NextResponse.json({ error: "Não foi possível registrar o evento" }, { status: 500 });
  if (body.runStatus) {
    const updates: Record<string, unknown> = { status: body.runStatus };
    if (body.runStatus === "running") updates.started_at = new Date().toISOString();
    if (["succeeded", "failed", "cancelled"].includes(body.runStatus)) updates.finished_at = new Date().toISOString();
    await admin.from("automation_runs").update(updates).eq("id", runId).eq("user_id", body.userId);
  }
  return NextResponse.json({ ok: true, runId });
}
