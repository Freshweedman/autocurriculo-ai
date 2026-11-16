-- Fase 5 e 6: acompanhamento detalhado e arquivos de currículo versionados.
-- Aditiva e segura para executar depois da migration 007.

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS company_contact TEXT,
  ADD COLUMN IF NOT EXISTS salary_text TEXT,
  ADD COLUMN IF NOT EXISTS application_url TEXT,
  ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS public.application_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.application_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own application events" ON public.application_events;
CREATE POLICY "Users manage own application events" ON public.application_events
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS application_events_application_created_idx
  ON public.application_events (application_id, created_at DESC);

-- RLS validates the event owner; this trigger also validates that the event
-- references an application owned by the same user.
CREATE OR REPLACE FUNCTION public.validate_application_event_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE application_owner UUID;
BEGIN
  SELECT user_id INTO application_owner FROM public.applications WHERE id = NEW.application_id;
  IF application_owner IS NULL OR application_owner <> NEW.user_id THEN
    RAISE EXCEPTION 'application event owner does not match application owner';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_application_event_validate_owner ON public.application_events;
CREATE TRIGGER on_application_event_validate_owner
  BEFORE INSERT OR UPDATE OF application_id, user_id ON public.application_events
  FOR EACH ROW EXECUTE FUNCTION public.validate_application_event_owner();

-- Keeps exactly one selected default resume for an account when the owner
-- switches it through the UI. No trigger removes or mutates another user.
CREATE OR REPLACE FUNCTION public.set_default_resume()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.resumes
    SET is_default = false, updated_at = now()
    WHERE user_id = NEW.user_id AND id <> NEW.id AND is_default;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_resume_set_default ON public.resumes;
CREATE TRIGGER on_resume_set_default
  BEFORE INSERT OR UPDATE OF is_default ON public.resumes
  FOR EACH ROW EXECUTE FUNCTION public.set_default_resume();
