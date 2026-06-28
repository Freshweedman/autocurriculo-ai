-- Migration 005: Marketplace
-- Safe to run even if partially applied

CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'servico',
  preco_min NUMERIC(10,2),
  preco_max NUMERIC(10,2),
  modalidade TEXT DEFAULT 'remoto',
  cidade TEXT,
  tags TEXT[],
  contato_email TEXT,
  contato_whatsapp TEXT,
  contato_site TEXT,
  ativo BOOLEAN DEFAULT true,
  destaque BOOLEAN DEFAULT false,
  visualizacoes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;

-- Drop policies before recreating (safe re-run)
DROP POLICY IF EXISTS "Anyone can read active listings"   ON public.marketplace_listings;
DROP POLICY IF EXISTS "Users can read own listings"       ON public.marketplace_listings;
DROP POLICY IF EXISTS "Users can insert own listings"     ON public.marketplace_listings;
DROP POLICY IF EXISTS "Users can update own listings"     ON public.marketplace_listings;
DROP POLICY IF EXISTS "Users can delete own listings"     ON public.marketplace_listings;

CREATE POLICY "Anyone can read active listings"
  ON public.marketplace_listings FOR SELECT
  USING (ativo = true);

CREATE POLICY "Users can read own listings"
  ON public.marketplace_listings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own listings"
  ON public.marketplace_listings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own listings"
  ON public.marketplace_listings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own listings"
  ON public.marketplace_listings FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_user_id    ON public.marketplace_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_categoria  ON public.marketplace_listings(categoria);
CREATE INDEX IF NOT EXISTS idx_marketplace_ativo      ON public.marketplace_listings(ativo);
CREATE INDEX IF NOT EXISTS idx_marketplace_created_at ON public.marketplace_listings(created_at DESC);
