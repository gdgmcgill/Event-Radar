-- P1-02 intentional product change: verified email admission is independent
-- of university affiliation. These fields never grant club/admin authority.
BEGIN;
CREATE TABLE public.universities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  city text NOT NULL CHECK (char_length(city) BETWEEN 1 AND 120),
  active boolean NOT NULL DEFAULT true
);
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.universities FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.universities TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.universities TO service_role;
CREATE POLICY universities_active_read ON public.universities FOR SELECT TO anon, authenticated USING (active OR (SELECT public.is_admin()));
-- Admin writes remain server-mediated. No client editable affiliation can
-- satisfy this or any existing club membership/administrator authorization.
INSERT INTO public.universities(id,slug,name,city) VALUES
('10000000-0000-4000-8000-000000000001','mcgill','McGill University','Montréal'),
('10000000-0000-4000-8000-000000000002','concordia','Concordia University','Montréal'),
('10000000-0000-4000-8000-000000000003','polytechnique-montreal','Polytechnique Montréal','Montréal'),
('10000000-0000-4000-8000-000000000004','universite-de-montreal','Université de Montréal','Montréal'),
('10000000-0000-4000-8000-000000000005','hec-montreal','HEC Montréal','Montréal'),
('10000000-0000-4000-8000-000000000006','ets','École de technologie supérieure','Montréal');

ALTER TABLE public.users
  ADD COLUMN university_id uuid REFERENCES public.universities(id),
  ADD COLUMN other_university text CHECK (other_university IS NULL OR char_length(other_university) BETWEEN 1 AND 120),
  ADD COLUMN program text CHECK (program IS NULL OR char_length(program) <= 120),
  ADD COLUMN affiliation_source text CHECK (affiliation_source IS NULL OR affiliation_source IN ('self_declared','verified_email')),
  ADD CONSTRAINT users_affiliation_exclusive CHECK (university_id IS NULL OR other_university IS NULL);
CREATE INDEX users_university_id_idx ON public.users(university_id);
COMMENT ON COLUMN public.users.affiliation_source IS 'Informational provenance only. Not institution verification or an authorization claim; set through validated server paths.';
-- New columns inherit no authenticated UPDATE from the column-grant boundary.
-- Only harmless optional program is directly editable under existing own RLS.
GRANT UPDATE (program) ON public.users TO authenticated;

-- Conservative legacy backfill: join the authoritative auth record and require
-- verified email + exact domain. Preserve names, roles, bans and completion.
UPDATE public.users u SET
  university_id = '10000000-0000-4000-8000-000000000001',
  affiliation_source = 'verified_email'
FROM auth.users a
WHERE a.id = u.id AND a.email_confirmed_at IS NOT NULL
  AND a.email ~* '^[^@]+@(mail\.)?mcgill\.ca$'
  AND u.university_id IS NULL AND u.other_university IS NULL;
COMMIT;
