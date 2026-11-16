import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_MARKETPLACE_CHANNELS } from "@/lib/marketplace-channels";
import { getAuthenticatedAdmin } from "@/lib/admin";

async function ensureDefaultChannels(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: existing, error } = await supabase
    .from("channels")
    .select("*")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  const byType = new Map((existing || []).map((channel) => [channel.type, channel]));
  const missing = DEFAULT_MARKETPLACE_CHANNELS
    .filter((channel) => !byType.has(channel.type))
    .map((channel) => ({ ...channel, user_id: userId }));

  if (missing.length) {
    const { error: insertError } = await supabase.from("channels").insert(missing);
    if (insertError) throw new Error(insertError.message);
  }

  for (const preset of DEFAULT_MARKETPLACE_CHANNELS) {
    const current = byType.get(preset.type);
    if (!current) continue;

    const needsUpdate =
      current.name !== preset.name ||
      current.platform !== preset.platform ||
      current.url !== preset.url ||
      current.publication_mode !== preset.publication_mode ||
      current.notes !== preset.notes;

    if (!needsUpdate) continue;

    const { error: updateError } = await supabase
      .from("channels")
      .update({
        name: preset.name,
        platform: preset.platform,
        url: preset.url,
        publication_mode: preset.publication_mode,
        notes: preset.notes,
      })
      .eq("user_id", userId)
      .eq("type", preset.type);

    if (updateError) throw new Error(updateError.message);
  }
}

export async function GET() {
  const supabase = await createClient();
  const { user, status } = await getAuthenticatedAdmin(supabase);
  if (!user) return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Admin access required" }, { status: status! });
  try {
    await ensureDefaultChannels(supabase, user.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar canais padrão";
    return NextResponse.json({ error: message }, { status: 500 });
  }
  const { data, error } = await supabase.from("channels").select("*").eq("user_id", user.id).order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ channels: data || [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { user, status } = await getAuthenticatedAdmin(supabase);
  if (!user) return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Admin access required" }, { status: status! });
  const body = await req.json();
  const { id, ...fields } = body;
  const payload = { ...fields, user_id: user.id };
  let result;
  if (id) {
    result = await supabase.from("channels").update(payload).eq("id", id).eq("user_id", user.id).select().single();
  } else {
    result = await supabase.from("channels").insert(payload).select().single();
  }
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, channel: result.data });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { user, status } = await getAuthenticatedAdmin(supabase);
  if (!user) return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Admin access required" }, { status: status! });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabase.from("channels").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
