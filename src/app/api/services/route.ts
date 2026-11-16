import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedAdmin } from "@/lib/admin";

export async function GET() {
  const supabase = await createClient();
  const { user, status } = await getAuthenticatedAdmin(supabase);
  if (!user) return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Admin access required" }, { status: status! });
  const { data, error } = await supabase.from("services").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ services: data || [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { user, status } = await getAuthenticatedAdmin(supabase);
  if (!user) return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Admin access required" }, { status: status! });
  const body = await req.json();
  const { id, ...fields } = body;
  const payload = { ...fields, user_id: user.id, updated_at: new Date().toISOString() };
  let result;
  if (id) {
    result = await supabase.from("services").update(payload).eq("id", id).eq("user_id", user.id).select().single();
  } else {
    result = await supabase.from("services").insert(payload).select().single();
  }
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, service: result.data });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { user, status } = await getAuthenticatedAdmin(supabase);
  if (!user) return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Admin access required" }, { status: status! });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabase.from("services").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
