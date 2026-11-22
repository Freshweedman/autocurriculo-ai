import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export function runnerError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function runnerUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
}

export function safeUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 1800) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".")) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}
