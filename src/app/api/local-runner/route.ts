import { createAdminClient } from "@/lib/supabase/admin";
import { digest, isUuid, record, runnerError, safeUrl } from "@/lib/local-runner";

const finalBeforeSubmission = ["needs_login", "needs_review", "skipped_external", "failed"];

function shortText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

type RunnerControl = {
  user_id: string;
  enabled: boolean;
  generation: string;
  platform_limits: Record<string, number>;
  screening_answers: Record<string, string>;
  resume_id: string | null;
};

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1];
  const instance = request.headers.get("x-runner-instance");
  if (!token || !isUuid(instance)) return runnerError("Runner sem vínculo.", 401);
  const body: unknown = await request.json().catch(() => null);
  if (!record(body)) return runnerError("Comando inválido.");
  const admin = createAdminClient();
  const p_hash = digest(token);
  const heartbeat = await admin.rpc("local_runner_heartbeat", { p_hash, p_instance: instance }).maybeSingle().overrideTypes<RunnerControl | null, { merge: false }>();
  if (heartbeat.error) return runnerError("O runner não conseguiu acessar o Supabase.", 503);
  const control = heartbeat.data;
  if (!control) return runnerError("Vínculo expirado ou outro runner está conectado.", 401);
  const user_id: string = control.user_id;
  const action = body.action;
  const enabled = control.enabled && control.generation === body.generation;

  if (action === "poll") {
    const results = await Promise.all([
      admin.from("profiles").select("cargo,cidade,limite_diario,direct_submission_enabled").eq("user_id", user_id).maybeSingle(),
      admin.from("professional_profiles").select("full_name,phone,summary,city,state,country_code").eq("user_id", user_id).maybeSingle(),
      admin.from("search_profiles").select("remote_only,work_modes").eq("user_id", user_id).eq("active", true).limit(1).maybeSingle(),
      admin.auth.admin.getUserById(user_id),
      admin.from("local_runner_jobs").update({ status: "applied_unconfirmed", detail: "A tentativa foi interrompida. Confira o histórico da plataforma.", updated_at: new Date().toISOString() })
        .eq("user_id", user_id).eq("status", "applying").lt("attempt_at", new Date(Date.now() - 10 * 60_000).toISOString()),
    ]);
    if (results.some(({ error }) => error)) return runnerError("Perfil indisponível.", 503);
    const [profile, applicant, search, auth] = results;
    return Response.json({
      enabled: control.enabled, generation: control.generation, profile: profile.data,
      applicant: { ...applicant.data, email: auth.data.user?.email },
      search: search.data, limits: control.platform_limits, answers: control.screening_answers,
    });
  }

  if (action === "finish") {
    if (!isUuid(body.id)) return runnerError("Vaga inválida.");
    const text = shortText(body.text, 600);
    const url = safeUrl(body.url);
    let screenshot: string | null = null;
    const job = await admin.from("local_runner_jobs").select("status,url").eq("user_id", user_id).eq("id", body.id).maybeSingle();
    if (!job.data || !["applying", "applied_unconfirmed", "applied_confirmed"].includes(job.data.status)) return runnerError("Tentativa indisponível.", 409);
    if (job.data.status === "applied_confirmed") return Response.json({ confirmed: true });
    const jobHost = new URL(job.data.url).hostname.replace(/^br\./, "");
    if (url && url.hostname !== jobHost && !url.hostname.endsWith("." + jobHost)) return runnerError("Confirmação fora da plataforma.");
    if (url) url.search = "";
    if (text && url && typeof body.screenshot === "string" && body.screenshot.length <= 2_650_000) {
      const image = Buffer.from(body.screenshot, "base64");
      if (image.length > 4 && image.length <= 2_000_000 && image[0] === 255 && image[1] === 216) {
        const path = `${user_id}/${body.id}.jpg`;
        const upload = await admin.storage.from("runner-evidence").upload(path, image, { contentType: "image/jpeg", upsert: true });
        if (!upload.error) screenshot = path;
      }
    }
    const result = await admin.rpc("local_runner_finish", { p_user: user_id, p_job: body.id, p_text: url ? text : "", p_url: url?.href ?? "", p_screenshot: screenshot });
    if (result.error || !result.data) return runnerError("Não foi possível registrar a tentativa.", 503);
    return Response.json({ confirmed: Boolean(text && url), screenshot: Boolean(screenshot) });
  }

  if (!enabled) return runnerError("O runner está pausado ou recebeu um novo comando START.", 409);

  if (action === "resume") {
    let query = admin.from("resumes").select("storage_path,mime_type").eq("user_id", user_id);
    query = control.resume_id ? query.eq("id", control.resume_id) : query.eq("is_default", true);
    const { data } = await query.limit(1).maybeSingle();
    if (!data || data.mime_type !== "application/pdf" || !data.storage_path.startsWith(user_id + "/")) return runnerError("Selecione um currículo PDF no painel.", 404);
    const signed = await admin.storage.from("curriculos").createSignedUrl(data.storage_path, 60);
    return signed.data ? Response.json({ url: signed.data.signedUrl }) : runnerError("Currículo indisponível.", 503);
  }

  if (action === "event") {
    const message = shortText(body.message, 500);
    if (!message) return runnerError("Evento inválido.");
    const { error } = await admin.from("local_runner_events").insert({ user_id, message, platform: shortText(body.platform, 50) || null });
    return error ? runnerError("Evento indisponível.", 503) : Response.json({});
  }

  if (action === "job") {
    const url = safeUrl(body.url);
    const title = shortText(body.title, 250);
    const company = shortText(body.company, 250);
    const platform = shortText(body.platform, 50);
    const score = typeof body.score === "number" && Number.isInteger(body.score) && body.score >= 0 && body.score <= 100 ? body.score : null;
    if (!url || !title || !company || !platform || score === null || !["queued", "skipped_filter"].includes(String(body.status))) return runnerError("Vaga inválida.");
    const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const fingerprint = digest(normalize(title) + "|" + normalize(company));
    const existing = await admin.from("local_runner_jobs").select("id,status,url")
      .eq("user_id", user_id).eq("fingerprint", fingerprint).maybeSingle();
    if (existing.error) return runnerError("Não foi possível consultar vagas.", 503);
    if (existing.data && existing.data.url !== url.href) return Response.json({ duplicate: true });
    const payload = {
      user_id, url: url.href, title, company, platform, fingerprint, score,
      location: shortText(body.location, 180), detail: shortText(body.detail, 500), status: body.status,
    };
    const insert = await admin.from("local_runner_jobs").insert(payload).select("id,status").single();
    if (!insert.error) return Response.json(insert.data);
    if (insert.error.code !== "23505") return runnerError("Não foi possível gravar a vaga.", 503);
    if (body.status === "queued") {
      const updated = await admin.from("local_runner_jobs").update({ status: "queued", detail: payload.detail, score, updated_at: new Date().toISOString() })
        .eq("user_id", user_id).eq("url", url.href).in("status", ["skipped_filter", "queued", "needs_login"])
        .is("attempt_at", null).select("id,status").maybeSingle();
      if (updated.error) return runnerError("Não foi possível atualizar a vaga.", 503);
      if (updated.data) return Response.json(updated.data);
    }
    return Response.json({ duplicate: true });
  }

  if (action === "update") {
    if (!isUuid(body.id) || !finalBeforeSubmission.includes(String(body.status))) return runnerError("Estado inválido.");
    const { error } = await admin.from("local_runner_jobs").update({ status: body.status, detail: shortText(body.detail, 500), updated_at: new Date().toISOString() })
      .eq("user_id", user_id).eq("id", body.id).eq("status", "queued").is("attempt_at", null);
    return error ? runnerError("Não foi possível atualizar a vaga.", 503) : Response.json({});
  }

  if (action === "reserve") {
    if (!isUuid(body.id)) return runnerError("Vaga inválida.");
    const result = await admin.rpc("local_runner_reserve", {
      p_user: user_id, p_hash, p_generation: control.generation, p_instance: instance, p_job: body.id,
    });
    return result.error ? runnerError("Não foi possível reservar a vaga.", 503) : Response.json({ allowed: result.data });
  }
  return runnerError("Comando inválido.");
}
