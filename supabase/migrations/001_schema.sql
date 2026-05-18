-- AutoCurriculo AI Database Schema
-- Run this in Supabase SQL Editor to set up the database

-- Users login via Supabase Auth (managed automatically)
-- auth.users table is created by Supabase

-- Profiles table (user settings)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cargo TEXT DEFAULT 'gestor de trafego',
  cidade TEXT DEFAULT '',
  limite_diario INTEGER DEFAULT 5,
  bot_ativo BOOLEAN DEFAULT false,
  -- Platform credentials (set by user in dashboard, never exposed client-side)
  indeed_email    TEXT DEFAULT NULL,
  indeed_senha    TEXT DEFAULT NULL,
  linkedin_email  TEXT DEFAULT NULL,
  linkedin_senha  TEXT DEFAULT NULL,
  infojobs_email  TEXT DEFAULT NULL,
  infojobs_senha  TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Applications table (candidaturas)
CREATE TABLE IF NOT EXISTS public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa TEXT,
  vaga TEXT,
  plataforma TEXT NOT NULL,
  status TEXT DEFAULT 'pendente', -- enviado, falhou, duplicado, pendente
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own applications"
  ON public.applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own applications"
  ON public.applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Google leads table
CREATE TABLE IF NOT EXISTS public.leads_google (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa TEXT,
  telefone TEXT,
  site TEXT,
  email TEXT,
  cidade TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.leads_google ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own leads"
  ON public.leads_google FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own leads"
  ON public.leads_google FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON public.applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_google_user_id ON public.leads_google(user_id);

-- Storage bucket for curriculos
-- Run this via Supabase Dashboard: create bucket "curriculos" (private)
-- Or via SQL if storage API allows

-- Profile trigger: auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
