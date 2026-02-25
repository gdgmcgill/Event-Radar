-- Ensure users table has name and avatar_url columns (used by auth callback and profile)
-- Handles schema drift: 001 used full_name; code expects name
-- Safe to run idempotently

-- Add name column if missing (migrate from full_name if it exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'name'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'full_name'
    ) THEN
      ALTER TABLE public.users ADD COLUMN name TEXT;
      UPDATE public.users SET name = full_name WHERE full_name IS NOT NULL;
      -- Optionally drop full_name later; keeping for now to avoid breaking any reads
    ELSE
      ALTER TABLE public.users ADD COLUMN name TEXT;
    END IF;
  END IF;
END $$;

-- Add avatar_url if missing
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
