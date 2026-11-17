-- Direct submission is an explicit, per-account opt-in. Scheduled runs never
-- submit applications; they remain discovery-only.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS direct_submission_enabled BOOLEAN NOT NULL DEFAULT false;
