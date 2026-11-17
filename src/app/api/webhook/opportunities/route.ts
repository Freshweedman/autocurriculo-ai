import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type DiscoveredOpportunity = { empresa?: string; vaga?: string; vaga_url?: string; local?: string; plataforma?: string };

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null) as { apiKey?: string; opportunities?: DiscoveredOpportunity[] } | null;
  if (!payload?.apiKey || payload.apiKey !== process.env.BOT_API_KEY) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      raw_data: { discovery: "assisted" },
    }];
  });
  if (!rows.length) return NextResponse.json({ ok: true, inserted: 0 });

  const { error } = await createAdminClient().from("opportunities").upsert(rows, { onConflict: "source,canonical_url" });
  if (error) return NextResponse.json({ error: "Não foi possível registrar oportunidades" }, { status: 500 });
  return NextResponse.json({ ok: true, inserted: rows.length });
}
