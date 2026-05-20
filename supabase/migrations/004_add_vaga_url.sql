-- Migration 004: Add vaga_url to applications and tipo/fonte to leads
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS vaga_url TEXT DEFAULT NULL;

ALTER TABLE public.leads_google
  ADD COLUMN IF NOT EXISTS fonte TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tipo  TEXT DEFAULT NULL; -- 'empresa_contratante' | 'agencia' | 'maps'
