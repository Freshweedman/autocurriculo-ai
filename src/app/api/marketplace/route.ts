import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/marketplace — public listing feed with filters
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(req.url);

  const categoria = searchParams.get("categoria");
  const busca = searchParams.get("busca");
  const tipo = searchParams.get("tipo");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("marketplace_listings")
    .select("*, profiles!inner(cargo, cidade)", { count: "exact" })
    .eq("ativo", true)
    .order("destaque", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (categoria && categoria !== "todas") query = query.eq("categoria", categoria);
  if (tipo && tipo !== "todos") query = query.eq("tipo", tipo);
  if (busca) query = query.ilike("titulo", `%${busca}%`);

  const { data, count, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ listings: data || [], total: count || 0, page, limit });
}

// POST /api/marketplace — create or update listing
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, ...fields } = body;

  const payload = {
    user_id: user.id,
    titulo: fields.titulo?.trim(),
    descricao: fields.descricao?.trim(),
    categoria: fields.categoria,
    tipo: fields.tipo || "servico",
    preco_min: fields.preco_min || null,
    preco_max: fields.preco_max || null,
    modalidade: fields.modalidade || "remoto",
    cidade: fields.cidade?.trim() || null,
    tags: fields.tags || [],
    contato_email: fields.contato_email?.trim() || null,
    contato_whatsapp: fields.contato_whatsapp?.trim() || null,
    contato_site: fields.contato_site?.trim() || null,
    ativo: fields.ativo ?? true,
    updated_at: new Date().toISOString(),
  };

  if (!payload.titulo || !payload.descricao || !payload.categoria) {
    return NextResponse.json({ error: "titulo, descricao e categoria são obrigatórios" }, { status: 400 });
  }

  let result;
  if (id) {
    result = await supabase
      .from("marketplace_listings")
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();
  } else {
    result = await supabase
      .from("marketplace_listings")
      .insert(payload)
      .select()
      .single();
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, listing: result.data });
}

// DELETE /api/marketplace — delete listing
export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const { error } = await supabase
    .from("marketplace_listings")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
