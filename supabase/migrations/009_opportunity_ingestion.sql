-- Fontes públicas de vagas e observabilidade da coleta.
-- Esta migration não cria integração de candidatura nem armazena credenciais.

CREATE TABLE IF NOT EXISTS public.opportunity_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('greenhouse', 'lever', 'ashby', 'career_page')),
  name TEXT NOT NULL,
  identifier TEXT NOT NULL,
  company_name TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, identifier)
);
ALTER TABLE public.opportunity_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage opportunity sources" ON public.opportunity_sources;
CREATE POLICY "Admins manage opportunity sources" ON public.opportunity_sources
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.opportunity_ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES public.opportunity_sources(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  discovered_count INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
ALTER TABLE public.opportunity_ingestion_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read ingestion runs" ON public.opportunity_ingestion_runs;
CREATE POLICY "Admins read ingestion runs" ON public.opportunity_ingestion_runs
  FOR SELECT USING (public.is_admin());

CREATE INDEX IF NOT EXISTS opportunity_sources_enabled_idx ON public.opportunity_sources (enabled, provider);
CREATE INDEX IF NOT EXISTS opportunity_ingestion_runs_started_idx ON public.opportunity_ingestion_runs (started_at DESC);

DROP POLICY IF EXISTS "Admins manage opportunities" ON public.opportunities;
CREATE POLICY "Admins manage opportunities" ON public.opportunities
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
