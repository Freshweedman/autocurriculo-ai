-- Migration 006: Máquina de Panfletagem Digital
-- Drop marketplace (não usado)
DROP TABLE IF EXISTS public.marketplace_listings CASCADE;

-- ── services ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  base_description TEXT,
  price_min NUMERIC(10,2),
  price_mid NUMERIC(10,2),
  price_max NUMERIC(10,2),
  delivery_time TEXT,
  includes TEXT[],
  excludes TEXT[],
  bonus TEXT,
  guarantee TEXT,
  target_audience TEXT,
  portfolio_url TEXT,
  whatsapp_url TEXT,
  instagram_url TEXT,
  image_urls TEXT[],
  common_objections TEXT[],
  ready_answers TEXT[],
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own services" ON public.services;
CREATE POLICY "Users manage own services" ON public.services
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── campaigns ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  objective TEXT,
  target_cities TEXT[],
  target_audience TEXT,
  tone TEXT DEFAULT 'profissional',
  main_offer TEXT,
  main_cta TEXT,
  recommended_frequency TEXT,
  status TEXT DEFAULT 'ativa',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own campaigns" ON public.campaigns;
CREATE POLICY "Users manage own campaigns" ON public.campaigns
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── channels ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'olx','facebook_marketplace','facebook_group','workana','99freelas','fiverr','linkedin','instagram','whatsapp','telegram','other'
  platform TEXT,
  url TEXT,
  publication_mode TEXT DEFAULT 'manual', -- 'manual','copy_paste','assisted','runner','api'
  status TEXT DEFAULT 'ativo',
  notes TEXT,
  last_posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own channels" ON public.channels;
CREATE POLICY "Users manage own channels" ON public.channels
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── generated_pamphlets ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.generated_pamphlets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  title TEXT,
  short_description TEXT,
  long_description TEXT,
  cta TEXT,
  tags TEXT[],
  price_text TEXT,
  image_url TEXT,
  tone TEXT,
  status TEXT DEFAULT 'gerado', -- gerado, aprovado, publicado, arquivado
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.generated_pamphlets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own pamphlets" ON public.generated_pamphlets;
CREATE POLICY "Users manage own pamphlets" ON public.generated_pamphlets
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── publishing_queue ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.publishing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
  pamphlet_id UUID REFERENCES public.generated_pamphlets(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL, -- 'publicar','repostar','responder_lead','follow_up','trocar_imagem'
  status TEXT DEFAULT 'pendente', -- pendente,gerado,pronto,em_preenchimento,aguardando_confirmacao,publicado,pausado,erro,rejeitado,arquivado
  priority INTEGER DEFAULT 5,
  scheduled_for TIMESTAMPTZ,
  target_url TEXT,
  published_url TEXT,
  error_message TEXT,
  observations TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.publishing_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own queue" ON public.publishing_queue;
CREATE POLICY "Users manage own queue" ON public.publishing_queue
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── automation_tasks ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.automation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  queue_id UUID REFERENCES public.publishing_queue(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  task_type TEXT NOT NULL,
  status TEXT DEFAULT 'pendente', -- pendente,rodando,aguardando_confirmacao,concluido,erro
  payload_json JSONB,
  result_json JSONB,
  requires_human_confirmation BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);
ALTER TABLE public.automation_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own automation_tasks" ON public.automation_tasks;
CREATE POLICY "Users manage own automation_tasks" ON public.automation_tasks
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── creatives ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  format TEXT, -- story,feed,square,banner_olx,mockup,portfolio,before_after,fiverr_cover,marketplace_cover
  recommended_channel TEXT,
  status TEXT DEFAULT 'ativo',
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.creatives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own creatives" ON public.creatives;
CREATE POLICY "Users manage own creatives" ON public.creatives
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── service_leads ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_channel TEXT,
  platform TEXT,
  name TEXT,
  contact TEXT,
  service_interest TEXT,
  message TEXT,
  status TEXT DEFAULT 'novo', -- novo,em_contato,proposta_enviada,fechado,perdido
  estimated_value NUMERIC(10,2),
  next_followup TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.service_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own service_leads" ON public.service_leads;
CREATE POLICY "Users manage own service_leads" ON public.service_leads
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_services_user ON public.services(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_channels_user ON public.channels(user_id);
CREATE INDEX IF NOT EXISTS idx_pamphlets_user ON public.generated_pamphlets(user_id);
CREATE INDEX IF NOT EXISTS idx_queue_user ON public.publishing_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_queue_status ON public.publishing_queue(status);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON public.automation_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_user ON public.service_leads(user_id);
