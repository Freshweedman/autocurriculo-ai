import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ONE-TIME SETUP ENDPOINT
// Acesse: http://localhost:3000/api/setup
// Isso cria todas as tabelas necessárias via Supabase Admin Client

export async function GET() {
  const supabase = createAdminClient();
  const results: Record<string, string> = {};

  // ── services ──────────────────────────────────────────────────────────────
  try {
    await supabase.rpc("exec_sql", { sql: `
      CREATE TABLE IF NOT EXISTS public.services (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'Sites',
        base_description TEXT,
        price_min NUMERIC(10,2), price_mid NUMERIC(10,2), price_max NUMERIC(10,2),
        delivery_time TEXT, includes TEXT[], excludes TEXT[],
        target_audience TEXT, portfolio_url TEXT, whatsapp_url TEXT, instagram_url TEXT,
        image_urls TEXT[], active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
      );
      ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
    `});
  } catch (_) {}

  // Test what exists by trying to select from each table
  const tables = [
    "profiles", "applications", "leads_google",
    "services", "campaigns", "channels",
    "generated_pamphlets", "publishing_queue",
    "automation_tasks", "creatives", "service_leads"
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).select("id").limit(1);
    results[table] = error ? `MISSING: ${error.message}` : "OK";
  }

  const missing = Object.entries(results).filter(([, v]) => v.startsWith("MISSING")).map(([k]) => k);

  if (missing.length === 0) {
    return NextResponse.json({ status: "ALL OK", tables: results });
  }

  return NextResponse.json({
    status: "MISSING TABLES",
    missing,
    tables: results,
    instructions: "Run setup_completo.sql in Supabase SQL Editor",
    sql_url: "https://supabase.com/dashboard/project/nbhrtazsgbtfikbyqxth/sql/new"
  }, { status: 200 });
}
