-- F-038: current schema makes no claim to email delivery; no rows are dropped.
BEGIN;
SELECT plan(5);
SELECT has_table('public','legacy_reminder_log','historical ledger retained under accurate name');
SELECT hasnt_table('public','email_reminder_log','misleading active table identifier removed');
SELECT is((SELECT count(*)::integer FROM pg_constraint WHERE conrelid='public.legacy_reminder_log'::regclass AND conname LIKE '%email%'),0,'renamed ledger constraints contain no email identifier');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.legacy_reminder_log'::regclass),'historical ledger RLS remains enabled');
SELECT has_function('public','send_event_reminders',ARRAY[]::text[],'existing in-app reminder function preserved');
SELECT * FROM finish();
ROLLBACK;
