-- =============================================================================
-- 010-fk-indexes.test.sql — every index REFAC-02 depends on, by table and column
-- Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · plan 03-05
--
-- An index has no behaviour to characterize, only presence — so a presence
-- assertion is the honest ceiling here, and this file does not pretend
-- otherwise. What it does refuse to do is assert a NAME. Every assertion below
-- names the schema, the table and the ordered column list, so it cannot be
-- satisfied by an index that happens to share a name while covering something
-- else.
--
-- Three assertions go further than presence. The two trigram indexes are
-- asserted to be GIN, because a btree index on the same column would exist,
-- pass a name check, and do nothing for the similarity operator. And all three
-- of the load-bearing indexes are asserted to be USABLE by the predicate they
-- were created for, by reading the plan. Presence is not usability.
--
-- `enable_seqscan` is turned off for this transaction before the plan
-- assertions. On an empty table a sequential scan is free, so "did the planner
-- choose it" is not a stable question; "can the planner use it at all" is.
-- =============================================================================

BEGIN;
SELECT plan(23);


-- -----------------------------------------------------------------------------
-- 1. The nine foreign-key indexes from the archived
--    `20260316000004_fk_indexes_and_cleanup.sql`.
--
--    This plan deliberately does NOT re-issue that file: all nine names were
--    measured live in production and are already carried by the baseline, so
--    re-issuing would be dead SQL. REFAC-02's truth, however, is about the
--    STATE of the database and not about which migration produced it — so the
--    nine are asserted here anyway. That keeps the requirement proven by a
--    database test rather than by an argument about provenance, and it means a
--    future drop of any of them turns this file red.
-- -----------------------------------------------------------------------------

SELECT is(tests.index_columns('public', 'club_invitations', 'idx_club_invitations_inviter_id'),
          ARRAY['inviter_id'],
          'idx_club_invitations_inviter_id covers club_invitations(inviter_id)');

SELECT is(tests.index_columns('public', 'event_reports', 'idx_event_reports_reviewed_by'),
          ARRAY['reviewed_by'],
          'idx_event_reports_reviewed_by covers event_reports(reviewed_by)');

SELECT is(tests.index_columns('public', 'featured_clubs', 'idx_featured_clubs_club_id'),
          ARRAY['club_id'],
          'idx_featured_clubs_club_id covers featured_clubs(club_id)');

SELECT is(tests.index_columns('public', 'featured_clubs', 'idx_featured_clubs_created_by'),
          ARRAY['created_by'],
          'idx_featured_clubs_created_by covers featured_clubs(created_by)');

SELECT is(tests.index_columns('public', 'featured_events', 'idx_featured_events_created_by'),
          ARRAY['created_by'],
          'idx_featured_events_created_by covers featured_events(created_by)');

SELECT is(tests.index_columns('public', 'feedback', 'idx_feedback_user_id'),
          ARRAY['user_id'],
          'idx_feedback_user_id covers feedback(user_id)');

SELECT is(tests.index_columns('public', 'notifications', 'idx_notifications_club_id'),
          ARRAY['club_id'],
          'idx_notifications_club_id covers notifications(club_id)');

SELECT is(tests.index_columns('public', 'organizer_requests', 'idx_organizer_requests_reviewed_by'),
          ARRAY['reviewed_by'],
          'idx_organizer_requests_reviewed_by covers organizer_requests(reviewed_by)');

SELECT is(tests.index_columns('public', 'users', 'idx_users_banned_by'),
          ARRAY['banned_by'],
          'idx_users_banned_by covers users(banned_by)');


-- -----------------------------------------------------------------------------
-- 2. The six indexes 20260915230000_fk_indexes_and_policy_gaps.sql adds.
-- -----------------------------------------------------------------------------

-- F-015. The predicate of the anonymous feed policy, plus the feed's ordering.
SELECT is(tests.index_columns('public', 'events', 'idx_events_status_start_date'),
          ARRAY['status', 'start_date'],
          'idx_events_status_start_date covers events(status, start_date)');

SELECT ok(tests.index_is_partial('public', 'events', 'idx_events_status_start_date'),
          'idx_events_status_start_date is partial — it indexes only non-deleted rows');

-- F-020.
SELECT is(tests.index_columns('public', 'featured_events', 'idx_featured_events_window'),
          ARRAY['starts_at', 'ends_at'],
          'idx_featured_events_window covers featured_events(starts_at, ends_at)');

SELECT ok(NOT tests.index_is_partial('public', 'featured_events', 'idx_featured_events_window'),
          'idx_featured_events_window is unfiltered — the policy window has no row subset');

SELECT is(tests.index_columns('public', 'moderation_reviews', 'idx_moderation_reviews_author_action'),
          ARRAY['author_id', 'action'],
          'idx_moderation_reviews_author_action covers moderation_reviews(author_id, action)');

-- rls-review.md § 5, adjacent observation.
SELECT is(tests.index_columns('public', 'recommendation_feedback', 'idx_recommendation_feedback_event_id'),
          ARRAY['event_id'],
          'idx_recommendation_feedback_event_id covers recommendation_feedback(event_id)');

-- The two trigram indexes public.search_events_fuzzy was written for.
SELECT is(tests.index_columns('public', 'events', 'idx_events_title_trgm'),
          ARRAY['title'],
          'idx_events_title_trgm covers events(title)');

SELECT is(tests.index_columns('public', 'events', 'idx_events_description_trgm'),
          ARRAY['description'],
          'idx_events_description_trgm covers events(description)');

-- Access method, not just column. A btree index on events(title) would satisfy
-- every assertion above and do nothing whatsoever for the similarity operator.
SELECT is(tests.index_am('public', 'events', 'idx_events_title_trgm'), 'gin',
          'idx_events_title_trgm is a GIN index, so the similarity operator can use it');

SELECT is(tests.index_am('public', 'events', 'idx_events_description_trgm'), 'gin',
          'idx_events_description_trgm is a GIN index, so the similarity operator can use it');


-- -----------------------------------------------------------------------------
-- 3. Usability. The index appears in the plan for the predicate it exists to
--    serve — the claim that presence alone cannot support.
-- -----------------------------------------------------------------------------

SET LOCAL enable_seqscan = off;

-- public.search_events_fuzzy's own WHERE clause, reduced to its similarity half.
SELECT matches(
  tests.explain_text(
    $q$SELECT e.id FROM public.events e
        WHERE e.title % 'concert' OR e.description % 'concert'$q$),
  'idx_events_title_trgm',
  'the fuzzy-search title predicate plans through idx_events_title_trgm');

SELECT matches(
  tests.explain_text(
    $q$SELECT e.id FROM public.events e
        WHERE e.title % 'concert' OR e.description % 'concert'$q$),
  'idx_events_description_trgm',
  'the fuzzy-search description predicate plans through idx_events_description_trgm');

-- `Approved events are viewable by everyone` — USING (status = 'approved') —
-- against the feed's own ordering and soft-delete filter.
SELECT matches(
  tests.explain_text(
    $q$SELECT e.id FROM public.events e
        WHERE e.status = 'approved' AND e.deleted_at IS NULL
        ORDER BY e.start_date$q$),
  'idx_events_status_start_date',
  'the anonymous feed predicate plans through idx_events_status_start_date');


-- -----------------------------------------------------------------------------
-- 4. F-049 — the orphaned relation is gone and stays gone.
-- -----------------------------------------------------------------------------

SELECT hasnt_table('public', 'events_tests',
                   'public.events_tests does not exist — the out-of-band test table is dropped');


SELECT * FROM finish();
ROLLBACK;
