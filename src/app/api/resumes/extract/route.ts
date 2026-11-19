import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { createClient } from "@/lib/supabase/server";
import { extractCandidateFromResume } from "@/lib/resume-extraction";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: resume, error: resumeError } = await supabase
    .from("resumes")
    .select("id,name,storage_path,mime_type,size_bytes")
    .eq("user_id", user.id)
    .eq("is_default", true)
    .maybeSingle();
  if (resumeError) return NextResponse.json({ error: "Não foi possível localizar o currículo padrão." }, { status: 500 });
  if (!resume) return NextResponse.json({ error: "Adicione e selecione um currículo PDF antes de continuar." }, { status: 400 });
  if (resume.mime_type !== "application/pdf" || !resume.size_bytes || resume.size_bytes > 10 * 1024 * 1024) return NextResponse.json({ error: "O currículo padrão precisa ser um PDF de até 10 MB." }, { status: 400 });

  const { data: file, error: downloadError } = await supabase.storage.from("curriculos").download(resume.storage_path);
  if (downloadError || !file) return NextResponse.json({ error: "Não foi possível ler o PDF privado selecionado." }, { status: 500 });

  let text = "";
  try {
    const parser = new PDFParse({ data: new Uint8Array(await file.arrayBuffer()) });
    text = (await parser.getText()).text || "";
    await parser.destroy();
  } catch {
    return NextResponse.json({ error: "Não foi possível extrair texto deste PDF. Preencha os dados manualmente." }, { status: 422 });
  }

  const candidate = extractCandidateFromResume(text, resume.name);
  const { data: current } = await supabase.from("professional_profiles").select("full_name,phone,summary").eq("user_id", user.id).maybeSingle();
  const applicant = {
    full_name: current?.full_name || candidate.fullName || null,
    phone: current?.phone || candidate.phone || null,
    summary: current?.summary || candidate.summary || null,
  };
  const { error: saveError } = await supabase.from("professional_profiles").upsert({ user_id: user.id, ...applicant, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (saveError) return NextResponse.json({ error: "Os dados foram lidos, mas não puderam ser salvos." }, { status: 500 });
  await supabase.from("resumes").update({ extracted_text: text.slice(0, 20_000), updated_at: new Date().toISOString() }).eq("id", resume.id);
  return NextResponse.json({ ok: true, applicant, extracted: { name: Boolean(candidate.fullName), phone: Boolean(candidate.phone), summary: Boolean(candidate.summary) } });
}
