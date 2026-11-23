BEGIN;
CREATE TABLE IF NOT EXISTS public.search_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL,
  url_hash text NOT NULL,
  title text NOT NULL,
  company text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  flow_type text NOT NULL CHECK (flow_type IN ('public_form','login_required','assisted','unknown')),
  compatible boolean NOT NULL DEFAULT false,
  UNIQUE(user_id, url_hash)
);
ALTER TABLE public.search_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own search items" ON public.search_items;
CREATE POLICY "Users read own search items" ON public.search_items FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.search_items FROM anon, authenticated;
GRANT ALL ON public.search_items TO service_role;
COMMIT;
