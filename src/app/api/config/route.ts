import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PLATFORM_KEYS = [
  "indeed", "linkedin", "infojobs", "catho", "sine",
  "workana", "getninjas", "freelas99",
] as const;


// GET /api/config — returns user config (never returns passwords)
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const selectCols = [
    "cargo", "cidade", "limite_diario", "bot_ativo",
    ...PLATFORM_KEYS.map((k) => `${k}_email`),
  ].join(", ");

  const [{ data: profileRaw, error }, { data: connections, error: connectionError }] = await Promise.all([
    supabase.from("profiles").select(selectCols).eq("user_id", user.id).single(),
    supabase.from("platform_connection_status").select("platform, status, account_hint"),
  ]);

  if (error || connectionError) {
    return NextResponse.json({ error: error?.message || connectionError?.message }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = profileRaw as any;

  // Build plataformas object — only expose email (not password)
  const plataformas: Record<string, { configurado: boolean; email: string }> = {};
  for (const key of PLATFORM_KEYS) {
    const connection = (connections || []).find((item) => item.platform === key);
    const emailVal: string | null = connection?.account_hint ?? profile?.[`${key}_email`] ?? null;
    plataformas[key] = { configurado: connection?.status === "connected", email: emailVal || "" };
  }

  return NextResponse.json({
    cargo: profile?.cargo || "",
    cidade: profile?.cidade || "",
    limite_diario: profile?.limite_diario || 5,
    bot_ativo: profile?.bot_ativo || false,
    plataformas,
  });
}

// POST /api/config — saves preferences only. Connection secrets go through /api/connections.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
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

  // Legacy account hints remain readable during migration; plaintext passwords are rejected.
  for (const key of PLATFORM_KEYS) {
    const emailField = `${key}_email`;
    const senhaField = `${key}_senha`;
    if (body[emailField] !== undefined) payload[emailField] = body[emailField] || null;
    if (body[senhaField] !== undefined) {
      return NextResponse.json({ error: "Platform secrets must be saved through the secure connections endpoint." }, { status: 400 });
    }
  }

  const { error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
