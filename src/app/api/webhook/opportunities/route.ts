import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canonicalJobUrl } from "@/lib/job-url";
import webpush from "web-push";

type DiscoveredOpportunity = { empresa?: string; vaga?: string; vaga_url?: string; local?: string; plataforma?: string; compatibility_score?: number; match_reasons?: string[] };

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null) as { apiKey?: string; userId?: string; runId?: string; opportunities?: DiscoveredOpportunity[] } | null;
  if (!payload?.apiKey || payload.apiKey !== process.env.BOT_API_KEY) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!payload.userId) return NextResponse.json({ error: "Usuário da execução ausente" }, { status: 400 });
  if (!Array.isArray(payload.opportunities)) return NextResponse.json({ error: "Oportunidades inválidas" }, { status: 400 });

  const now = new Date().toISOString();
  const rows = payload.opportunities.flatMap((item) => {
    const canonicalUrl = canonicalJobUrl(item.vaga_url);
    if (!canonicalUrl || !item.vaga) return [];
    return [{
      source: item.plataforma || "public_source",
      source_job_id: canonicalUrl,
      canonical_url: canonicalUrl,
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
    const { data: newLinks, error: linkError } = await admin.from("user_opportunities").upsert(links, { onConflict: "user_id,opportunity_id", ignoreDuplicates: true }).select("opportunity_id");
    if (linkError) return NextResponse.json({ error: "Não foi possível vincular oportunidades ao usuário" }, { status: 500 });
    if (newLinks?.length && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT) {
      webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
      const { data: subscriptions } = await admin.from("web_push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", payload.userId);
      for (const subscription of subscriptions || []) {
        try { await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ title: `${newLinks.length} nova(s) vaga(s)`, body: "Há novas oportunidades compatíveis para revisar.", url: "/dashboard/automacao" })); }
        catch (error) { if ((error as { statusCode?: number }).statusCode === 404 || (error as { statusCode?: number }).statusCode === 410) await admin.from("web_push_subscriptions").delete().eq("id", subscription.id); }
      }
    }
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
