-- Add content_hash column for duplicate detection
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Unique index on content_hash (only where not null, so existing events without hash are fine)
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_content_hash
  ON public.events(content_hash)
  WHERE content_hash IS NOT NULL;

-- Backfill existing events with content hashes
UPDATE public.events
SET content_hash = encode(
  sha256(
    convert_to(
      lower(trim(title)) || '|' || date_trunc('day', start_date)::text || '|' || lower(trim(COALESCE(organizer, ''))),
      'UTF8'
    )
  ),
  'hex'
)
WHERE content_hash IS NULL;
