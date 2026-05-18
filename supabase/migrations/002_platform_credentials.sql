-- Migration 002: Platform credentials stored per user
-- Run this in Supabase SQL Editor

-- Add platform credential columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS indeed_email    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS indeed_senha    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS linkedin_email  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS linkedin_senha  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS infojobs_email  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS infojobs_senha  TEXT DEFAULT NULL;

-- The existing RLS policies already cover SELECT/UPDATE on profiles,
-- so users can only read/write their own credentials.

-- Service role (used by bot webhook) can read all profiles — already allowed
-- because service role bypasses RLS entirely.
