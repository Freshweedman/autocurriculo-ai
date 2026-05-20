import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const { apiKey, applications } = await req.json();

  if (apiKey !== process.env.BOT_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const results: { id: string; empresa: string; status: string }[] = [];

  for (const app of applications) {
    // Verificar duplicacao (mesma empresa + vaga nos ultimos 30 dias)
    const trintaDiasAtras = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: existente } = await supabase
      .from("applications")
      .select("id")
      .eq("user_id", app.user_id)
      .eq("empresa", app.empresa)
      .eq("vaga", app.vaga)
      .gte("created_at", trintaDiasAtras)
      .limit(1);

    if (existente && existente.length > 0) {
      results.push({ id: "", empresa: app.empresa, status: "duplicado" });

      await supabase.from("applications").insert({
        user_id: app.user_id,
        empresa: app.empresa,
        vaga: app.vaga,
        plataforma: app.plataforma,
        status: "duplicado",
      });
      continue;
    }

    const { data: inserted, error } = await supabase
      .from("applications")
      .insert({
        user_id: app.user_id,
        empresa: app.empresa,
        vaga: app.vaga,
        vaga_url: app.vaga_url || null,
        plataforma: app.plataforma,
        status: app.status,
      })
      .select()
      .single();

    if (error) {
      results.push({ id: "", empresa: app.empresa, status: "falhou" });
    } else {
      results.push({
        id: inserted?.id || "",
        empresa: app.empresa,
        status: "enviado",
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}
