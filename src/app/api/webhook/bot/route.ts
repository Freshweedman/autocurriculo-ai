import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const { apiKey, applications } = await req.json();

  if (apiKey !== process.env.BOT_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const results: { id: string; empresa: string; status: string }[] = [];
  const seteDiasAtras = new Date(Date.now() - 7 * 86400000).toISOString();

  for (const app of applications) {
    try {
      // Dedup strategy:
      // 1. If vaga_url is present, use it as the unique key (most accurate)
      // 2. Fallback: empresa + plataforma + same day (prevents spam runs)
      let isDuplicate = false;

      if (app.vaga_url) {
        const { data: existente } = await supabase
          .from("applications")
          .select("id")
          .eq("user_id", app.user_id)
          .eq("vaga_url", app.vaga_url)
          .gte("created_at", seteDiasAtras)
          .limit(1);
        isDuplicate = !!(existente && existente.length > 0);
      } else {
        // Fallback: same empresa+vaga on same day
        const hoje = new Date().toISOString().split("T")[0];
        const { data: existente } = await supabase
          .from("applications")
          .select("id")
          .eq("user_id", app.user_id)
          .eq("empresa", app.empresa)
          .eq("plataforma", app.plataforma)
          .gte("created_at", hoje)
          .limit(1);
        isDuplicate = !!(existente && existente.length > 0);
      }

      if (isDuplicate) {
        // Don't insert duplicate records — just count them silently
        results.push({ id: "", empresa: app.empresa, status: "duplicado" });
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
          status: app.status,
        });
      }
    } catch {
      results.push({ id: "", empresa: app.empresa || "unknown", status: "falhou" });
    }
  }

  const enviados = results.filter((r) => r.status === "enviado").length;
  const duplicados = results.filter((r) => r.status === "duplicado").length;

  return NextResponse.json({ ok: true, results, summary: { enviados, duplicados, total: results.length } });
}
