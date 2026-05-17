import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export async function POST(req: NextRequest) {
  const { apiKey, leads } = await req.json();

  if (apiKey !== process.env.BOT_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  for (const lead of leads) {
    await supabase.from("leads_google").insert({
      user_id: lead.user_id,
      empresa: lead.empresa,
      telefone: lead.telefone || null,
      site: lead.site || null,
      email: lead.email || null,
      cidade: lead.cidade || null,
    });
  }

  return NextResponse.json({ ok: true });
}
