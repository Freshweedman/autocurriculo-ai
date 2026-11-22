CREATE TABLE public.local_runner_control (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  generation uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid,
  last_seen_at timestamptz,
  platform_limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  screening_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  resume_id uuid REFERENCES public.resumes(id) ON DELETE SET NULL
);

CREATE TABLE public.local_runner_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  url text NOT NULL,
  title text NOT NULL,
  company text NOT NULL,
  location text,
  fingerprint text NOT NULL,
  score smallint CHECK (score BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'discovered' CHECK (status IN (
    'discovered', 'queued', 'applying', 'applied_confirmed', 'applied_unconfirmed',
    'needs_login', 'needs_review', 'skipped_external', 'skipped_filter', 'failed')),
  detail text,
  attempt_at timestamptz,
  confirmed_at timestamptz,
  confirmation_url text,
  confirmation_text text,
  screenshot_path text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, url),
  UNIQUE (user_id, fingerprint)
);

CREATE INDEX local_runner_jobs_recent ON public.local_runner_jobs (user_id, updated_at DESC);
CREATE INDEX local_runner_jobs_attempt ON public.local_runner_jobs (user_id, attempt_at) WHERE attempt_at IS NOT NULL;
CREATE INDEX local_runner_jobs_confirmed ON public.local_runner_jobs (user_id, confirmed_at) WHERE status = 'applied_confirmed';

CREATE TABLE public.local_runner_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX local_runner_events_recent ON public.local_runner_events (user_id, id DESC);
ALTER TABLE public.local_runner_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.local_runner_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.local_runner_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.local_runner_control, public.local_runner_jobs, public.local_runner_events FROM anon, authenticated;
GRANT ALL ON public.local_runner_control, public.local_runner_jobs, public.local_runner_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.local_runner_events_id_seq TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('runner-evidence', 'runner-evidence', false, 2000000, ARRAY['image/jpeg'])
ON CONFLICT (id) DO NOTHING;

CREATE FUNCTION public.local_runner_heartbeat(p_hash text, p_instance uuid)
RETURNS SETOF public.local_runner_control LANGUAGE sql SET search_path = public AS $$
  UPDATE public.local_runner_control SET last_seen_at = now(), instance_id = p_instance
  WHERE token_hash = p_hash
    AND (instance_id IS NULL OR instance_id = p_instance OR last_seen_at < now() - interval '90 seconds')
  RETURNING *;
$$;

CREATE FUNCTION public.local_runner_reserve(p_user uuid, p_hash text, p_generation uuid, p_instance uuid, p_job uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  control public.local_runner_control;
  job public.local_runner_jobs;
  daily_target int;
  opted_in boolean;
  platform_limit int;
  local_now timestamp := now() AT TIME ZONE 'America/Sao_Paulo';
  day_start timestamptz := date_trunc('day', local_now) AT TIME ZONE 'America/Sao_Paulo';
BEGIN
  SELECT * INTO control FROM local_runner_control WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND OR control.token_hash IS DISTINCT FROM p_hash OR control.instance_id IS DISTINCT FROM p_instance
    OR control.generation <> p_generation OR NOT control.enabled
    OR control.last_seen_at < now() - interval '90 seconds'
    OR extract(isodow FROM local_now) > 5 OR local_now::time < time '09:00' OR local_now::time >= time '18:00' THEN
    RETURN false;
  END IF;
  SELECT direct_submission_enabled, COALESCE(limite_diario, 25)
    INTO opted_in, daily_target FROM profiles WHERE user_id = p_user FOR SHARE;
  IF opted_in IS DISTINCT FROM true THEN RETURN false; END IF;

  SELECT * INTO job FROM local_runner_jobs WHERE id = p_job AND user_id = p_user FOR UPDATE;
  IF NOT FOUND OR job.status <> 'queued' OR job.attempt_at IS NOT NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM local_runner_jobs WHERE user_id = p_user AND status = 'applying' AND attempt_at > now() - interval '10 minutes')
    OR EXISTS (SELECT 1 FROM applications WHERE user_id = p_user AND
      (vaga_url = job.url OR (lower(trim(vaga)) = lower(trim(job.title)) AND lower(trim(empresa)) = lower(trim(job.company))))
      AND status IN ('enviado', 'confirmed', 'pending_confirmation', 'applied_confirmed', 'applied_unconfirmed')) THEN
    RETURN false;
  END IF;

  platform_limit := COALESCE((control.platform_limits ->> job.platform)::int, 30);
  IF (SELECT count(*) FROM local_runner_jobs WHERE user_id = p_user AND attempt_at >= day_start) >= daily_target
    OR (SELECT count(*) FROM local_runner_jobs WHERE user_id = p_user AND platform = job.platform AND attempt_at >= day_start) >= platform_limit THEN
    RETURN false;
  END IF;

  UPDATE local_runner_jobs SET status = 'applying', attempt_at = now(), updated_at = now() WHERE id = job.id;
  RETURN true;
END;
$$;

CREATE FUNCTION public.local_runner_finish(p_user uuid, p_job uuid, p_text text, p_url text, p_screenshot text)
RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  job public.local_runner_jobs;
  app_id uuid;
BEGIN
  SELECT * INTO job FROM local_runner_jobs WHERE user_id = p_user AND id = p_job FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF job.status = 'applied_confirmed' THEN RETURN true; END IF;
  IF job.status NOT IN ('applying', 'applied_unconfirmed') OR job.attempt_at IS NULL THEN RETURN false; END IF;
  IF nullif(trim(p_text), '') IS NULL OR nullif(trim(p_url), '') IS NULL THEN
    UPDATE local_runner_jobs SET status = 'applied_unconfirmed', detail = 'Confira o histórico da plataforma antes de tentar novamente.', updated_at = now() WHERE id = job.id;
    RETURN true;
  END IF;
  UPDATE local_runner_jobs SET status = 'applied_confirmed', confirmed_at = now(), updated_at = now(),
    detail = NULL, confirmation_text = p_text, confirmation_url = p_url, screenshot_path = p_screenshot WHERE id = job.id;
  INSERT INTO applications (user_id, vaga, empresa, plataforma, vaga_url, status, application_url, applied_at)
    VALUES (p_user, job.title, job.company, job.platform, job.url, 'confirmed', p_url, now()) RETURNING id INTO app_id;
  INSERT INTO application_evidence (application_id, user_id, evidence_type, reference, details)
    VALUES (app_id, p_user, 'platform_confirmation', p_url, jsonb_build_object('message', p_text, 'screenshot_path', p_screenshot));
  RETURN true;
END;
$$;

CREATE FUNCTION public.local_runner_metrics(p_user uuid)
RETURNS TABLE(platform text, today bigint, week bigint, month bigint)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT j.platform,
    count(*) FILTER (WHERE j.confirmed_at >= (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')),
    count(*) FILTER (WHERE j.confirmed_at >= (date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')),
    count(*) FILTER (WHERE j.confirmed_at >= (date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'))
  FROM local_runner_jobs j
  WHERE j.user_id = p_user AND j.status = 'applied_confirmed'
    AND j.confirmed_at >= (least(date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo'), date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo')
  GROUP BY j.platform;
$$;

REVOKE EXECUTE ON FUNCTION public.local_runner_heartbeat(text, uuid),
  public.local_runner_reserve(uuid, text, uuid, uuid, uuid),
  public.local_runner_finish(uuid, uuid, text, text, text),
  public.local_runner_metrics(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.local_runner_heartbeat(text, uuid),
  public.local_runner_reserve(uuid, text, uuid, uuid, uuid),
  public.local_runner_finish(uuid, uuid, text, text, text),
  public.local_runner_metrics(uuid) TO service_role;
