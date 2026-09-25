-- =============================================================================
-- 055-admin-audit-log-insert.test.sql — nobody but the service role writes the
-- audit log: not anonymous callers, not signed-in users, not admins.
--
-- Phase 05-slices-3-5-auth-club-authorization-admin-containment · plan 05-16
-- Covers F-007 (DEC-47) against
-- supabase/migrations/20260923130000_users_grants_audit_log_insert.sql.
--
-- WHAT WAS WRONG. The baseline had two INSERT policies on admin_audit_log,
-- "Admins can insert audit log" and "Service role can insert audit log", both
-- `FOR INSERT WITH CHECK (true)` with no TO clause (so PUBLIC), on a table that
-- granted ALL to anon and authenticated. Anyone holding the anon key could send
--   POST /rest/v1/admin_audit_log   (Prefer: return=minimal)
-- and forge a moderation record naming any admin (05-RESEARCH.md § D, measured).
-- The application's only writer has been the elevated door since 05-14
-- (src/lib/audit.ts, the two club routes).
--
-- ASSERTION SHAPES
--   * Every client-role write → throws_ok(…, '42501'). Table privilege is
--     checked before any row is read or any policy runs, so UPDATE and DELETE
--     raise even on an empty table — which is why this file needs no audit row
--     and no auth.users fixture. Before the migration those UPDATE and DELETE
--     statements completed on zero rows, and the INSERTs got past RLS to the
--     auth.users foreign key (23503): both are reds against the old schema.
--   * No deny INSERT uses RETURNING, so the outcome is the write decision alone
--     and never the SELECT policy's (research § D note).
--   * The service role's INSERT → throws_ok(…, '23503'): privilege and RLS
--     passed and the row reached the auth.users key, which this suite never
--     writes (D-21). A 42501 there would mean the door itself was locked out.
--
-- The fixture uses literal ids in the 00000000-0000-4000-8000-0000000055xx block
-- and no seed row, so the file runs identically unseeded and seeded. One
-- transaction, rolled back.
-- =============================================================================

BEGIN;
SELECT plan(17);


-- -----------------------------------------------------------------------------
-- Fixture, written as the session role.
--
--   A  admin    — roles {user,admin}
--   S  student  — roles {user}
-- -----------------------------------------------------------------------------

INSERT INTO public.users (id, email, name, roles) VALUES
  ('00000000-0000-4000-8000-000000005501', 'pgtap-055-admin@mail.mcgill.ca',   'T055 Admin A',   '{user,admin}'),
  ('00000000-0000-4000-8000-000000005502', 'pgtap-055-student@mail.mcgill.ca', 'T055 Student S', '{user}');


-- =============================================================================
-- Schema shape
-- =============================================================================

-- 1
SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_audit_log'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')),
  0,
  'admin_audit_log has no INSERT, UPDATE, DELETE or ALL policy left');

-- 2
SELECT ok(
  NOT has_table_privilege('anon', 'public.admin_audit_log', 'INSERT, UPDATE, DELETE, TRUNCATE')
  AND NOT has_table_privilege('authenticated', 'public.admin_audit_log', 'INSERT, UPDATE, DELETE, TRUNCATE'),
  'anon and authenticated hold none of INSERT, UPDATE, DELETE, TRUNCATE on admin_audit_log');

-- 3. The read side is untouched: admins still read the log on the cookie
-- client (/moderation, /moderation/audit-log).
SELECT ok(
  has_table_privilege('authenticated', 'public.admin_audit_log', 'SELECT')
  AND EXISTS (SELECT 1 FROM pg_policies
               WHERE schemaname = 'public' AND tablename = 'admin_audit_log'
                 AND policyname = 'Admins can read audit log' AND cmd = 'SELECT'),
  'authenticated keeps SELECT and the "Admins can read audit log" policy is still there');

-- 4
SELECT ok(
  has_table_privilege('service_role', 'public.admin_audit_log', 'INSERT'),
  'service_role keeps INSERT — the elevated door is the writer');


-- =============================================================================
-- The admin — admins included, deliberately
-- =============================================================================

SELECT tests.act_as('00000000-0000-4000-8000-000000005501');

-- 5. FIRST behavioural assertion: impersonation is real.
SELECT is((SELECT auth.uid()), '00000000-0000-4000-8000-000000005501'::uuid,
          'act_as moved auth.uid() to the admin — impersonation is real');

-- 6
SELECT throws_ok(
  $q$INSERT INTO public.admin_audit_log (admin_user_id, action, target_type, target_id)
     VALUES ('00000000-0000-4000-8000-000000005501', 'approved', 'event', 't055-admin')$q$,
  '42501', NULL,
  'admin (F-007): a direct audit insert is refused — the record cannot be written by the actor it records');

-- 7
SELECT throws_ok(
  $q$UPDATE public.admin_audit_log SET action = 'x'$q$,
  '42501', NULL,
  'admin: an UPDATE of the audit log is refused');

-- 8
SELECT throws_ok(
  $q$DELETE FROM public.admin_audit_log$q$,
  '42501', NULL,
  'admin: a DELETE from the audit log is refused');


-- =============================================================================
-- The student
-- =============================================================================

SELECT tests.act_as('00000000-0000-4000-8000-000000005502');

-- 9. The forgery: a student writes a record naming the admin as the actor.
SELECT throws_ok(
  $q$INSERT INTO public.admin_audit_log (admin_user_id, action, target_type, target_id)
     VALUES ('00000000-0000-4000-8000-000000005501', 'banned', 'user', 't055-student')$q$,
  '42501', NULL,
  'student (F-007): forging an audit row in the admin''s name is refused');

-- 10
SELECT throws_ok(
  $q$UPDATE public.admin_audit_log SET action = 'x'$q$,
  '42501', NULL,
  'student: an UPDATE of the audit log is refused');

-- 11
SELECT throws_ok(
  $q$DELETE FROM public.admin_audit_log$q$,
  '42501', NULL,
  'student: a DELETE from the audit log is refused');


-- =============================================================================
-- anonymous — the § D forge (anon key, Prefer: return=minimal)
-- =============================================================================

SELECT tests.act_as_anon();

-- 12
SELECT throws_ok(
  $q$INSERT INTO public.admin_audit_log (admin_user_id, action, target_type, target_id)
     VALUES ('00000000-0000-4000-8000-000000005501', 'deleted', 'club', 't055-anon')$q$,
  '42501', NULL,
  'anonymous (F-007, § D): a forged audit insert without RETURNING is refused');

-- 13
SELECT throws_ok(
  $q$UPDATE public.admin_audit_log SET action = 'x'$q$,
  '42501', NULL,
  'anonymous: an UPDATE of the audit log is refused');

-- 14
SELECT throws_ok(
  $q$DELETE FROM public.admin_audit_log$q$,
  '42501', NULL,
  'anonymous: a DELETE from the audit log is refused');

-- 15. TRUNCATE skips RLS entirely, so the privilege is the only barrier.
SELECT throws_ok(
  $q$TRUNCATE public.admin_audit_log$q$,
  '42501', NULL,
  'anonymous: TRUNCATE of the audit log is refused');


-- =============================================================================
-- The service role — the elevated door's role — still writes
-- =============================================================================

SELECT tests.act_as_owner();
SET LOCAL ROLE service_role;

-- 16. 23503 = privilege and RLS passed; the row reached the auth.users key.
SELECT throws_ok(
  $q$INSERT INTO public.admin_audit_log (admin_user_id, action, target_type, target_id)
     VALUES ('00000000-0000-4000-8000-000000005501', 'approved', 'event', 't055-service')$q$,
  '23503', NULL,
  'service_role: an audit insert passes privilege and RLS (23503 = reached the auth.users FK)');

SELECT tests.act_as_owner();

-- 17. INTEGRITY: no row from any caller in this file reached the table.
SELECT is_empty(
  $q$SELECT id FROM public.admin_audit_log WHERE target_id LIKE 't055-%'$q$,
  'with RLS bypassed: no audit row from this file exists');

SELECT * FROM finish();
ROLLBACK;
