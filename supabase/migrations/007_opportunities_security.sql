-- Fase 2: modelo seguro para oportunidades, perfis de busca e candidaturas.
-- Esta migration é aditiva: não remove tabelas, políticas ou dados existentes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Papéis persistentes. Todo novo usuário recebe o papel mínimo; a promoção a
-- administrador é uma ação explícita e auditável, nunca baseada em e-mail.
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'admin')) DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "Users read own role" ON public.user_roles;
CREATE POLICY "Users read own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.assign_default_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_default_user_role();

-- Perfil profissional separado das preferências técnicas de automação.
CREATE TABLE IF NOT EXISTS public.professional_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  headline TEXT,
  summary TEXT,
  country_code TEXT DEFAULT 'BR',
  city TEXT,
  state TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT,
  salary_expectation NUMERIC(12,2),
  work_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.professional_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own professional profile" ON public.professional_profiles;
CREATE POLICY "Users manage own professional profile" ON public.professional_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Várias versões de currículo, todas privadas e vinculadas ao dono.
CREATE TABLE IF NOT EXISTS public.resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  size_bytes BIGINT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  extracted_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, storage_path)
);
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own resumes" ON public.resumes;
CREATE POLICY "Users manage own resumes" ON public.resumes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE UNIQUE INDEX IF NOT EXISTS resumes_one_default_per_user
  ON public.resumes (user_id) WHERE is_default;

-- Perfis de busca persistentes: nenhum filtro é limitado a CLT.
CREATE TABLE IF NOT EXISTS public.search_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Busca principal',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  locations JSONB NOT NULL DEFAULT '[]'::jsonb,
  work_modes TEXT[] NOT NULL DEFAULT '{}',
  contract_types TEXT[] NOT NULL DEFAULT '{}',
  seniorities TEXT[] NOT NULL DEFAULT '{}',
  salary_min NUMERIC(12,2),
  salary_max NUMERIC(12,2),
  currency_code TEXT DEFAULT 'BRL',
  remote_only BOOLEAN NOT NULL DEFAULT false,
  international_only BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.search_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own search profiles" ON public.search_profiles;
CREATE POLICY "Users manage own search profiles" ON public.search_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Catálogo normalizado de oportunidades coletadas por fontes permitidas.
CREATE TABLE IF NOT EXISTS public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  source_job_id TEXT,
  canonical_url TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT,
  description TEXT,
  requirements TEXT,
  location_text TEXT,
  country_code TEXT,
  work_mode TEXT,
  contract_type TEXT,
  seniority TEXT,
  salary_min NUMERIC(12,2),
  salary_max NUMERIC(12,2),
  currency_code TEXT,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'closed', 'broken')),
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(source, canonical_url)
);
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users read active opportunities" ON public.opportunities;
CREATE POLICY "Authenticated users read active opportunities" ON public.opportunities
  FOR SELECT TO authenticated USING (status = 'active' OR public.is_admin());
CREATE INDEX IF NOT EXISTS opportunities_active_discovered_idx ON public.opportunities (status, discovered_at DESC);
CREATE INDEX IF NOT EXISTS opportunities_source_idx ON public.opportunities (source);

-- A relação individual com cada oportunidade: descoberta, salva, preparação etc.
CREATE TABLE IF NOT EXISTS public.user_opportunities (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  search_profile_id UUID REFERENCES public.search_profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'found' CHECK (status IN ('found', 'saved', 'preparing', 'awaiting_submission', 'dismissed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, opportunity_id)
);
ALTER TABLE public.user_opportunities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own saved opportunities" ON public.user_opportunities;
CREATE POLICY "Users manage own saved opportunities" ON public.user_opportunities
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Expansão não destrutiva do histórico de candidaturas existente.
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resume_id UUID REFERENCES public.resumes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS applications_user_status_idx ON public.applications (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS applications_opportunity_idx ON public.applications (opportunity_id);

-- The original schema allowed only read/insert. Users need to correct their
-- own application history, but can never modify another user's records.
DROP POLICY IF EXISTS "Users can update own applications" ON public.applications;
CREATE POLICY "Users can update own applications" ON public.applications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own applications" ON public.applications;
CREATE POLICY "Users can delete own applications" ON public.applications
  FOR DELETE USING (auth.uid() = user_id);

-- Execuções individuais de automação e logs auditáveis.
CREATE TABLE IF NOT EXISTS public.automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  search_profile_id UUID REFERENCES public.search_profiles(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'scheduled', 'assisted')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'paused', 'succeeded', 'failed', 'cancelled')),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own automation runs" ON public.automation_runs;
CREATE POLICY "Users read own automation runs" ON public.automation_runs
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- Metadados de conexão. Segredos passam a ser guardados fora do perfil simples.
CREATE TABLE IF NOT EXISTS public.platform_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  auth_mode TEXT NOT NULL CHECK (auth_mode IN ('none', 'manual', 'oauth', 'api_key', 'assisted')),
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connected', 'needs_action', 'error')),
  account_hint TEXT,
  encrypted_secret BYTEA,
  secret_version SMALLINT NOT NULL DEFAULT 1,
  last_verified_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform)
);
ALTER TABLE public.platform_connections ENABLE ROW LEVEL SECURITY;

-- A tabela base não tem políticas para clientes: apenas rotas de servidor com
-- service role podem ler ou gravar o segredo criptografado. A view abaixo expõe
-- somente metadados da conexão ao respectivo usuário.
CREATE OR REPLACE VIEW public.platform_connection_status AS
  SELECT id, user_id, platform, auth_mode, status, account_hint,
         last_verified_at, last_error, created_at, updated_at
  FROM public.platform_connections
  WHERE user_id = auth.uid();
GRANT SELECT ON public.platform_connection_status TO authenticated;

