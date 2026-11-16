import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

const providers = new Set(["greenhouse", "lever", "ashby"]);

export async function GET() {
  const supabase = await createClient();
  const { user, status } = await getAuthenticatedAdmin(supabase);
  if (!user) return NextResponse.json({ error: "Acesso administrativo necessário" }, { status: status || 403 });
  const { data, error } = await supabase.from("opportunity_sources").select("id,provider,name,identifier,company_name,enabled,last_synced_at,last_error,created_at").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Aplique a migration 009 para administrar fontes." }, { status: 400 });
  return NextResponse.json({ sources: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { user, status } = await getAuthenticatedAdmin(supabase);
  if (!user) return NextResponse.json({ error: "Acesso administrativo necessário" }, { status: status || 403 });
  const body = await request.json().catch(() => ({}));
  const provider = typeof body.provider === "string" ? body.provider : "";
  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : null;
  if (!providers.has(provider) || !identifier || !name || identifier.length > 120 || name.length > 120) return NextResponse.json({ error: "Informe fornecedor, nome e identificador válidos." }, { status: 400 });
  if (!/^[a-zA-Z0-9_-]+$/.test(identifier)) return NextResponse.json({ error: "O identificador deve conter apenas letras, números, hífen ou sublinhado." }, { status: 400 });
  const { data, error } = await supabase.from("opportunity_sources").insert({ provider, identifier, name, company_name: companyName || null }).select("id,provider,name,identifier,company_name,enabled,last_synced_at,last_error,created_at").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Essa fonte já foi cadastrada." : "Não foi possível salvar a fonte." }, { status: 400 });
  return NextResponse.json({ source: data }, { status: 201 });
}
