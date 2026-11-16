import type { SupabaseClient } from "@supabase/supabase-js";

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  const allowed = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return allowed.includes(email.toLowerCase());
}

/**
 * Uses the persisted role after migration 007 is installed. The environment
 * allow-list is retained as a temporary recovery path for the first deploy
 * that introduces the roles table.
 */
export async function hasAdminAccess(client: SupabaseClient, user: { id: string; email?: string | null }) {
  const { data, error } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!error && data?.role === "admin") return true;
  return isAdminEmail(user.email);
}

export async function getAuthenticatedAdmin(client: SupabaseClient) {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { user: null, status: 401 as const };
  if (!await hasAdminAccess(client, user)) return { user: null, status: 403 as const };
  return { user, status: null };
}
