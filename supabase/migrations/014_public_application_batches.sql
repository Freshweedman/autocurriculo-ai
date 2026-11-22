BEGIN;

CREATE TABLE public.public_application_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.automation_runs(id) ON DELETE SET NULL,
  resume_id uuid REFERENCES public.resumes(id) ON DELETE SET NULL,
  title text NOT NULL,
  company text,
  source text NOT NULL,
  url text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN
    ('queued','checking','ready','approved','applying','confirmed','needs_action','unconfirmed')),
  reason text,
  approved_at timestamptz,
  attempted_at timestamptz,
  confirmed_at timestamptz,
  proof_path text,
  proof_text text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, url),
  CHECK (status <> 'confirmed' OR (confirmed_at IS NOT NULL AND proof_path IS NOT NULL AND proof_text IS NOT NULL))
);

CREATE INDEX public_application_owner_queue ON public.public_application_queue(user_id, status, updated_at);
CREATE INDEX public_application_attempts ON public.public_application_queue(user_id, attempted_at) WHERE attempted_at IS NOT NULL;
CREATE UNIQUE INDEX public_application_active_run ON public.automation_runs(user_id)
  WHERE status IN ('queued','running') AND summary->>'mode' IN ('public_form_inspect','public_form_apply');

CREATE TABLE public.public_application_answers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.public_application_telegram (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id text UNIQUE,
  pair_hash text UNIQUE,
  expires_at timestamptz
);

ALTER TABLE public.public_application_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_application_telegram ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_application_answers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_application_queue, public.public_application_telegram, public.public_application_answers FROM anon, authenticated;
GRANT ALL ON public.public_application_queue, public.public_application_telegram, public.public_application_answers TO service_role;

CREATE FUNCTION public.public_apply_sync(p_user uuid)
RETURNS void LANGUAGE sql SET search_path=public AS $$
  INSERT INTO public_application_queue(user_id, opportunity_id, title, company, source, url, status, reason)
  SELECT p_user, o.id, o.title, o.company, o.source, o.canonical_url,
    CASE WHEN o.source IN ('Greenhouse','Lever','Ashby','Workable','Recruitee') THEN 'queued' ELSE 'needs_action' END,
    CASE WHEN o.source NOT IN ('Greenhouse','Lever','Ashby','Workable','Recruitee') THEN 'unsupported' END
  FROM user_opportunities u JOIN opportunities o ON o.id=u.opportunity_id
  WHERE u.user_id=p_user AND u.status <> 'dismissed' AND o.status='active'
    AND o.canonical_url LIKE 'https://%'
    AND NOT EXISTS (SELECT 1 FROM public_application_queue q WHERE q.user_id=p_user AND q.url=o.canonical_url)
    AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.user_id=p_user AND a.vaga_url=o.canonical_url
      AND a.status IN ('confirmed','submitted_manual','pending_confirmation','enviado','candidatado'))
  ORDER BY u.created_at DESC LIMIT 60
  ON CONFLICT DO NOTHING;
$$;

CREATE FUNCTION public.public_apply_approve(p_user uuid, p_jobs uuid[])
RETURNS integer LANGUAGE plpgsql SET search_path=public AS $$
DECLARE
  resume uuid;
  changed integer;
BEGIN
  IF cardinality(p_jobs) < 1 OR cardinality(p_jobs) > 10 THEN RETURN 0; END IF;
  SELECT r.id INTO resume FROM resumes r WHERE r.user_id=p_user AND r.is_default;
  IF resume IS NULL THEN RETURN 0; END IF;
  UPDATE public_application_queue SET status='approved', approved_at=now(), resume_id=resume, updated_at=now(), reason=NULL
    WHERE user_id=p_user AND id=ANY(p_jobs) AND status='ready' AND attempted_at IS NULL
      AND updated_at > now() - interval '7 days';
  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN changed;
END;
$$;

CREATE FUNCTION public.public_apply_claim(p_run uuid)
RETURNS SETOF public.public_application_queue LANGUAGE plpgsql SET search_path=public AS $$
DECLARE active_run public.automation_runs; picked uuid; mode text;
BEGIN
  SELECT * INTO active_run FROM automation_runs WHERE id=p_run AND status='running' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  mode := active_run.summary->>'mode';
  IF mode NOT IN ('public_form_inspect','public_form_apply') THEN RETURN; END IF;
  SELECT q.id INTO picked FROM public_application_queue q
  WHERE q.user_id=active_run.user_id
    AND q.status=CASE WHEN mode='public_form_apply' THEN 'approved' ELSE 'queued' END
    AND (mode <> 'public_form_apply' OR q.approved_at > now() - interval '24 hours')
    AND EXISTS (SELECT 1 FROM opportunities o WHERE o.id=q.opportunity_id AND o.status='active' AND o.canonical_url=q.url)
    AND EXISTS (SELECT 1 FROM user_opportunities u WHERE u.user_id=q.user_id AND u.opportunity_id=q.opportunity_id AND u.status <> 'dismissed')
  ORDER BY q.updated_at DESC LIMIT 1 FOR UPDATE OF q SKIP LOCKED;
  IF picked IS NULL THEN RETURN; END IF;
  RETURN QUERY UPDATE public_application_queue SET status='checking', run_id=p_run, updated_at=now()
    WHERE id=picked RETURNING *;
END;
$$;

CREATE FUNCTION public.public_apply_reserve(p_run uuid, p_job uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path=public AS $$
DECLARE
  j public.public_application_queue;
  u uuid;
  day_start timestamptz := date_trunc('day',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
BEGIN
  SELECT user_id INTO u FROM automation_runs
    WHERE id=p_run AND status='running' AND summary->>'mode'='public_form_apply' FOR UPDATE;
  IF u IS NULL THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(9415381);
  SELECT * INTO j FROM public_application_queue WHERE id=p_job AND run_id=p_run AND user_id=u FOR UPDATE;
  IF NOT FOUND OR j.status <> 'checking' OR j.approved_at IS NULL OR j.approved_at < now()-interval '24 hours' OR j.attempted_at IS NOT NULL THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM resumes WHERE id=j.resume_id AND user_id=u)
    OR EXISTS (SELECT 1 FROM applications WHERE user_id=u AND vaga_url=j.url
      AND status IN ('confirmed','submitted_manual','pending_confirmation','enviado','candidatado'))
    OR (SELECT count(*) FROM public_application_queue WHERE user_id=u AND attempted_at>=day_start) >= 10
    OR (SELECT count(*) FROM public_application_queue WHERE attempted_at>=day_start) >= 50 THEN RETURN false; END IF;
  UPDATE public_application_queue SET status='applying', attempted_at=now(), updated_at=now() WHERE id=p_job;
  RETURN true;
END;
$$;

CREATE FUNCTION public.public_apply_complete(p_run uuid, p_job uuid, p_path text, p_proof text)
RETURNS boolean LANGUAGE plpgsql SET search_path=public AS $$
DECLARE j public.public_application_queue; app_id uuid;
BEGIN
  SELECT * INTO j FROM public_application_queue WHERE id=p_job AND run_id=p_run FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF j.status='confirmed' THEN RETURN true; END IF;
  IF j.status <> 'applying' OR p_path <> j.user_id::text || '/public-' || j.id::text || '.jpg' OR nullif(trim(p_proof),'') IS NULL
    THEN RETURN false; END IF;
  UPDATE public_application_queue SET status='confirmed', confirmed_at=now(), updated_at=now(), proof_path=p_path,
    proof_text=p_proof, reason=NULL WHERE id=p_job;
  INSERT INTO applications(user_id, opportunity_id, resume_id, vaga, empresa, plataforma, vaga_url, status, applied_at)
    VALUES(j.user_id,j.opportunity_id,j.resume_id,j.title,j.company,j.source,j.url,'confirmed',now()) RETURNING id INTO app_id;
  INSERT INTO application_evidence(application_id,user_id,evidence_type,reference,details)
    VALUES(app_id,j.user_id,'platform_confirmation',j.url,jsonb_build_object('message',p_proof,'screenshot_path',p_path));
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.public_apply_sync(uuid),public.public_apply_approve(uuid,uuid[]),public.public_apply_claim(uuid),
  public.public_apply_reserve(uuid,uuid),public.public_apply_complete(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.public_apply_sync(uuid),public.public_apply_approve(uuid,uuid[]),public.public_apply_claim(uuid),
  public.public_apply_reserve(uuid,uuid),public.public_apply_complete(uuid,uuid,text,text) TO service_role;

COMMIT;
