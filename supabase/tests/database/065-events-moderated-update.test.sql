-- =============================================================================
-- 065-events-moderated-update.test.sql — the events UPDATE ring, in both
-- directions: what a creator can no longer change on their own event through
-- the "Organizers can update own events" policy, and every creator write the
-- application still makes on the cookie client.
--
-- Review fix REVIEW-05 CR-01 against
-- supabase/migrations/20260925120000_events_guard_moderated_update.sql.
--
-- WHAT WAS WRONG. F-008 (20260923120000_events_insert_club_scope.sql) closed
-- the INSERT half: a non-member can only insert a PENDING event into another
-- club (DEC-42). The baseline UPDATE policy
--   "Organizers can update own events" USING (auth.uid() = created_by)
--                                      WITH CHECK (auth.uid() = created_by)
-- has no column or transition limit, so the same creator could then send
--   PATCH /rest/v1/events?id=eq.<id> {"status":"approved"}
-- and publish the event under a club they do not belong to, reverse an admin
-- rejection or suspension, move the event to another club, undo a soft
-- delete, reset appeal_count, and rewrite title / image_url on an APPROVED
-- event without the pending_edits moderation step.
--
-- ASSERTION SHAPES
--   * A refused transition → throws_ok(…, '42501'). The BEFORE UPDATE trigger
--     raises, so the refusal is loud, not a silent USING filter. Every deny
--     row is followed (at the end) by an integrity read as the table owner.
--   * An allowed write → results_eq on RETURNING (the creator can SELECT
--     their own event under "Organizers can view own events"), never lives_ok
--     alone.
--
-- THE FIXTURE AND auth.users (D-21). `events.created_by` references
-- auth.users, which GoTrue owns and this suite never writes. An UPDATE through
-- the creator policy needs a row whose created_by IS the caller, so the file
-- drops `events_created_by_fkey` inside its own transaction before writing the
-- fixture. No auth.users row is written, and the final ROLLBACK restores the
-- constraint (the table owner may drop it; the lock it takes on auth.users is
-- held for this file only). Suppressing the key with
-- `session_replication_role = replica` does not work here: Postgres re-checks
-- the key on an UPDATE of a row inserted by the same transaction, and replica
-- mode would also silence the guard trigger under test. Assertion 1 proves the
-- trigger machinery is live. Everything is inside one transaction and rolled
-- back.
--
-- The fixture uses literal ids in the 00000000-0000-4000-8000-0000000065xx
-- block and no seed row, so the file runs identically unseeded and seeded.
-- =============================================================================

BEGIN;
SELECT plan(32);


-- -----------------------------------------------------------------------------
-- Fixture, written as the session role (owns the tables, bypasses RLS).
--
--   C  creator     — roles {user}, no club membership
--   K  member      — roles {user}, organizer of club A
--   X  admin       — roles {user,admin}
--   A, B           — approved clubs
--
--   e1  C, pending,   club A      (the F-008 self-approval target)
--   e2  C, approved,  club A      (approved by an admin; C is not a member)
--   e3  C, rejected,  club A, appeal_count 0
--   e4  C, suspended, club A, appeal_count 2
--   e5  C, approved,  club A, soft-deleted
--   e6  K, approved,  club A      (the creator IS a member of the club)
--   e7  C, pending,   club A      (the admin approves it)
--   e8  C, pending,   no club     (service role and owner writes)
-- -----------------------------------------------------------------------------

INSERT INTO public.users (id, email, name, roles) VALUES
  ('00000000-0000-4000-8000-000000006501', 'pgtap-065-creator@mail.mcgill.ca', 'T065 Creator C', '{user}'),
  ('00000000-0000-4000-8000-000000006502', 'pgtap-065-member@mail.mcgill.ca',  'T065 Member K',  '{user}'),
  ('00000000-0000-4000-8000-000000006503', 'pgtap-065-admin@mail.mcgill.ca',   'T065 Admin X',   '{user,admin}');

INSERT INTO public.clubs (id, name, description, status) VALUES
  ('00000000-0000-4000-8000-0000000065c1', 'T065 Club A', 'club A', 'approved'),
  ('00000000-0000-4000-8000-0000000065c2', 'T065 Club B', 'club B', 'approved');

INSERT INTO public.club_members (id, user_id, club_id, role) VALUES
  ('00000000-0000-4000-8000-0000000065d1', '00000000-0000-4000-8000-000000006502', '00000000-0000-4000-8000-0000000065c1', 'organizer');

ALTER TABLE public.events DROP CONSTRAINT events_created_by_fkey;

INSERT INTO public.events (id, title, description, start_date, end_date, club_id, created_by, status, appeal_count, deleted_at, image_url) VALUES
  ('00000000-0000-4000-8000-0000000065e1', 'T065 e1', 'd1', '2031-03-01T18:00:00Z', '2031-03-01T20:00:00Z', '00000000-0000-4000-8000-0000000065c1', '00000000-0000-4000-8000-000000006501', 'pending',   0, NULL,  NULL),
  ('00000000-0000-4000-8000-0000000065e2', 'T065 e2', 'd2', '2031-03-02T18:00:00Z', '2031-03-02T20:00:00Z', '00000000-0000-4000-8000-0000000065c1', '00000000-0000-4000-8000-000000006501', 'approved',  0, NULL,  'https://img.test/e2.png'),
  ('00000000-0000-4000-8000-0000000065e3', 'T065 e3', 'd3', '2031-03-03T18:00:00Z', '2031-03-03T20:00:00Z', '00000000-0000-4000-8000-0000000065c1', '00000000-0000-4000-8000-000000006501', 'rejected',  0, NULL,  NULL),
  ('00000000-0000-4000-8000-0000000065e4', 'T065 e4', 'd4', '2031-03-04T18:00:00Z', '2031-03-04T20:00:00Z', '00000000-0000-4000-8000-0000000065c1', '00000000-0000-4000-8000-000000006501', 'suspended', 2, NULL,  NULL),
  ('00000000-0000-4000-8000-0000000065e5', 'T065 e5', 'd5', '2031-03-05T18:00:00Z', '2031-03-05T20:00:00Z', '00000000-0000-4000-8000-0000000065c1', '00000000-0000-4000-8000-000000006501', 'approved',  0, now(), NULL),
  ('00000000-0000-4000-8000-0000000065e6', 'T065 e6', 'd6', '2031-03-06T18:00:00Z', '2031-03-06T20:00:00Z', '00000000-0000-4000-8000-0000000065c1', '00000000-0000-4000-8000-000000006502', 'approved',  0, NULL,  NULL),
  ('00000000-0000-4000-8000-0000000065e7', 'T065 e7', 'd7', '2031-03-07T18:00:00Z', '2031-03-07T20:00:00Z', '00000000-0000-4000-8000-0000000065c1', '00000000-0000-4000-8000-000000006501', 'pending',   0, NULL,  NULL),
  ('00000000-0000-4000-8000-0000000065e8', 'T065 e8', 'd8', '2031-03-08T18:00:00Z', '2031-03-08T20:00:00Z', NULL,                                   '00000000-0000-4000-8000-000000006501', 'pending',   0, NULL,  NULL);


-- =============================================================================
-- Schema shape
-- =============================================================================

-- 1. Triggers fire in this session (no replica mode), so the guard is live.
SELECT is(current_setting('session_replication_role'), 'origin',
          'session_replication_role is origin — ordinary triggers fire');

-- 2
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger t
     WHERE t.tgrelid = 'public.events'::regclass
       AND t.tgname = 'events_guard_moderated_update'
       AND t.tgenabled = 'O'
       AND NOT t.tgisinternal),
  'events_guard_moderated_update is an enabled trigger on public.events');

-- 3
SELECT ok(
  coalesce(
    (SELECT p.proconfig @> ARRAY['search_path=""']
       FROM pg_proc p
      WHERE p.oid = to_regprocedure('public.events_guard_moderated_update()')),
    false),
  'events_guard_moderated_update has an empty search_path');


-- =============================================================================
-- The creator C — refused transitions (CR-01)
-- =============================================================================

SELECT tests.act_as('00000000-0000-4000-8000-000000006501');

-- 4. Impersonation is real, or every deny below passes for the wrong reason.
SELECT is((SELECT auth.uid()), '00000000-0000-4000-8000-000000006501'::uuid,
          'act_as moved auth.uid() to the creator — impersonation is real');

-- 5. THE F-008 BYPASS: pending → approved under a club C is not in.
SELECT throws_ok(
  $q$UPDATE public.events SET status = 'approved'
      WHERE id = '00000000-0000-4000-8000-0000000065e1'$q$,
  '42501', NULL,
  'creator: self-approving a pending event (pending → approved) is refused');

-- 6. Moving the event to another club.
SELECT throws_ok(
  $q$UPDATE public.events SET club_id = '00000000-0000-4000-8000-0000000065c2'
      WHERE id = '00000000-0000-4000-8000-0000000065e1'$q$,
  '42501', NULL,
  'creator: moving a pending event to another club is refused');

-- 7. Moving an APPROVED event to another club (publishes it there).
SELECT throws_ok(
  $q$UPDATE public.events SET club_id = '00000000-0000-4000-8000-0000000065c2'
      WHERE id = '00000000-0000-4000-8000-0000000065e2'$q$,
  '42501', NULL,
  'creator: moving an approved event to another club is refused');

-- 8. Detaching the event from its club.
SELECT throws_ok(
  $q$UPDATE public.events SET club_id = NULL
      WHERE id = '00000000-0000-4000-8000-0000000065e2'$q$,
  '42501', NULL,
  'creator: clearing club_id is refused');

-- 9. Handing the event to somebody else.
SELECT throws_ok(
  $q$UPDATE public.events SET created_by = '00000000-0000-4000-8000-000000006502'
      WHERE id = '00000000-0000-4000-8000-0000000065e1'$q$,
  '42501', NULL,
  'creator: reassigning created_by is refused');

-- 10. Reversing an admin rejection straight to approved.
SELECT throws_ok(
  $q$UPDATE public.events SET status = 'approved'
      WHERE id = '00000000-0000-4000-8000-0000000065e3'$q$,
  '42501', NULL,
  'creator: rejected → approved is refused');

-- 11. Reversing an admin suspension straight to approved.
SELECT throws_ok(
  $q$UPDATE public.events SET status = 'approved'
      WHERE id = '00000000-0000-4000-8000-0000000065e4'$q$,
  '42501', NULL,
  'creator: suspended → approved is refused');

-- 12. Any other status move the creator might make.
SELECT throws_ok(
  $q$UPDATE public.events SET status = 'pending'
      WHERE id = '00000000-0000-4000-8000-0000000065e2'$q$,
  '42501', NULL,
  'creator: approved → pending (not an appeal) is refused');

-- 13. The appeal transition may not reset the appeal counter.
SELECT throws_ok(
  $q$UPDATE public.events SET status = 'pending', appeal_count = 0
      WHERE id = '00000000-0000-4000-8000-0000000065e4'$q$,
  '42501', NULL,
  'creator: an appeal reset that lowers appeal_count is refused');

-- 14. The counter is not writable outside the appeal transition.
SELECT throws_ok(
  $q$UPDATE public.events SET appeal_count = 7
      WHERE id = '00000000-0000-4000-8000-0000000065e1'$q$,
  '42501', NULL,
  'creator: writing appeal_count outside an appeal is refused');

-- 15. Undoing a soft delete.
SELECT throws_ok(
  $q$UPDATE public.events SET deleted_at = NULL
      WHERE id = '00000000-0000-4000-8000-0000000065e5'$q$,
  '42501', NULL,
  'creator: clearing deleted_at (undoing a soft delete) is refused');

-- 16. Rewriting an existing deletion stamp.
SELECT throws_ok(
  $q$UPDATE public.events SET deleted_at = '2030-01-01T00:00:00Z'
      WHERE id = '00000000-0000-4000-8000-0000000065e5'$q$,
  '42501', NULL,
  'creator: rewriting deleted_at on a deleted event is refused');

-- 17. Direct title write on an APPROVED event by a non-member creator: the
-- handler routes it through pending_edits (src/app/api/events/[id]/route.ts
-- MODERATED_FIELDS), and the ring now agrees.
SELECT throws_ok(
  $q$UPDATE public.events SET title = 'T065 e2 renamed directly'
      WHERE id = '00000000-0000-4000-8000-0000000065e2'$q$,
  '42501', NULL,
  'creator (non-member): a direct title write on an approved event is refused');

-- 18. The same for image_url.
SELECT throws_ok(
  $q$UPDATE public.events SET image_url = 'https://img.test/evil.png'
      WHERE id = '00000000-0000-4000-8000-0000000065e2'$q$,
  '42501', NULL,
  'creator (non-member): a direct image_url write on an approved event is refused');


-- =============================================================================
-- The creator C — the writes the application still makes on the cookie client
-- =============================================================================

-- 19. PATCH /api/events/[id] on a pending event: title and description.
SELECT results_eq(
  $q$UPDATE public.events SET title = 'T065 e1 edited', description = 'd1 edited'
      WHERE id = '00000000-0000-4000-8000-0000000065e1'
      RETURNING title || '|' || description || '|' || status$q$,
  ARRAY['T065 e1 edited|d1 edited|pending'],
  'creator: editing title and description of their pending event is allowed');

-- 20. PATCH on an approved event: an unmoderated field is written directly.
SELECT results_eq(
  $q$UPDATE public.events SET description = 'd2 edited', location = 'Leacock 132'
      WHERE id = '00000000-0000-4000-8000-0000000065e2'
      RETURNING description || '|' || location || '|' || status$q$,
  ARRAY['d2 edited|Leacock 132|approved'],
  'creator: editing description and location of their approved event is allowed');

-- 21. PATCH on an approved event: the moderated title goes to pending_edits.
SELECT results_eq(
  $q$UPDATE public.events
        SET pending_edits = '{"title":"T065 e2 proposed","submitted_at":"2031-01-01T00:00:00Z"}'::jsonb
      WHERE id = '00000000-0000-4000-8000-0000000065e2'
      RETURNING pending_edits ->> 'title'$q$,
  ARRAY['T065 e2 proposed'],
  'creator: writing pending_edits on their approved event is allowed (the moderation flow)');

-- 22. POST /api/events/[id]/appeal: rejected → pending, appeal_count + 1.
SELECT results_eq(
  $q$UPDATE public.events SET status = 'pending', appeal_count = appeal_count + 1
      WHERE id = '00000000-0000-4000-8000-0000000065e3' AND status = 'rejected'
      RETURNING status || '|' || appeal_count$q$,
  ARRAY['pending|1'],
  'creator: the appeal reset rejected → pending with appeal_count + 1 is allowed');

-- 23. The same from suspended.
SELECT results_eq(
  $q$UPDATE public.events SET status = 'pending', appeal_count = appeal_count + 1
      WHERE id = '00000000-0000-4000-8000-0000000065e4' AND status = 'suspended'
      RETURNING status || '|' || appeal_count$q$,
  ARRAY['pending|3'],
  'creator: the appeal reset suspended → pending with appeal_count + 1 is allowed');

-- 24. DELETE /api/events/[id]: the soft delete sets deleted_at.
SELECT results_eq(
  $q$UPDATE public.events SET deleted_at = now()
      WHERE id = '00000000-0000-4000-8000-0000000065e1'
      RETURNING deleted_at IS NOT NULL$q$,
  ARRAY[true],
  'creator: soft-deleting their own event (deleted_at NULL → now) is allowed');


-- =============================================================================
-- The member-creator K: a creator who is a member of the event's club edits
-- moderated fields directly, as the handler's needsModeration rule allows.
-- =============================================================================

SELECT tests.act_as('00000000-0000-4000-8000-000000006502');

-- 25
SELECT results_eq(
  $q$UPDATE public.events SET title = 'T065 e6 renamed', image_url = 'https://img.test/e6.png'
      WHERE id = '00000000-0000-4000-8000-0000000065e6'
      RETURNING title || '|' || image_url$q$,
  ARRAY['T065 e6 renamed|https://img.test/e6.png'],
  'member-creator: a direct title and image_url write on their approved club event is allowed');

-- 26. Membership does not unlock the status column.
SELECT throws_ok(
  $q$UPDATE public.events SET status = 'suspended'
      WHERE id = '00000000-0000-4000-8000-0000000065e6'$q$,
  '42501', NULL,
  'member-creator: changing status is still refused');


-- =============================================================================
-- The admin X and the privileged roles
-- =============================================================================

SELECT tests.act_as('00000000-0000-4000-8000-000000006503');

-- 27. PATCH /api/admin/events/[id]/status: the admin approves on the cookie client.
SELECT results_eq(
  $q$UPDATE public.events SET status = 'approved'
      WHERE id = '00000000-0000-4000-8000-0000000065e7'
      RETURNING status$q$,
  ARRAY['approved'],
  'admin: approving a pending event is allowed');

-- 28. The admin may also move the event, restore it, and reset its counter.
SELECT results_eq(
  $q$UPDATE public.events
        SET club_id = '00000000-0000-4000-8000-0000000065c2', deleted_at = NULL, appeal_count = 0
      WHERE id = '00000000-0000-4000-8000-0000000065e5'
      RETURNING club_id::text || '|' || (deleted_at IS NULL)::text$q$,
  ARRAY['00000000-0000-4000-8000-0000000065c2|true'],
  'admin: moving, undeleting and resetting a creator''s event is allowed');

SELECT tests.act_as_owner();
SET LOCAL ROLE service_role;

-- 29. The elevated door (service_role) is not the guard's subject.
SELECT results_eq(
  $q$UPDATE public.events SET status = 'suspended'
      WHERE id = '00000000-0000-4000-8000-0000000065e8'
      RETURNING status$q$,
  ARRAY['suspended'],
  'service_role: a status change is allowed');

RESET ROLE;
SELECT tests.act_as_owner();

-- 30. Neither is the table owner (migrations, seed, pg_cron).
SELECT results_eq(
  $q$UPDATE public.events SET status = 'approved', club_id = '00000000-0000-4000-8000-0000000065c1'
      WHERE id = '00000000-0000-4000-8000-0000000065e8'
      RETURNING status$q$,
  ARRAY['approved'],
  'table owner: a status and club change is allowed');


-- =============================================================================
-- Integrity: every refused write left its row untouched (RLS bypassed).
-- =============================================================================

-- 31
SELECT results_eq(
  $q$SELECT id::text || '|' || status || '|' || coalesce(club_id::text, '-') || '|' ||
            created_by::text || '|' || appeal_count || '|' || title || '|' ||
            coalesce(image_url, '-')
       FROM public.events
      WHERE id IN ('00000000-0000-4000-8000-0000000065e2',
                   '00000000-0000-4000-8000-0000000065e6')
      ORDER BY id$q$,
  ARRAY[
    '00000000-0000-4000-8000-0000000065e2|approved|00000000-0000-4000-8000-0000000065c1|00000000-0000-4000-8000-000000006501|0|T065 e2|https://img.test/e2.png',
    '00000000-0000-4000-8000-0000000065e6|approved|00000000-0000-4000-8000-0000000065c1|00000000-0000-4000-8000-000000006502|0|T065 e6 renamed|https://img.test/e6.png'
  ],
  'e2 kept its status, club, creator, title and image; e6 kept its status');

-- 32
SELECT results_eq(
  $q$SELECT id::text || '|' || status || '|' || coalesce(club_id::text, '-') || '|' ||
            appeal_count || '|' || (deleted_at IS NOT NULL)::text
       FROM public.events
      WHERE id IN ('00000000-0000-4000-8000-0000000065e1',
                   '00000000-0000-4000-8000-0000000065e3',
                   '00000000-0000-4000-8000-0000000065e4')
      ORDER BY id$q$,
  ARRAY[
    '00000000-0000-4000-8000-0000000065e1|pending|00000000-0000-4000-8000-0000000065c1|0|true',
    '00000000-0000-4000-8000-0000000065e3|pending|00000000-0000-4000-8000-0000000065c1|1|false',
    '00000000-0000-4000-8000-0000000065e4|pending|00000000-0000-4000-8000-0000000065c1|3|false'
  ],
  'e1 stayed pending in club A (soft-deleted by 24); e3 and e4 moved only by their appeals');

SELECT * FROM finish();
ROLLBACK;
