-- Migration 003: Add Catho, Sine, Workana, GetNinjas, 99Freelas credentials
-- Run this in Supabase SQL Editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS catho_email      TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS catho_senha      TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sine_email       TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sine_senha       TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS workana_email    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS workana_senha    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS getninjas_email  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS getninjas_senha  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS freelas99_email  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS freelas99_senha  TEXT DEFAULT NULL;
