import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/config — returns user profile config (never returns passwords)
export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("cargo, cidade, limite_diario, bot_ativo, indeed_email, linkedin_email, infojobs_email")
    .eq("user_id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return which platforms have credentials configured (not the actual values)
  return NextResponse.json({
    cargo: profile?.cargo || "",
    cidade: profile?.cidade || "",
    limite_diario: profile?.limite_diario || 5,
    bot_ativo: profile?.bot_ativo || false,
    plataformas: {
      indeed:   { configurado: !!profile?.indeed_email,   email: profile?.indeed_email || "" },
      linkedin: { configurado: !!profile?.linkedin_email, email: profile?.linkedin_email || "" },
      infojobs: { configurado: !!profile?.infojobs_email, email: profile?.infojobs_email || "" },
    },
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

  // Build update payload — only include fields that were sent
  const payload: Record<string, unknown> = { user_id: user.id };

  if (body.cargo      !== undefined) payload.cargo         = body.cargo;
  if (body.cidade     !== undefined) payload.cidade        = body.cidade;
  if (body.limite_diario !== undefined) payload.limite_diario = body.limite_diario;
  if (body.bot_ativo  !== undefined) payload.bot_ativo     = body.bot_ativo;

  // Platform credentials — only update if provided
  if (body.indeed_email  !== undefined) payload.indeed_email  = body.indeed_email  || null;
  if (body.indeed_senha  !== undefined) payload.indeed_senha  = body.indeed_senha  || null;
  if (body.linkedin_email !== undefined) payload.linkedin_email = body.linkedin_email || null;
  if (body.linkedin_senha !== undefined) payload.linkedin_senha = body.linkedin_senha || null;
  if (body.infojobs_email !== undefined) payload.infojobs_email = body.infojobs_email || null;
  if (body.infojobs_senha !== undefined) payload.infojobs_senha = body.infojobs_senha || null;

  const { error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
