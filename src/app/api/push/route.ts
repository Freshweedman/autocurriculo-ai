import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { record } from "@/lib/local-runner";

export async function GET() { return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null }); }
export async function POST(request: Request) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  if (!record(body) || !record(body.subscription) || typeof body.subscription.endpoint !== "string" || !record(body.subscription.keys) || typeof body.subscription.keys.p256dh !== "string" || typeof body.subscription.keys.auth !== "string") return NextResponse.json({ error: "Inscrição inválida." }, { status: 400 });
  const { error } = await supabase.from("web_push_subscriptions").upsert({ user_id: user.id, endpoint: body.subscription.endpoint, p256dh: body.subscription.keys.p256dh, auth: body.subscription.keys.auth, updated_at: new Date().toISOString() }, { onConflict: "user_id,endpoint" });
  return error ? NextResponse.json({ error: "Não foi possível ativar os avisos." }, { status: 503 }) : NextResponse.json({ ok: true });
}
export async function DELETE(request: Request) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null); if (!record(body) || typeof body.endpoint !== "string") return NextResponse.json({ error: "Inscrição inválida." }, { status: 400 });
  await supabase.from("web_push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", body.endpoint); return NextResponse.json({ ok: true });
}
