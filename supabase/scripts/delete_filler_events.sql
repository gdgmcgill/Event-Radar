-- =============================================================================
-- Delete filler events created by seed_filler_events.sql
-- Run in Supabase SQL Editor.
-- =============================================================================

DELETE FROM public.events WHERE title LIKE 'Filler%';

ANALYZE public.events;
