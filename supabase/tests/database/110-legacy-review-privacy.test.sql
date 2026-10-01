-- P1-03: direct Data API-equivalent roles cannot resurrect public ratings.
BEGIN;
SELECT plan(18);
INSERT INTO auth.users(id,email) VALUES
 ('ad010003-0000-4000-8000-000000000001','review-author@example.invalid'),
 ('ad010003-0000-4000-8000-000000000002','review-outsider@example.invalid'),
 ('ad010003-0000-4000-8000-000000000003','review-owner@example.invalid'),
 ('ad010003-0000-4000-8000-000000000004','review-admin@example.invalid');
INSERT INTO public.users(id,email,name,roles) VALUES
 ('ad010003-0000-4000-8000-000000000001','review-author@example.invalid','Author','{user}'),
 ('ad010003-0000-4000-8000-000000000002','review-outsider@example.invalid','Outsider','{user}'),
 ('ad010003-0000-4000-8000-000000000003','review-owner@example.invalid','Organizer','{user,club_organizer}'),
 ('ad010003-0000-4000-8000-000000000004','review-admin@example.invalid','Admin','{user,admin}');
INSERT INTO public.clubs(id,name,status,created_by) VALUES
 ('ad010003-0000-4000-8000-000000000010','Private history fixture','approved','ad010003-0000-4000-8000-000000000003');
INSERT INTO public.club_members(club_id,user_id,role) VALUES
 ('ad010003-0000-4000-8000-000000000010','ad010003-0000-4000-8000-000000000003','owner');
INSERT INTO public.events(id,title,start_date,end_date,status,club_id,created_by) VALUES
 ('ad010003-0000-4000-8000-000000000020','Legacy review event','2020-01-01','2020-01-02','approved','ad010003-0000-4000-8000-000000000010','ad010003-0000-4000-8000-000000000003');
INSERT INTO public.reviews(id,user_id,event_id,rating,comment) VALUES
 ('ad010003-0000-4000-8000-000000000030','ad010003-0000-4000-8000-000000000001','ad010003-0000-4000-8000-000000000020',5,'Private historical comment');
SELECT is((SELECT count(*) FROM public.reviews WHERE id='ad010003-0000-4000-8000-000000000030'),1::bigint,'fixture exists before policy assertions');

SELECT tests.act_as_anon();
SELECT is(current_user::text,'anon','actual anon database role');
SELECT throws_ok('SELECT rating,comment FROM public.reviews','42501',NULL,'anon cannot read stars or comments');
SELECT throws_ok('SELECT avg(rating) FROM public.reviews','42501',NULL,'anon cannot reconstruct averages');
RESET ROLE;
SELECT tests.act_as('ad010003-0000-4000-8000-000000000001');
SELECT is(current_user::text,'authenticated','actual authenticated database role');
SELECT results_eq($q$SELECT rating,comment FROM public.reviews WHERE id='ad010003-0000-4000-8000-000000000030'$q$,
 $q$VALUES(5::smallint,'Private historical comment'::text)$q$,'author retains original history');
SELECT throws_ok($q$INSERT INTO public.reviews(user_id,event_id,rating) VALUES(auth.uid(),'ad010003-0000-4000-8000-000000000020',1)$q$,'42501',NULL,'author cannot write new legacy rating');
SELECT throws_ok($q$UPDATE public.reviews SET rating=1 WHERE id='ad010003-0000-4000-8000-000000000030'$q$,'42501',NULL,'author cannot alter legacy history');
SELECT throws_ok($q$DELETE FROM public.reviews WHERE id='ad010003-0000-4000-8000-000000000030'$q$,'42501',NULL,'author cannot delete retained history through Data API');
RESET ROLE;
SELECT tests.act_as('ad010003-0000-4000-8000-000000000002');
SELECT is_empty($q$SELECT * FROM public.reviews WHERE event_id='ad010003-0000-4000-8000-000000000020'$q$,'unrelated signed-in user cannot read history');
SELECT is((SELECT avg(rating) FROM public.reviews WHERE event_id='ad010003-0000-4000-8000-000000000020'),NULL::numeric,'signed-in outsider cannot reconstruct aggregate');
RESET ROLE;
SELECT tests.act_as('ad010003-0000-4000-8000-000000000003');
SELECT is((SELECT count(*) FROM public.club_members WHERE club_id='ad010003-0000-4000-8000-000000000010'),1::bigint,'positive control: real club owner');
SELECT is_empty($q$SELECT * FROM public.reviews WHERE event_id='ad010003-0000-4000-8000-000000000020'$q$,'event creator and club owner gain no review access');
RESET ROLE;
SELECT tests.act_as('ad010003-0000-4000-8000-000000000004');
SELECT is((SELECT count(*) FROM public.reviews WHERE id='ad010003-0000-4000-8000-000000000030'),1::bigint,'active admin can inspect historical record');
SELECT throws_ok('UPDATE public.reviews SET rating=1','42501',NULL,'admin client cannot mutate immutable history');
RESET ROLE;
UPDATE public.users SET banned_at=now(),ban_expires_at=NULL WHERE id='ad010003-0000-4000-8000-000000000004';
SELECT tests.act_as('ad010003-0000-4000-8000-000000000004');
SELECT is_empty($q$SELECT * FROM public.reviews WHERE id='ad010003-0000-4000-8000-000000000030'$q$,'suspended admin loses other users history');
RESET ROLE;
SELECT is((SELECT rating FROM public.reviews WHERE id='ad010003-0000-4000-8000-000000000030'),5::smallint,'original row preserved after denied mutations');
SELECT is((SELECT count(*)::integer FROM pg_policy WHERE polrelid='public.reviews'::regclass),1,'only the private history policy remains');
SELECT * FROM finish();
ROLLBACK;
