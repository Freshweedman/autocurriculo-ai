import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin";
import { collectPublicOpportunities, type OpportunitySource } from "@/lib/opportunity-ingestion";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { user, status } = await getAuthenticatedAdmin(supabase);
  if (!user) return NextResponse.json({ error: status === 401 ? "Não autenticado" : "Acesso administrativo necessário" }, { status: status || 403 });
  const body = await request.json().catch(() => ({}));
  const sourceId = typeof body.sourceId === "string" ? body.sourceId : null;
  let query = supabase.from("opportunity_sources").select("id,provider,identifier,company_name").eq("enabled", true);
  if (sourceId) query = query.eq("id", sourceId);
  const { data: sources, error } = await query;
  if (error) return NextResponse.json({ error: "As fontes estarão disponíveis após a migration 009." }, { status: 400 });
  const results: Array<{ sourceId: string; discovered: number; inserted: number; error?: string }> = [];
  for (const source of (sources || []) as OpportunitySource[]) {
    const { data: run } = await supabase.from("opportunity_ingestion_runs").insert({ source_id: source.id, provider: source.provider, status: "running" }).select("id").single();
    try {
      const jobs = await collectPublicOpportunities(source);
      const { error: upsertError } = jobs.length ? await supabase.from("opportunities").upsert(jobs, { onConflict: "source,canonical_url" }) : { error: null };
      if (upsertError) throw upsertError;
      await supabase.from("opportunity_sources").update({ last_synced_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq("id", source.id);
      if (run?.id) await supabase.from("opportunity_ingestion_runs").update({ status: "succeeded", discovered_count: jobs.length, inserted_count: jobs.length, finished_at: new Date().toISOString() }).eq("id", run.id);
      results.push({ sourceId: source.id, discovered: jobs.length, inserted: jobs.length });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Falha desconhecida";
      await supabase.from("opportunity_sources").update({ last_error: message, updated_at: new Date().toISOString() }).eq("id", source.id);
      if (run?.id) await supabase.from("opportunity_ingestion_runs").update({ status: "failed", error_message: message, finished_at: new Date().toISOString() }).eq("id", run.id);
      results.push({ sourceId: source.id, discovered: 0, inserted: 0, error: message });
    }
  }
  return NextResponse.json({ ok: true, results });
}
