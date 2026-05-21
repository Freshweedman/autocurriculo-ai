import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = process.env.GITHUB_TOKEN;
  const repo  = "Freshweedman/autocurriculo-ai";

  if (!token) {
    return NextResponse.json({ error: "GITHUB_TOKEN nao configurado" }, { status: 500 });
  }

  const resp = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/bot.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
    }
  );

  if (resp.status === 204) {
    return NextResponse.json({ ok: true, message: "Bot iniciado! Aguarde ~2 minutos." });
  }

  const body = await resp.text();
  return NextResponse.json({ error: `GitHub API: ${resp.status} ${body}` }, { status: 500 });
}
