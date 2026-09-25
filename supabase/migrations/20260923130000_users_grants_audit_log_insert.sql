-- =============================================================================
-- 20260923130000_users_grants_audit_log_insert.sql
-- Phase 05-slices-3-5-auth-club-authorization-admin-containment · plan 05-16
-- F-006 · F-007 · DEC-47 · 05-RESEARCH.md C3
--
-- FIX FORWARD, NEVER EDIT IN PLACE. `20260915214553_baseline.sql` created the
-- grants, policies and trigger function this file changes, and is not touched.
-- A migration that has been applied anywhere is a historical record; editing
-- one makes two environments that ran "the same" migration diverge with
-- nothing in the history to say so. Every statement below is REVOKE, GRANT,
-- DROP … IF EXISTS followed by CREATE, or CREATE OR REPLACE, so this file
-- supersedes the baseline definitions and is idempotent on its own.
--
-- BLAST RADIUS, STATED PLAINLY. The repository's post-baseline migrations exist
-- locally only; the production migration-history repair is deferred (DI-23,
-- F-045). So this changes no production behaviour today. It changes what every
-- environment built from this repository gets from now on. F-006 and F-007
-- stay Open in the register until the DI-23 repair applies this file to
-- production (DEC-57).
--
-- =============================================================================
-- WHAT WAS WRONG
-- =============================================================================
--
-- F-006. The baseline ends with `GRANT ALL ON TABLE public.users TO anon` and
-- `… TO authenticated`, and the own-row policy is
--
--   CREATE POLICY "Users can update own profile" ON public.users
--     FOR UPDATE USING (auth.uid() = id);
--
-- — a row scope and no column scope. So any signed-in user could send, with
-- their own anon-key JWT,
--
--   PATCH /rest/v1/users?id=eq.<me>   {"roles":["user","admin"]}
--
-- and become an admin; a banned user could PATCH `banned_at: null`; and a
-- signed-in identity with no profile row yet could INSERT one carrying any
-- roles ("Users can insert own profile" checks only the id). Measured on the
-- local stack in 05-RESEARCH.md § D, and red in 050 before this file existed
-- (`evidence/rls-privilege-before.txt`).
--
-- F-007. `admin_audit_log` had two INSERT policies, "Admins can insert audit
-- log" and "Service role can insert audit log", both `WITH CHECK (true)` and
-- neither with a TO clause, so both applied to PUBLIC. With the baseline's
-- `GRANT ALL … TO anon`, an anonymous POST with `Prefer: return=minimal`
-- persisted a forged moderation record naming any admin (§ D, measured).
--
-- =============================================================================
-- WHAT THIS FILE DOES (DEC-47)
-- =============================================================================
--
-- users
--   * UPDATE is revoked from anon and authenticated at table level, then
--     granted back to authenticated on exactly the profile columns the
--     application writes on the cookie client: users/[id] PATCH (name,
--     avatar_url, banner_url, interest_tags, pronouns, year, faculty,
--     visibility, onboarding_completed), profile/avatar, profile/banner,
--     profile/interests, and profile/inferred-tags (inferred_tags — C3: it was
--     missing from the first draft of the list and the route broke under it).
--     Every write of roles, the ban columns or email already goes through the
--     elevated door (05-05, 05-14, 05-15). The grant audit is recorded in
--     `evidence/rls-privilege-before.txt` § 1.
--   * INSERT is revoked from anon and authenticated. The only writer of a
--     users row is the auth callback's elevated upsert (research open point).
--   * The own-row UPDATE policy is re-created `TO authenticated` with a WITH
--     CHECK, so a row can neither be reached by anon nor moved to another id.
--   * `update_saved_events_count()` becomes SECURITY DEFINER. It is the
--     AFTER INSERT OR DELETE trigger on saved_events and updates
--     users.saved_events_count as whoever saved the event. Under the column
--     grant a SECURITY INVOKER body raised "permission denied for table users"
--     on every save (C3, measured). saved_events_count is deliberately NOT
--     granted: users cannot set their own counter.
--
-- admin_audit_log
--   * Both INSERT policies are dropped, and INSERT, UPDATE, DELETE and
--     TRUNCATE are revoked from anon and authenticated. SELECT and the
--     "Admins can read audit log" policy are untouched. The only writer is the
--     service role behind the elevated door (src/lib/audit.ts since 05-14, and
--     the two club routes). TRUNCATE is included because it bypasses RLS
--     entirely, so the privilege is its only barrier.
-- =============================================================================


-- =============================================================================
-- 1. admin_audit_log — F-007
-- =============================================================================

DROP POLICY IF EXISTS "Admins can insert audit log" ON public.admin_audit_log;
DROP POLICY IF EXISTS "Service role can insert audit log" ON public.admin_audit_log;

REVOKE INSERT, UPDATE, DELETE ON public.admin_audit_log FROM anon, authenticated;
REVOKE TRUNCATE ON public.admin_audit_log FROM anon, authenticated;


-- =============================================================================
-- 2. users — F-006: column-scoped UPDATE, no client INSERT
--
--    The REVOKE must come first: revoking a table-level privilege also removes
--    any column-level grant of it, so the order is revoke, then grant.
-- =============================================================================

REVOKE UPDATE ON public.users FROM anon, authenticated;
REVOKE INSERT ON public.users FROM anon, authenticated;

GRANT UPDATE (name, avatar_url, banner_url, pronouns, year, faculty, visibility, interest_tags, inferred_tags, onboarding_completed, updated_at)
  ON public.users TO authenticated;


-- =============================================================================
-- 3. The own-row UPDATE policy, re-created with TO and WITH CHECK
-- =============================================================================

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);


-- =============================================================================
-- 4. The saved-events counter trigger — C3
--
--    Same INSERT/DELETE logic as the baseline, schema-qualified. SECURITY
--    DEFINER with `SET search_path = ''` so the body cannot be redirected to a
--    caller-created `users` in another schema (T-05-16-05). A trigger function
--    is fired by the trigger, never called; PostgreSQL does not check EXECUTE
--    at fire time, so EXECUTE is revoked from every client role.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_saved_events_count()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.users
       SET saved_events_count = saved_events_count + 1
     WHERE id = NEW.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.users
       SET saved_events_count = saved_events_count - 1
     WHERE id = OLD.user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.update_saved_events_count() IS
  'AFTER INSERT OR DELETE trigger on saved_events: keeps '
  'users.saved_events_count in step. SECURITY DEFINER because the F-006 '
  'column grant withholds saved_events_count from authenticated, and the '
  'trigger runs as whoever saved the event (C3, DEC-47).';

REVOKE ALL ON FUNCTION public.update_saved_events_count() FROM PUBLIC, anon, authenticated;
