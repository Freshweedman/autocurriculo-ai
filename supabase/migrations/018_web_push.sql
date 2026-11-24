BEGIN;
CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL, p256dh text NOT NULL, auth text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.web_push_subscriptions;
CREATE POLICY "Users manage own push subscriptions" ON public.web_push_subscriptions FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
COMMIT;
