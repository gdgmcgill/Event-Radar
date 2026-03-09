-- =============================================================================
-- SEED: filler events for benchmarking index performance
-- Run in Supabase SQL Editor. Inserts ~1 130 events designed so that every
-- query in benchmark_events_queries.sql returns at least several rows.
-- Delete when done: run supabase/scripts/delete_filler_events.sql
-- =============================================================================

-- ── 1. Main bulk: 1 000 events with varied dates, statuses, and tags ──────────
-- start_date spans −30 d → +970 d so Q1/Q2/Q3 see dense future data.
-- created_at cycles over last 90 d → Q11 (last-30-day window) sees ~333 rows.
-- Tags cycle through real EventTag values → Q6 (academic) gets ~200 rows.
INSERT INTO public.events (
  title,
  description,
  start_date,
  end_date,
  location,
  club_id,
  tags,
  status,
  created_at,
  updated_at
)
SELECT
  'Filler event ' || i,
  'Filler description for testing query performance. ' || md5(i::text),
  NOW() + ((i - 30) || ' days')::interval,
  NOW() + ((i - 30) || ' days')::interval + INTERVAL '2 hours',
  CASE (i % 5)
    WHEN 0 THEN 'Room A'
    WHEN 1 THEN 'Room B'
    WHEN 2 THEN 'Online'
    WHEN 3 THEN 'Leacock'
    ELSE 'Campus'
  END,
  (SELECT id FROM public.clubs ORDER BY id LIMIT 1 OFFSET (i % 3)),
  CASE (i % 5)
    WHEN 0 THEN ARRAY['academic', 'filler']::text[]
    WHEN 1 THEN ARRAY['social',   'filler']::text[]
    WHEN 2 THEN ARRAY['sports',   'filler']::text[]
    WHEN 3 THEN ARRAY['career',   'filler']::text[]
    ELSE        ARRAY['cultural', 'filler']::text[]
  END,
  CASE WHEN i % 10 = 0 THEN 'pending' ELSE 'approved' END,
  NOW() - ((i % 90) || ' days')::interval,
  NOW()
FROM generate_series(1, 1000) AS i;


-- ── 2. Q4 — happening-now: 20 approved events starting within the next 2h ────
-- start_date steps 6 min apart → all 20 land inside the NOW()..NOW()+2h window.
INSERT INTO public.events (
  title, description,
  start_date, end_date,
  location, club_id, tags, status, created_at, updated_at
)
SELECT
  'Filler happening-now ' || i,
  'Short-window filler event for the happening-now benchmark.',
  NOW() + (i * 6 || ' minutes')::interval,
  NOW() + (i * 6 || ' minutes')::interval + INTERVAL '1 hour',
  'Campus',
  (SELECT id FROM public.clubs ORDER BY id LIMIT 1),
  ARRAY['social', 'filler']::text[],
  'approved',
  NOW() - INTERVAL '1 day',
  NOW()
FROM generate_series(1, 20) AS i;


-- ── 3. Q5 — trigram text search: 30 approved events containing 'mcgill' ──────
-- Both title and description contain the search term to exercise both trgm indexes.
INSERT INTO public.events (
  title, description,
  start_date, end_date,
  location, club_id, tags, status, created_at, updated_at
)
SELECT
  'Filler McGill ' || i || ' event',
  'This filler event is hosted at McGill University for search-index benchmarking.',
  NOW() + (i || ' days')::interval,
  NOW() + (i || ' days')::interval + INTERVAL '2 hours',
  'McGill Campus',
  (SELECT id FROM public.clubs ORDER BY id LIMIT 1),
  ARRAY['academic', 'filler']::text[],
  'approved',
  NOW() - (i || ' days')::interval,
  NOW()
FROM generate_series(1, 30) AS i;


-- ── 4. Q10 — admin trigram title search: 30 events containing 'festival' ──────
INSERT INTO public.events (
  title, description,
  start_date, end_date,
  location, club_id, tags, status, created_at, updated_at
)
SELECT
  'Filler Festival ' || i,
  'Annual filler festival used to test trigram title-search index performance.',
  NOW() + (i * 2 || ' days')::interval,
  NOW() + (i * 2 || ' days')::interval + INTERVAL '3 hours',
  'Lower Field',
  (SELECT id FROM public.clubs ORDER BY id LIMIT 1),
  ARRAY['social', 'cultural', 'filler']::text[],
  CASE WHEN i % 5 = 0 THEN 'pending' ELSE 'approved' END,
  NOW() - (i || ' days')::interval,
  NOW()
FROM generate_series(1, 30) AS i;


-- ── 5. Q12 — created_by index: 50 approved events with creator set ────────────
-- created_by resolves to the first user in public.users (same UUID as auth.users).
-- Q12 discovers the value dynamically, so just needs ≥ 1 non-NULL row.
INSERT INTO public.events (
  title, description,
  start_date, end_date,
  location, club_id, tags, status,
  created_by,
  created_at, updated_at
)
SELECT
  'Filler creator event ' || i,
  'Filler event with creator set for the created_by index benchmark.',
  NOW() + (i || ' days')::interval,
  NOW() + (i || ' days')::interval + INTERVAL '2 hours',
  'Burnside',
  (SELECT id FROM public.clubs ORDER BY id LIMIT 1 OFFSET (i % 3)),
  ARRAY['academic', 'filler']::text[],
  'approved',
  (SELECT id FROM public.users ORDER BY id LIMIT 1),
  NOW() - (i || ' days')::interval,
  NOW()
FROM generate_series(1, 50) AS i;


-- Update stats so the planner has accurate row counts for all queries
ANALYZE public.events;
