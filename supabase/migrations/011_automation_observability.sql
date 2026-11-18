-- Observabilidade e rastreabilidade por execução. Migration aditiva: não
-- modifica dados existentes nem habilita candidaturas automáticas.

CREATE TABLE IF NOT EXISTS public.automation_run_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('queued', 'started', 'source_started', 'source_finished', 'opportunity_found', 'opportunity_filtered', 'application_pending', 'application_confirmed', 'login_required', 'failed', 'completed', 'cancelled')),
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.automation_run_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own automation run events" ON public.automation_run_events;
CREATE POLICY "Users read own automation run events" ON public.automation_run_events
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE INDEX IF NOT EXISTS automation_run_events_run_created_idx
  ON public.automation_run_events (run_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.automation_run_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  source TEXT,
  canonical_url TEXT,
  title TEXT,
  company TEXT,
  status TEXT NOT NULL CHECK (status IN ('discovered', 'filtered', 'compatible', 'ignored', 'duplicate', 'awaiting_review', 'awaiting_login', 'pending_confirmation', 'confirmed', 'failed')),
  score SMALLINT CHECK (score BETWEEN 0 AND 100),
  reason JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(run_id, canonical_url)
);
ALTER TABLE public.automation_run_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own automation run items" ON public.automation_run_items;
CREATE POLICY "Users read own automation run items" ON public.automation_run_items
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE INDEX IF NOT EXISTS automation_run_items_user_created_idx
  ON public.automation_run_items (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.application_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('platform_confirmation', 'api_response', 'protocol', 'confirmation_url', 'manual_confirmation')),
  reference TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.application_evidence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own application evidence" ON public.application_evidence;
CREATE POLICY "Users read own application evidence" ON public.application_evidence
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- The server-side BOT webhook writes with service role. Client access remains
-- read-only and limited to the record owner by the policies above.
