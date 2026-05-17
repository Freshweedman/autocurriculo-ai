-- ============================================
-- Storage RLS Policies (curriculos bucket)
-- ============================================

-- Permitir SELECT (download) apenas do proprio arquivo
CREATE POLICY "Users can read own curriculo"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'curriculos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Permitir INSERT (upload/upsert) apenas no proprio path
CREATE POLICY "Users can insert own curriculo"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'curriculos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Permitir UPDATE apenas do proprio
CREATE POLICY "Users can update own curriculo"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'curriculos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Permitir DELETE apenas do proprio
CREATE POLICY "Users can delete own curriculo"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'curriculos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- Fix: UPDATE policy for profiles table
-- ============================================
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
