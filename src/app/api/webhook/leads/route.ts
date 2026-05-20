import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const { apiKey, leads } = await req.json();

  if (apiKey !== process.env.BOT_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  for (const lead of leads) {
    await supabase.from("leads_google").insert({
      user_id: lead.user_id,
      empresa: lead.empresa,
      telefone: lead.telefone || null,
      site: lead.site || null,
      email: lead.email || null,
      cidade: lead.cidade || null,
      fonte: lead.fonte || null,
      tipo: lead.tipo || null,
    });
  }

  return NextResponse.json({ ok: true });
}
