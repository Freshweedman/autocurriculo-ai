import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PLATFORM_KEYS = [
  "indeed", "linkedin", "infojobs", "catho", "sine",
  "workana", "getninjas", "freelas99",
] as const;


// GET /api/config — returns user config (never returns passwords)
export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const selectCols = [
    "cargo", "cidade", "limite_diario", "bot_ativo",
    ...PLATFORM_KEYS.map((k) => `${k}_email`),
  ].join(", ");

  const { data: profileRaw, error } = await supabase
    .from("profiles")
    .select(selectCols)
    .eq("user_id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = profileRaw as any;

  // Build plataformas object — only expose email (not password)
  const plataformas: Record<string, { configurado: boolean; email: string }> = {};
  for (const key of PLATFORM_KEYS) {
    const emailVal: string | null = profile?.[`${key}_email`] ?? null;
    plataformas[key] = { configurado: !!emailVal, email: emailVal || "" };
  }

  return NextResponse.json({
    cargo: profile?.cargo || "",
    cidade: profile?.cidade || "",
    limite_diario: profile?.limite_diario || 5,
    bot_ativo: profile?.bot_ativo || false,
    plataformas,
  });
}

// POST /api/config — saves profile + platform credentials
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const payload: Record<string, unknown> = { user_id: user.id };

  // Main config fields
  if (body.cargo        !== undefined) payload.cargo         = body.cargo;
  if (body.cidade       !== undefined) payload.cidade        = body.cidade;
  if (body.limite_diario !== undefined) payload.limite_diario = body.limite_diario;
  if (body.bot_ativo    !== undefined) payload.bot_ativo     = body.bot_ativo;

  // Platform credentials — accept email + senha for each platform
  for (const key of PLATFORM_KEYS) {
    const emailField = `${key}_email`;
    const senhaField = `${key}_senha`;
    if (body[emailField] !== undefined) payload[emailField] = body[emailField] || null;
    if (body[senhaField] !== undefined) payload[senhaField] = body[senhaField] || null;
  }

  const { error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
