-- Add 'my-events' to user_interactions.source CHECK constraint
-- Types and API support this source; DB constraint was missing it
ALTER TABLE public.user_interactions
  DROP CONSTRAINT IF EXISTS user_interactions_source_check;

ALTER TABLE public.user_interactions
  ADD CONSTRAINT user_interactions_source_check
  CHECK (
    source IS NULL
    OR source IN (
      'home', 'search', 'recommendation', 'calendar',
      'direct', 'modal', 'my-events'
    )
  );
