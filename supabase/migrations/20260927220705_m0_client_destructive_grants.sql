-- M0 DI-54/72. TRUNCATE bypasses RLS; client roles never need DDL-style rights.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public
  FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM PUBLIC, anon, authenticated;
REVOKE DELETE ON public.users FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (onboarding_completed) ON public.users FROM PUBLIC, anon, authenticated;
-- Server routes already authorize profile deletion / onboarding; the service
-- role retains its existing grants. Do not expand user-editable profile fields.
