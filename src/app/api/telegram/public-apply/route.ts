import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { equalSecret } from "@/lib/public-applications";

type TelegramUpdate = { message?: { text?: string; chat?: { id?: number | string } } };

export async function POST(request: Request) {
  const header = request.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!equalSecret(header, process.env.PUBLIC_TELEGRAM_WEBHOOK_SECRET)) return new Response(null, { status: 401 });
  const update = await request.json().catch(() => null) as TelegramUpdate | null;
  const text = update?.message?.text || "";
  const chatId = update?.message?.chat?.id;
  const match = /^\/start\s+([A-Za-z0-9_-]{20,80})$/.exec(text);
  if (!match || chatId === undefined) return Response.json({ ok: true });
  const hash = createHash("sha256").update(match[1]).digest("hex");
  await createAdminClient().from("public_application_telegram").update({ chat_id: String(chatId), pair_hash: null, expires_at: null })
    .eq("pair_hash", hash).gt("expires_at", new Date().toISOString());
  return Response.json({ ok: true });
}
