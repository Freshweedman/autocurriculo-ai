import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptConnectionSecret } from "@/lib/connection-vault";

const ALLOWED_PLATFORMS = new Set([
  "indeed", "infojobs", "catho", "sine", "workana", "getninjas", "freelas99",
]);
const ALLOWED_AUTH_MODES = new Set(["manual", "oauth", "api_key", "assisted"]);

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error: queryError } = await supabase
    .from("platform_connection_status")
    .select("id, platform, auth_mode, status, account_hint, last_verified_at, last_error, updated_at")
    .order("platform");
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  return NextResponse.json({ connections: data || [] });
}

export async function POST(request: NextRequest) {
  const sessionClient = await createClient();
  const { data: { user }, error } = await sessionClient.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    platform?: string;
    authMode?: string;
    accountHint?: string;
    secret?: string;
  };
  if (!body.platform || !ALLOWED_PLATFORMS.has(body.platform)) {
    return NextResponse.json({ error: "Unsupported platform" }, { status: 400 });
  }
  if (!body.authMode || !ALLOWED_AUTH_MODES.has(body.authMode)) {
    return NextResponse.json({ error: "Unsupported authentication mode" }, { status: 400 });
  }
  if (!body.secret?.trim()) return NextResponse.json({ error: "A connection secret is required" }, { status: 400 });

  let encryptedSecret: string;
  try {
    const credentialBundle = JSON.stringify({
      email: body.accountHint?.trim() || user.email || "",
      senha: body.secret.trim(),
    });
    encryptedSecret = `\\x${encryptConnectionSecret(credentialBundle).toString("hex")}`;
  } catch (vaultError) {
    const message = vaultError instanceof Error ? vaultError.message : "Connection vault unavailable";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const admin = createAdminClient();
  const { error: upsertError } = await admin.from("platform_connections").upsert({
    user_id: user.id,
    platform: body.platform,
    auth_mode: body.authMode,
    status: "connected",
    account_hint: body.accountHint?.trim() || user.email || null,
    encrypted_secret: encryptedSecret,
    secret_version: 1,
    last_error: null,
    last_verified_at: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,platform" });

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const sessionClient = await createClient();
  const { data: { user }, error } = await sessionClient.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const platform = new URL(request.url).searchParams.get("platform");
  if (!platform || !ALLOWED_PLATFORMS.has(platform)) return NextResponse.json({ error: "Unsupported platform" }, { status: 400 });

  const admin = createAdminClient();
  const { error: deleteError } = await admin
    .from("platform_connections")
    .delete()
    .eq("user_id", user.id)
    .eq("platform", platform);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
