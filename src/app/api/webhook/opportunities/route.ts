import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type DiscoveredOpportunity = { empresa?: string; vaga?: string; vaga_url?: string; local?: string; plataforma?: string; compatibility_score?: number; match_reasons?: string[] };

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null) as { apiKey?: string; userId?: string; runId?: string; opportunities?: DiscoveredOpportunity[] } | null;
  if (!payload?.apiKey || payload.apiKey !== process.env.BOT_API_KEY) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!payload.userId) return NextResponse.json({ error: "Usuário da execução ausente" }, { status: 400 });
  if (!Array.isArray(payload.opportunities)) return NextResponse.json({ error: "Oportunidades inválidas" }, { status: 400 });

  const now = new Date().toISOString();
  const rows = payload.opportunities.flatMap((item) => {
    if (!item.vaga_url || !item.vaga) return [];
    return [{
      source: item.plataforma || "public_source",
      source_job_id: item.vaga_url,
      canonical_url: item.vaga_url,
      title: item.vaga,
      company: item.empresa || null,
      location_text: item.local || null,
      status: "active",
      last_checked_at: now,
      raw_data: { discovery: "assisted", compatibility_score: item.compatibility_score ?? null, match_reasons: item.match_reasons ?? [] },
    }];
  });
  if (!rows.length) return NextResponse.json({ ok: true, inserted: 0 });

  const admin = createAdminClient();
  const { error } = await admin.from("opportunities").upsert(rows, { onConflict: "source,canonical_url" });
  if (error) return NextResponse.json({ error: "Não foi possível registrar oportunidades" }, { status: 500 });
  const urls = rows.map((row) => row.canonical_url);
  const { data: saved, error: lookupError } = await admin
    .from("opportunities")
    .select("id,canonical_url")
    .in("canonical_url", urls);
  if (lookupError) return NextResponse.json({ error: "Não foi possível vincular oportunidades ao usuário" }, { status: 500 });

  const byUrl = new Map((saved || []).map((item) => [item.canonical_url, item.id]));
  const links = rows.flatMap((row) => {
    const opportunityId = byUrl.get(row.canonical_url);
    return opportunityId ? [{ user_id: payload.userId!, opportunity_id: opportunityId, status: "found" }] : [];
  });
  if (links.length) {
    const { error: linkError } = await admin.from("user_opportunities").upsert(links, { onConflict: "user_id,opportunity_id", ignoreDuplicates: true });
    if (linkError) return NextResponse.json({ error: "Não foi possível vincular oportunidades ao usuário" }, { status: 500 });
  }

  if (payload.runId) {
    const items = rows.flatMap((row) => {
      const opportunityId = byUrl.get(row.canonical_url);
      return opportunityId ? [{ run_id: payload.runId!, user_id: payload.userId!, opportunity_id: opportunityId, source: row.source, canonical_url: row.canonical_url, title: row.title, company: row.company, status: "compatible", score: Number(row.raw_data.compatibility_score) || null, reason: row.raw_data }] : [];
    });
    if (items.length) await admin.from("automation_run_items").upsert(items, { onConflict: "run_id,canonical_url" });
  }
  return NextResponse.json({ ok: true, inserted: rows.length, linkedToUser: links.length });
}
