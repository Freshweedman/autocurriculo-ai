import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
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
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main", inputs: { user_id: user.id } }),
    }
  );

  if (resp.status === 204) {
    return NextResponse.json({ ok: true, message: "Descoberta assistida iniciada. Nenhuma candidatura será enviada automaticamente." });
  }

  const body = await resp.text();
  if (resp.status === 422 && body.includes("disabled workflow")) {
    return NextResponse.json({
      error: "A automação está desativada no GitHub. Um administrador do repositório precisa abrir Actions → AutoCurriculo AI Bot → Enable workflow. Depois, tente novamente.",
      code: "WORKFLOW_DISABLED",
    }, { status: 503 });
  }
  return NextResponse.json({ error: `GitHub API: ${resp.status} ${body}` }, { status: 500 });
}
