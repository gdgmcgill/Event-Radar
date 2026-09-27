-- F-030: only current owners can upload/overwrite club logos or club banners.
-- Transaction-local Storage metadata fixtures; no real blob is created/removed.
-- The deletion flag models the Storage API's own SQL session so RLS, rather
-- than the service's direct-SQL deletion guard, is the boundary under test.
BEGIN;
SELECT plan(25);
SET LOCAL storage.allow_delete_query = 'true';

INSERT INTO storage.buckets (id,name,public) VALUES
  ('club-logos','club-logos',true), ('avatars','avatars',true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.users (id,email,name,roles) VALUES
  ('00000000-0000-4000-8000-000000008501','m0-storage-a@example.invalid','M0 owner A','{user}'),
  ('00000000-0000-4000-8000-000000008502','m0-storage-b@example.invalid','M0 owner B','{user}'),
  ('00000000-0000-4000-8000-000000008503','m0-storage-c@example.invalid','M0 organizer','{user}');
INSERT INTO public.clubs (id,name,status) VALUES
  ('00000000-0000-4000-8000-0000000085c1','M0 club A','approved'),
  ('00000000-0000-4000-8000-0000000085c2','M0 club B','approved'),
  ('00000000-0000-4000-8000-000000008503','M0 club with user-id collision','approved');
INSERT INTO public.club_members (club_id,user_id,role) VALUES
  ('00000000-0000-4000-8000-0000000085c1','00000000-0000-4000-8000-000000008501','owner'),
  ('00000000-0000-4000-8000-0000000085c1','00000000-0000-4000-8000-000000008503','organizer'),
  ('00000000-0000-4000-8000-0000000085c2','00000000-0000-4000-8000-000000008502','owner'),
  ('00000000-0000-4000-8000-000000008503','00000000-0000-4000-8000-000000008502','owner');
INSERT INTO storage.objects (bucket_id,name,metadata) VALUES
  ('club-logos','00000000-0000-4000-8000-0000000085c1/logo.png','{"marker":"original"}'),
  ('club-logos','00000000-0000-4000-8000-0000000085c1/banner.png','{"marker":"original"}'),
  ('club-logos','00000000-0000-4000-8000-0000000085c2/logo.png','{"marker":"other"}'),
  ('club-logos','00000000-0000-4000-8000-000000008503/logo.png','{"marker":"collision"}');

SELECT tests.act_as('00000000-0000-4000-8000-000000008501');
WITH inserted AS (
 INSERT INTO storage.objects (bucket_id,name) VALUES ('club-logos','00000000-0000-4000-8000-0000000085c1/new-logo.png') RETURNING id
) SELECT is((SELECT count(*)::integer FROM inserted),1,'owner uploads logo to own club prefix');
WITH inserted AS (
 INSERT INTO storage.objects (bucket_id,name) VALUES ('club-logos','00000000-0000-4000-8000-0000000085c1/banner-123.png') RETURNING id
) SELECT is((SELECT count(*)::integer FROM inserted),1,'owner uploads banner to own club prefix');
WITH changed AS (
 INSERT INTO storage.objects (bucket_id,name,metadata) VALUES ('club-logos','00000000-0000-4000-8000-0000000085c1/logo.png','{"marker":"updated"}')
 ON CONFLICT (bucket_id,name) DO UPDATE SET metadata=EXCLUDED.metadata RETURNING id
) SELECT is((SELECT count(*)::integer FROM changed),1,'owner logo upsert has INSERT SELECT and UPDATE authorization');
WITH changed AS (
 UPDATE storage.objects SET metadata='{"marker":"updated"}' WHERE bucket_id='club-logos' AND name='00000000-0000-4000-8000-0000000085c1/banner.png' RETURNING id
) SELECT is((SELECT count(*)::integer FROM changed),1,'owner can overwrite existing banner');
SELECT throws_ok($q$INSERT INTO storage.objects (bucket_id,name) VALUES ('club-logos','00000000-0000-4000-8000-0000000085c2/squat.png')$q$,
 '42501',NULL,'owner cannot upload into another club');
WITH changed AS (
 UPDATE storage.objects SET metadata='{"marker":"attacked"}' WHERE bucket_id='club-logos' AND name='00000000-0000-4000-8000-0000000085c2/logo.png' RETURNING id
) SELECT is((SELECT count(*)::integer FROM changed),0,'owner cannot overwrite another club logo');
SELECT throws_ok($q$UPDATE storage.objects SET name='00000000-0000-4000-8000-0000000085c2/renamed.png'
 WHERE bucket_id='club-logos' AND name='00000000-0000-4000-8000-0000000085c1/logo.png'$q$,'42501',NULL,'WITH CHECK blocks moving an owned object to another club');
SELECT throws_ok($q$INSERT INTO storage.objects (bucket_id,name) VALUES ('club-logos','malformed-prefix/logo.png')$q$,
 '42501',NULL,'malformed prefix fails closed without an unsafe UUID cast');
SELECT throws_ok($q$INSERT INTO storage.objects (bucket_id,name) VALUES ('club-logos','flat.png')$q$,
 '42501',NULL,'a flat key cannot bypass club prefix ownership');
WITH inserted AS (
 INSERT INTO storage.objects (bucket_id,name) VALUES ('avatars','00000000-0000-4000-8000-000000008501/avatar.png') RETURNING id
) SELECT is((SELECT count(*)::integer FROM inserted),1,'generic own-folder avatar upload remains allowed');
WITH changed AS (
 UPDATE storage.objects SET metadata='{"marker":"avatar-updated"}' WHERE bucket_id='avatars' AND name='00000000-0000-4000-8000-000000008501/avatar.png' RETURNING id
) SELECT is((SELECT count(*)::integer FROM changed),1,'generic own-folder avatar update remains allowed');

SELECT tests.act_as('00000000-0000-4000-8000-000000008503');
SELECT throws_ok($q$INSERT INTO storage.objects (bucket_id,name) VALUES ('club-logos','00000000-0000-4000-8000-0000000085c1/organizer.png')$q$,
 '42501',NULL,'organizer membership does not confer owner upload rights');
WITH changed AS (
 UPDATE storage.objects SET metadata='{"marker":"organizer"}' WHERE bucket_id='club-logos' AND name='00000000-0000-4000-8000-0000000085c1/banner.png' RETURNING id
) SELECT is((SELECT count(*)::integer FROM changed),0,'organizer cannot overwrite an owner banner');
SELECT throws_ok($q$INSERT INTO storage.objects (bucket_id,name) VALUES ('club-logos','00000000-0000-4000-8000-000000008503/squat.png')$q$,
 '42501',NULL,'user-id/club-id collision does not activate generic folder INSERT');
WITH changed AS (
 UPDATE storage.objects SET metadata='{"marker":"collision-attack"}' WHERE bucket_id='club-logos' AND name='00000000-0000-4000-8000-000000008503/logo.png' RETURNING id
) SELECT is((SELECT count(*)::integer FROM changed),0,'user-id/club-id collision does not activate generic folder UPDATE');
WITH removed AS (
 DELETE FROM storage.objects WHERE bucket_id='club-logos' AND name='00000000-0000-4000-8000-000000008503/logo.png' RETURNING id
) SELECT is((SELECT count(*)::integer FROM removed),0,'user-id/club-id collision does not activate generic folder DELETE');
WITH changed AS (
 UPDATE storage.objects SET metadata='{"marker":"avatar-attack"}' WHERE bucket_id='avatars' AND name='00000000-0000-4000-8000-000000008501/avatar.png' RETURNING id
) SELECT is((SELECT count(*)::integer FROM changed),0,'other users avatar updates remain denied');

SELECT tests.act_as_anon();
SELECT throws_ok($q$INSERT INTO storage.objects (bucket_id,name) VALUES ('club-logos','00000000-0000-4000-8000-0000000085c1/anon.png')$q$,
 '42501',NULL,'anonymous cannot upload club branding');
WITH changed AS (
 UPDATE storage.objects SET metadata='{"marker":"anon"}' WHERE bucket_id='club-logos' AND name='00000000-0000-4000-8000-0000000085c1/logo.png' RETURNING id
) SELECT is((SELECT count(*)::integer FROM changed),0,'anonymous cannot overwrite club branding');
SELECT is((SELECT metadata->>'marker' FROM storage.objects WHERE bucket_id='club-logos' AND name='00000000-0000-4000-8000-0000000085c1/logo.png'),'updated','public reads are retained and denied writes changed nothing');

-- Ownership follows current membership, not the original object uploader.
SELECT tests.act_as_owner();
UPDATE public.club_members SET role='organizer' WHERE club_id='00000000-0000-4000-8000-0000000085c1' AND user_id='00000000-0000-4000-8000-000000008501';
INSERT INTO public.club_members (club_id,user_id,role) VALUES ('00000000-0000-4000-8000-0000000085c1','00000000-0000-4000-8000-000000008502','owner');
SELECT tests.act_as('00000000-0000-4000-8000-000000008501');
WITH changed AS (
 UPDATE storage.objects SET metadata='{"marker":"former-owner"}' WHERE bucket_id='club-logos' AND name='00000000-0000-4000-8000-0000000085c1/logo.png' RETURNING id
) SELECT is((SELECT count(*)::integer FROM changed),0,'former owner immediately loses overwrite rights');
SELECT tests.act_as('00000000-0000-4000-8000-000000008502');
WITH changed AS (
 UPDATE storage.objects SET metadata='{"marker":"new-owner"}' WHERE bucket_id='club-logos' AND name='00000000-0000-4000-8000-0000000085c1/logo.png' RETURNING id
) SELECT is((SELECT count(*)::integer FROM changed),1,'new owner can maintain existing branding');
SELECT tests.act_as_owner();
SELECT is((SELECT metadata->>'marker' FROM storage.objects WHERE bucket_id='club-logos' AND name='00000000-0000-4000-8000-0000000085c2/logo.png'),'other','other club data unchanged');
SELECT is((SELECT metadata->>'marker' FROM storage.objects WHERE bucket_id='club-logos' AND name='00000000-0000-4000-8000-000000008503/logo.png'),'collision','collision-prefix data unchanged');
SELECT is((SELECT count(*)::integer FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname IN ('Authenticated users can upload club logos','Authenticated users can update club logos')),0,'broad permissive club policies removed');
SELECT * FROM finish();
ROLLBACK;
