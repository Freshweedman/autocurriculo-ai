BEGIN;
CREATE OR REPLACE FUNCTION public.public_apply_reserve(p_run uuid, p_job uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path=public AS $$
DECLARE j public.public_application_queue; u uuid; daily_limit integer;
  day_start timestamptz := date_trunc('day',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
BEGIN
  SELECT user_id INTO u FROM automation_runs WHERE id=p_run AND status='running' AND summary->>'mode'='public_form_apply' FOR UPDATE;
  IF u IS NULL THEN RETURN false; END IF;
  SELECT COALESCE(public_apply_daily_limit,20) INTO daily_limit FROM profiles WHERE user_id=u;
  PERFORM pg_advisory_xact_lock(9415381);
  SELECT * INTO j FROM public_application_queue WHERE id=p_job AND run_id=p_run AND user_id=u FOR UPDATE;
  IF NOT FOUND OR j.status <> 'checking' OR j.approved_at IS NULL OR j.approved_at < now()-interval '24 hours' OR j.attempted_at IS NOT NULL THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM resumes WHERE id=j.resume_id AND user_id=u)
    OR EXISTS (SELECT 1 FROM applications WHERE user_id=u AND vaga_url=j.url AND status IN ('confirmed','submitted_manual','pending_confirmation','enviado','candidatado'))
    OR EXISTS (SELECT 1 FROM public_application_queue WHERE user_id=u AND source=j.source AND attempted_at >= now()-interval '7 days')
    OR (SELECT count(*) FROM public_application_queue WHERE user_id=u AND attempted_at>=day_start) >= daily_limit
    OR (SELECT count(*) FROM public_application_queue WHERE attempted_at>=day_start) >= 50 THEN RETURN false; END IF;
  UPDATE public_application_queue SET status='applying', attempted_at=now(), updated_at=now() WHERE id=p_job;
  RETURN true;
END;
$$;
COMMIT;
