-- =============================================================================
-- 20260925130000_events_guard_appeal_increment.sql
-- Phase 05-slices-3-5-auth-club-authorization-admin-containment · review fix
-- REVIEW-05 iter3 WR-02 · follows 20260925120000 (REVIEW-05 CR-01) · F-008
--
-- FIX FORWARD, NEVER EDIT IN PLACE. `20260925120000_events_guard_moderated_update.sql`
-- is not touched. This file replaces the body of the trigger function it
-- created (CREATE OR REPLACE FUNCTION, same name, same signature), so the
-- trigger `events_guard_moderated_update` picks the new body up without being
-- recreated. The file is idempotent on its own.
--
-- BLAST RADIUS, STATED PLAINLY. Like 20260925120000, this file exists locally
-- only until the production migration-history repair (DI-23, F-045) applies
-- it. It changes no production behaviour today.
--
-- =============================================================================
-- WHAT WAS WRONG (REVIEW-05 iter3 WR-02)
-- =============================================================================
--
-- 20260925120000's appeal arm admitted ANY `rejected | suspended → pending`
-- update, and its counter check refused only a DECREASE of appeal_count (or a
-- change outside the appeal). So a creator could skip
-- POST /api/events/[id]/appeal and send, with their own anon-key JWT,
--
--   PATCH /rest/v1/events?id=eq.<id> {"status":"pending"}
--
-- and the rejected event went back to the ordinary pending queue with:
--   * no `moderation_reviews` appeal row and no admin notification;
--   * appeal_count unchanged, so the moderation dashboard, which sorts
--     appeals with `.gt("appeal_count", 0)`, showed it as a first-time
--     submission with its rejection history out of view;
--   * no limit on repeating it.
--
-- =============================================================================
-- WHAT THE GUARD NOW SAYS
-- =============================================================================
--
-- Everything 20260925120000 says, plus ONE rule: the appeal transition must
-- raise appeal_count by EXACTLY one. That is the write the appeal route makes
-- on the cookie client (`appeal_count: (event.appeal_count ?? 0) + 1`, filtered
-- on the old status), so the route still passes and the direct reset does not.
-- The existing "may never fall" and "not outside an appeal" checks are kept.
--
-- Not added, deliberately: forbidding content changes inside the appeal
-- statement. A rejected event is not `approved`, so the creator may already
-- edit its title and image through PATCH /api/events/[id] before appealing;
-- refusing them in the same statement would add nothing.
--
-- Admins, service_role and the table owner stay outside the guard, exactly as
-- before. The pgTAP suite
-- supabase/tests/database/066-events-appeal-increment.test.sql pins both
-- directions; 065 continues to pin the rest of the guard.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.events_guard_moderated_update()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_is_appeal boolean;
BEGIN
  -- Only the API roles are subject to the guard.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  -- Admins moderate: every transition stays open to them.
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  v_is_appeal := OLD.status IN ('rejected', 'suspended')
                 AND NEW.status = 'pending';

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT v_is_appeal THEN
    RAISE EXCEPTION 'events.status is moderated: % → % is not permitted',
      OLD.status, NEW.status
      USING ERRCODE = '42501',
            HINT = 'Only an admin changes an event''s status; a creator may appeal a rejected or suspended event back to pending.';
  END IF;

  IF NEW.appeal_count < OLD.appeal_count
     OR (NEW.appeal_count <> OLD.appeal_count AND NOT v_is_appeal) THEN
    RAISE EXCEPTION 'events.appeal_count is moderated'
      USING ERRCODE = '42501';
  END IF;

  -- REVIEW-05 iter3 WR-02: the appeal reset is only an appeal when it is
  -- counted. appeal_count is NOT NULL, so there is no NULL path around this.
  IF v_is_appeal AND NEW.appeal_count <> OLD.appeal_count + 1 THEN
    RAISE EXCEPTION 'events: an appeal must raise appeal_count by exactly one'
      USING ERRCODE = '42501',
            HINT = 'Appeal through POST /api/events/[id]/appeal.';
  END IF;

  IF NEW.club_id IS DISTINCT FROM OLD.club_id THEN
    RAISE EXCEPTION 'events.club_id is moderated'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'events.created_by is not writable'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.deleted_at IS NOT NULL
     AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION 'events.deleted_at: a deleted event cannot be restored or re-stamped'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.status = 'approved'
     AND (NEW.title IS DISTINCT FROM OLD.title
          OR NEW.image_url IS DISTINCT FROM OLD.image_url)
     AND NOT (OLD.club_id IS NOT NULL
              AND public.is_club_member(OLD.club_id)) THEN
    RAISE EXCEPTION 'events.title and events.image_url on an approved event are moderated'
      USING ERRCODE = '42501',
            HINT = 'Submit the change through pending_edits for admin approval.';
  END IF;

  RETURN NEW;
END
$$;

COMMENT ON FUNCTION public.events_guard_moderated_update() IS
  'BEFORE UPDATE guard on public.events (REVIEW-05 CR-01, iter3 WR-02): for a '
  'non-admin caller on the authenticated/anon role, refuses (42501) status '
  'changes other than the appeal reset, an appeal reset that does not raise '
  'appeal_count by exactly one, appeal_count changes outside it, club_id and '
  'created_by changes, un-deleting, and direct title/image_url writes on an '
  'approved event by a non-member of its club.';

-- CREATE OR REPLACE keeps the existing ACL; restated so the file stands alone.
REVOKE ALL ON FUNCTION public.events_guard_moderated_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.events_guard_moderated_update() FROM anon;
REVOKE ALL ON FUNCTION public.events_guard_moderated_update() FROM authenticated;
