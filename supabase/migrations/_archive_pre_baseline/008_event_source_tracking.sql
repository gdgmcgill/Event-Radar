-- Add source tracking columns to events table
-- Tracks where an event was ingested from and links back to the original post

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual', 'instagram', 'admin'));

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS source_url TEXT;
