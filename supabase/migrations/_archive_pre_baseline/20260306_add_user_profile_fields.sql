-- Add profile enrichment columns
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS pronouns text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS year text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS faculty text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

-- Backfill: existing users have already "onboarded"
UPDATE public.users SET onboarding_completed = true WHERE onboarding_completed = false;
