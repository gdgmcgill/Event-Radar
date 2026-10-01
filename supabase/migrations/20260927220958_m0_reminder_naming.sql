-- M0 / F-038: this historical unused table is not an email delivery log.
-- Preserve rows, privileges and RLS; current reminder functions continue to
-- write public.notifications. No email provider or new delivery is introduced.
ALTER TABLE public.email_reminder_log RENAME TO legacy_reminder_log;
ALTER TABLE public.legacy_reminder_log RENAME CONSTRAINT email_reminder_log_pkey TO legacy_reminder_log_pkey;
ALTER TABLE public.legacy_reminder_log RENAME CONSTRAINT email_reminder_log_user_id_event_id_reminder_type_key TO legacy_reminder_log_user_id_event_id_reminder_type_key;
ALTER TABLE public.legacy_reminder_log RENAME CONSTRAINT email_reminder_log_reminder_type_check TO legacy_reminder_log_reminder_type_check;
ALTER TABLE public.legacy_reminder_log RENAME CONSTRAINT email_reminder_log_event_id_fkey TO legacy_reminder_log_event_id_fkey;
ALTER TABLE public.legacy_reminder_log RENAME CONSTRAINT email_reminder_log_user_id_fkey TO legacy_reminder_log_user_id_fkey;
ALTER INDEX public.email_reminder_log_type_event_idx RENAME TO legacy_reminder_log_type_event_idx;
COMMENT ON TABLE public.legacy_reminder_log IS
  'Unused historical reminder ledger. Current in-app reminders are deduplicated and stored in public.notifications. No email delivery is implemented.';
