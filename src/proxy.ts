import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { hasAdminAccess } from "@/lib/admin";

const ADMIN_ONLY_API_PREFIXES = [
  "/api/campaigns",
  "/api/channels",
  "/api/generate-pamphlets",
  "/api/publishing",
  "/api/services",
  "/api/setup",
];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isAdminOnlyApi = ADMIN_ONLY_API_PREFIXES.some((prefix) => request.nextUrl.pathname.startsWith(prefix));
  if (isAdminOnlyApi) {
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await hasAdminAccess(supabase, user)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Protect /dashboard routes — redirect to login if not authenticated
  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect authenticated users away from login/register
  if (user && (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register", "/api/:path*"],
};
