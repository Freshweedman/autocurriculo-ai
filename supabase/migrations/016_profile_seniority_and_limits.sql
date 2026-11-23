BEGIN;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS seniority_level text NOT NULL DEFAULT 'pleno' CHECK (seniority_level IN ('junior','pleno','senior'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_apply_daily_limit integer NOT NULL DEFAULT 20 CHECK (public_apply_daily_limit BETWEEN 1 AND 20);
COMMIT;
