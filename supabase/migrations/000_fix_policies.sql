-- Fix: Drop and recreate all policies safely
-- Run this if migrations anteriores deram erro de "policy already exists"

-- profiles
DROP POLICY IF EXISTS "Users can read own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can read own profile"   ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- applications
DROP POLICY IF EXISTS "Users can read own applications"   ON public.applications;
DROP POLICY IF EXISTS "Users can insert own applications" ON public.applications;

CREATE POLICY "Users can read own applications"   ON public.applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own applications" ON public.applications FOR INSERT WITH CHECK (auth.uid() = user_id);

-- leads_google
DROP POLICY IF EXISTS "Users can read own leads"   ON public.leads_google;
DROP POLICY IF EXISTS "Users can insert own leads" ON public.leads_google;

CREATE POLICY "Users can read own leads"   ON public.leads_google FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own leads" ON public.leads_google FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Storage: curriculos
DROP POLICY IF EXISTS "Users can read own curriculo"   ON storage.objects;
DROP POLICY IF EXISTS "Users can insert own curriculo" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own curriculo" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own curriculo" ON storage.objects;

CREATE POLICY "Users can read own curriculo"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'curriculos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can insert own curriculo"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'curriculos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own curriculo"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'curriculos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own curriculo"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'curriculos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add missing columns (safe)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS catho_email     TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS catho_senha     TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sine_email      TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sine_senha      TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS workana_email   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS workana_senha   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS getninjas_email TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS getninjas_senha TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS freelas99_email TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS freelas99_senha TEXT DEFAULT NULL;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS vaga_url TEXT DEFAULT NULL;

ALTER TABLE public.leads_google
  ADD COLUMN IF NOT EXISTS fonte TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tipo  TEXT DEFAULT NULL;
