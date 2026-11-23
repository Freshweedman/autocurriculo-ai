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
    "cargo", "cidade", "limite_diario", "bot_ativo", "direct_submission_enabled", "seniority_level", "public_apply_daily_limit",
    ...PLATFORM_KEYS.map((k) => `${k}_email`),
  ].join(", ");

  const [{ data: profileRaw, error }, { data: connections, error: connectionError }, { data: professional }, { data: searchProfile }] = await Promise.all([
    supabase.from("profiles").select(selectCols).eq("user_id", user.id).single(),
    supabase.from("platform_connection_status").select("platform, status, account_hint"),
    supabase.from("professional_profiles").select("full_name,phone,summary,country_code,city,state").eq("user_id", user.id).maybeSingle(),
    supabase.from("search_profiles").select("id,remote_only,international_only,work_modes,contract_types").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle(),
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
    seniority_level: profile?.seniority_level || "pleno",
    public_apply_daily_limit: profile?.public_apply_daily_limit || 20,
    direct_submission_enabled: profile?.direct_submission_enabled || false,
    applicant: { full_name: professional?.full_name || "", phone: professional?.phone || "", summary: professional?.summary || "" },
    discovery_preferences: { country_code: professional?.country_code || "BR", city: professional?.city || profile?.cidade || "", state: professional?.state || "", remote_only: searchProfile?.remote_only || false, international_only: searchProfile?.international_only || false, work_modes: searchProfile?.work_modes || [], contract_types: searchProfile?.contract_types || [] },
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
  if (body.seniority_level !== undefined && ["junior", "pleno", "senior"].includes(body.seniority_level)) payload.seniority_level = body.seniority_level;
  if (Number.isInteger(body.public_apply_daily_limit)) payload.public_apply_daily_limit = Math.min(20, Math.max(1, body.public_apply_daily_limit));
  if (body.direct_submission_enabled !== undefined) payload.direct_submission_enabled = body.direct_submission_enabled === true;

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

  if (body.discovery_preferences || body.applicant) {
    const preferences = body.discovery_preferences as { country_code?: string; city?: string; state?: string; remote_only?: boolean; international_only?: boolean };
    const applicant = (body.applicant || {}) as { full_name?: string; phone?: string; summary?: string };
    const { error: professionalError } = await supabase.from("professional_profiles").upsert({ user_id: user.id, full_name: applicant.full_name?.trim() || null, phone: applicant.phone?.trim() || null, summary: applicant.summary?.trim() || null, country_code: preferences?.country_code || "BR", city: preferences?.city || null, state: preferences?.state || null, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (professionalError) return NextResponse.json({ error: professionalError.message }, { status: 500 });
    const { data: existing } = await supabase.from("search_profiles").select("id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
    const searchPayload = { user_id: user.id, name: "Busca principal", keywords: String(body.cargo || "").split(/[,;\n]/).map((item: string) => item.trim()).filter(Boolean), remote_only: preferences?.remote_only === true, international_only: preferences?.international_only === true, active: true, updated_at: new Date().toISOString() };
    const { error: searchError } = existing?.id
      ? await supabase.from("search_profiles").update(searchPayload).eq("id", existing.id)
      : await supabase.from("search_profiles").insert(searchPayload);
    if (searchError) return NextResponse.json({ error: searchError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
