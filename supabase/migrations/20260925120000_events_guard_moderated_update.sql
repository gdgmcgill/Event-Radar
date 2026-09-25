-- =============================================================================
-- 20260925120000_events_guard_moderated_update.sql
-- Phase 05-slices-3-5-auth-club-authorization-admin-containment · review fix
-- REVIEW-05 CR-01 · F-008 (the UPDATE half) · DEC-42
--
-- FIX FORWARD, NEVER EDIT IN PLACE. Neither `20260915214553_baseline.sql` (the
-- "Organizers can update own events" policy) nor
-- `20260923120000_events_insert_club_scope.sql` (the F-008 INSERT policy) is
-- touched. This file adds one trigger function and one trigger; both are
-- CREATE OR REPLACE / DROP … IF EXISTS, so the file is idempotent on its own.
--
-- BLAST RADIUS, STATED PLAINLY. Like 20260923120000, this file exists locally
-- only until the production migration-history repair (DI-23, F-045) applies
-- it. It changes no production behaviour today.
--
-- =============================================================================
-- WHAT WAS WRONG (REVIEW-05 CR-01)
-- =============================================================================
--
-- 20260923120000 restricted INSERT: only a member of an approved club may
-- insert an APPROVED event into it; anyone may insert a PENDING event naming
-- any club (DEC-42, deliberately kept). But the baseline UPDATE policy
--
--   CREATE POLICY "Organizers can update own events" ON public.events
--     FOR UPDATE TO authenticated
--     USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
--
-- has no column or transition limit, and `events` is GRANT ALL to
-- authenticated. So with their own anon-key JWT a creator could
--
--   1. POST  /rest/v1/events {"status":"pending","club_id":"<victim club>",…}
--   2. PATCH /rest/v1/events?id=eq.<id> {"status":"approved"}
--
-- and publish an approved event under a club they do not belong to — F-008
-- again, one request later. The same policy let a creator reverse an admin
-- rejection or suspension, move an event between clubs, undo a soft delete,
-- reset appeal_count, and rewrite title / image_url on an approved event
-- without the pending_edits moderation step that PATCH /api/events/[id]
-- applies (MODERATED_FIELDS).
--
-- =============================================================================
-- WHAT THE GUARD NOW SAYS
-- =============================================================================
--
-- A BEFORE UPDATE trigger, so a refusal RAISES 42501 (PostgREST: 403) rather
-- than filtering silently. It applies when the statement runs as one of the
-- API roles (`authenticated`, `anon`) and the caller is not an admin. It does
-- NOT apply to service_role (the registered elevated door), to the table
-- owner (migrations, the seed loader, pg_cron), or to SECURITY DEFINER code.
-- For those callers the columns below are unguarded, exactly as before.
--
--   status        may not change, EXCEPT the appeal transition
--                 rejected | suspended → pending that
--                 POST /api/events/[id]/appeal performs on the cookie client.
--   appeal_count  may not change, EXCEPT that the appeal transition may raise
--                 it (the route writes appeal_count + 1). It may never fall.
--   club_id       may not change (no moving, attaching or detaching).
--   created_by    may not change (WITH CHECK already binds it to the caller;
--                 the trigger makes the refusal explicit and ordered first).
--   deleted_at    may be set on a live event (DELETE /api/events/[id] is a
--                 soft delete on the cookie client), but once set may not be
--                 cleared or rewritten.
--   title,        on an APPROVED event, may change only when the caller is a
--   image_url     member of the event's club — the handler's needsModeration
--                 rule. Everyone else goes through pending_edits and an admin
--                 approval (PATCH /api/admin/events/[id]/edits, which keeps a
--                 key whitelist of its own: REVIEW-05 WR-01).
--
-- `pending_edits` stays writable by the creator: it is the moderation queue,
-- and the admin approval copies only whitelisted keys out of it.
--
-- Every write the application makes on the cookie client still passes:
-- creator edits (PATCH), the soft delete (DELETE), the appeal reset, and every
-- admin write (is_admin()). The pgTAP suite
-- supabase/tests/database/065-events-moderated-update.test.sql pins both
-- directions.
--
-- WHY SECURITY INVOKER. The guard keys on `current_user`, the role PostgREST
-- switched to for the request, rather than on a JWT claim. Under SECURITY
-- DEFINER `current_user` would be the function owner and the guard could no
-- longer tell the API roles from the owner or from service_role. The body
-- calls only `public.is_admin()` and `public.is_club_member(uuid)`, both
-- SECURITY DEFINER helpers already granted to authenticated, so no extra
-- privilege is needed. `SET search_path = ''` with a schema-qualified body
-- closes the mutable search_path hole regardless.
--
-- NOT GUARDED, deliberately: `rsvp_count` and `updated_at` (no moderation
-- meaning), `source`, `source_url`, `content_hash` (provenance written only by
-- the ingestion path and the admin routes). No finding asks for them.
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
  'BEFORE UPDATE guard on public.events (REVIEW-05 CR-01): for a non-admin '
  'caller on the authenticated/anon role, refuses (42501) status changes other '
  'than the appeal reset, appeal_count changes outside it, club_id and '
  'created_by changes, un-deleting, and direct title/image_url writes on an '
  'approved event by a non-member of its club.';

REVOKE ALL ON FUNCTION public.events_guard_moderated_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.events_guard_moderated_update() FROM anon;
REVOKE ALL ON FUNCTION public.events_guard_moderated_update() FROM authenticated;

DROP TRIGGER IF EXISTS events_guard_moderated_update ON public.events;
CREATE TRIGGER events_guard_moderated_update
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.events_guard_moderated_update();
