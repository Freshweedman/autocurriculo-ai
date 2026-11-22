import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { isUuid, record, runnerError, safeUrl } from "@/lib/local-runner";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return runnerError("Sessão expirada.", 401);
  const { data, error } = await supabase.from("resumes").select("storage_path").eq("user_id", user.id).eq("is_default", true).maybeSingle();
  if (error || !data?.storage_path?.startsWith(user.id + "/")) return runnerError("Selecione seu currículo padrão.", 404);
  const signed = await supabase.storage.from("curriculos").createSignedUrl(data.storage_path, 60, { download: "Curriculo.pdf" });
  return signed.data ? Response.redirect(signed.data.signedUrl) : runnerError("Currículo indisponível.", 503);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return runnerError("Sessão expirada.", 401);

  const body: unknown = await request.json().catch(() => null);
  if (!record(body) || !isUuid(body.id)) return runnerError("Vaga inválida.");
  const { data: owned } = await supabase.from("user_opportunities").select("opportunity_id")
    .eq("user_id", user.id).eq("opportunity_id", body.id).neq("status", "dismissed").maybeSingle();
  if (!owned) return runnerError("Vaga indisponível para seu perfil.", 404);

  const { data: vacancy } = await supabase.from("opportunities").select("id,title,company,source,canonical_url")
    .eq("id", owned.opportunity_id).maybeSingle();
  if (!vacancy || !safeUrl(vacancy.canonical_url)) return runnerError("A vaga expirou ou foi removida.", 404);

  const prior = await supabase.from("applications").select("id").eq("user_id", user.id)
    .eq("vaga_url", vacancy.canonical_url).not("status", "in", "(falhou,nao_suportado,sem_submit,sem_file_input,duplicado)").limit(1).maybeSingle();
  if (prior.error) return runnerError("Não foi possível consultar seu histórico.", 503);
  if (prior.data) return Response.json({ id: prior.data.id, message: "Esta vaga já consta no seu histórico." });

  const hash = createHash("sha256").update(`${user.id}|${vacancy.canonical_url}`).digest("hex");
  const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  const { data: resume } = await supabase.from("resumes").select("id").eq("user_id", user.id).eq("is_default", true).maybeSingle();
  const { error } = await supabase.from("applications").upsert({
    id, user_id: user.id, opportunity_id: vacancy.id, resume_id: resume?.id ?? null, vaga: vacancy.title,
    empresa: vacancy.company, plataforma: vacancy.source, vaga_url: vacancy.canonical_url,
    status: "submitted_manual", sent_at: new Date().toISOString(), notes: "Envio informado pela pessoa candidata no painel.",
  }, { onConflict: "id", ignoreDuplicates: true });
  if (error) return runnerError("Não foi possível registrar o envio.", 503);
  return Response.json({ id, message: "Envio registrado no histórico como informado por você." });
}
