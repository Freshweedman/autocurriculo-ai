import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const PUBLIC_MODES = ["public_form_inspect", "public_form_apply"];

export const publicReasons = {
  unsupported: "Candidatura pelo portal",
  captcha: "A plataforma pediu uma verificação humana",
  authentication: "O portal pediu login ou bloqueou o acesso",
  required_answers: "Falta uma resposta obrigatória no perfil",
  unknown_form: "Formulário incompleto ou formato inesperado",
  missing_resume: "Adicione ou selecione um currículo PDF",
  reservation_denied: "Envio fora do limite, já registrado ou autorização expirada",
  provider_uncertain: "Envio sem confirmação. Confira o portal antes de repetir",
  interrupted: "A execução foi interrompida",
  form_observed: "Formulário público localizado",
};

export function equalSecret(provided: string, expected: string | undefined) {
  if (!expected || expected.length < 32) return false;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(provided), hash(expected));
}

export function opaqueLane(userId: string, secret: string) {
  return createHmac("sha256", secret).update("owner:" + userId).digest("hex");
}

export async function sendPublicNotification(userId: string) {
  const token = process.env.PUBLIC_TELEGRAM_BOT_TOKEN;
  const app = process.env.PUBLIC_APP_ORIGIN || "https://autocurriculo-ai.vercel.app";
  if (!token || !/^\d+:[\w-]+$/.test(token)) return;
  const { data } = await createAdminClient().from("public_application_telegram").select("chat_id").eq("user_id", userId).maybeSingle();
  if (!data?.chat_id) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(5000),
    body: JSON.stringify({ chat_id: data.chat_id, text: "Há candidaturas para revisar no AutoCurriculo AI. " + app + "/dashboard/automacao",
      link_preview_options: { is_disabled: true } }),
  }).catch(() => {});
}
