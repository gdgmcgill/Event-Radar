-- Enable pg_trgm extension for trigram-based fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Set a reasonable similarity threshold
ALTER DATABASE postgres SET pg_trgm.similarity_threshold = 0.1;

-- Create trigram indexes for fuzzy matching on events
CREATE INDEX IF NOT EXISTS idx_events_title_trgm ON public.events USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_events_description_trgm ON public.events USING GIN (description gin_trgm_ops);

-- RPC function for fuzzy search with ranked results
-- Combines trigram similarity (handles misspellings) with ILIKE (handles exact substring matches)
-- Title matches are weighted 2x more than description matches
CREATE OR REPLACE FUNCTION public.search_events_fuzzy(
  search_term TEXT,
  result_limit INT DEFAULT 50
)
RETURNS TABLE(event_id UUID, rank FLOAT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id AS event_id,
    GREATEST(
      similarity(e.title, search_term) * 2.0,
      similarity(e.description, search_term)
    )::FLOAT AS rank
  FROM public.events e
  WHERE
    e.title % search_term
    OR e.description % search_term
    OR e.title ILIKE '%' || search_term || '%'
    OR e.description ILIKE '%' || search_term || '%'
  ORDER BY rank DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;
