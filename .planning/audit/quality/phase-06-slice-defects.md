# Two defects registered at the start of Phase 6

**Plan:** 06-01 · **Phase:** 06-slices-6-7-async-edge-contracts-caching-observability · **Recorded:** 2026-09-25

This is the audit-side evidence for **F-093** and **F-094**. It lives under `.planning/audit/` because the
finding register's schema requires every `evidence` value to resolve there. Both defects are registered
before any Phase 6 characterization suite cites them (CONTEXT Area 5: a DEFECT suite cites a registered
id, and the tag gate refuses an id the register does not hold).

**Method.** Local stack only (`127.0.0.1:54321`, Supabase CLI 2.115.0), on base commit `f186621` after a
`supabase db reset --local` and the seed (`evidence/floor.before.txt` blocks 14a and 14b in the phase
directory). Database probes ran inside `BEGIN … ROLLBACK` through
`docker exec -i supabase_db_Event-Radar psql -U postgres -v ON_ERROR_STOP=1 -f`, with the SQL in a file.
No key was read or printed. Production was not read. F-094's shapes are cited from the source at the
base commit; they are the three shapes 05-REVIEW-FIX.md carried as IN-02, IN-03 and IN-04 (proposed
DI-64 and DI-66, both retired into F-094 by 06-01).

---

## F-093 — reminders are sent for deleted and unapproved events

**Subject:** `public.send_event_reminders()`, `supabase/migrations/20260915214553_baseline.sql:379-445`.

- Both loops select `saved_events` joined to `events` filtered only by `start_date` (the 24-hour loop at
  `:390-393`, the 1-hour loop at `:416-419`). There is no `e.deleted_at IS NULL` and no
  `e.status = 'approved'`.
- The function is SECURITY DEFINER and is the production reminder path (pg_cron job
  `send-event-reminders`, `*/15 * * * *`, `.planning/audit/async/cron-job.json`). The JavaScript cron
  handler `src/app/api/cron/send-reminders/route.ts` did filter, but nothing calls it (F-037 divergence 3);
  06-03 deletes it, which leaves this function as the only reminder path.
- So a user who saved an event is reminded about it after it is soft-deleted, rejected, suspended or put
  back to pending, and the notification's message carries the event's title.

Reproduction (verbatim; fixture user `5eed0000-0000-4000-8000-000000000003`, the seeded club-member
persona, an onboarded non-admin; the comment in the SQL says "onboarded student" and is the only
inaccuracy in it):

```
$ docker exec -i supabase_db_Event-Radar psql -U postgres -v ON_ERROR_STOP=1 -f /dev/stdin < <scratchpad>/f093.sql
-- f093.sql
\pset footer off
BEGIN;
-- Fixture: three events starting 24 h out; one approved, one approved but soft-deleted, one pending.
INSERT INTO public.events (id, title, start_date, end_date, status, deleted_at) VALUES
  ('f0930000-0000-4000-8000-00000000000a', 'F-093 approved',            now() + interval '24 hours', now() + interval '26 hours', 'approved', NULL),
  ('f0930000-0000-4000-8000-00000000000d', 'F-093 approved, soft-deleted', now() + interval '24 hours', now() + interval '26 hours', 'approved', now()),
  ('f0930000-0000-4000-8000-0000000000e0', 'F-093 pending',             now() + interval '24 hours', now() + interval '26 hours', 'pending',  NULL);
-- The seeded onboarded student saves all three.
INSERT INTO public.saved_events (user_id, event_id)
SELECT '5eed0000-0000-4000-8000-000000000003'::uuid, id FROM public.events WHERE id::text LIKE 'f0930000-%';
SELECT public.send_event_reminders() AS result;
SELECT e.title, e.status, (e.deleted_at IS NOT NULL) AS soft_deleted,
       count(n.id) FILTER (WHERE n.type = 'reminder_24h') AS reminder_24h_rows,
       max(n.message) AS reminder_text
FROM public.events e
LEFT JOIN public.notifications n ON n.event_id = e.id AND n.user_id = '5eed0000-0000-4000-8000-000000000003'
WHERE e.id::text LIKE 'f0930000-%'
GROUP BY e.id, e.title, e.status, e.deleted_at ORDER BY e.title;
ROLLBACK;
SELECT count(*) AS fixture_rows_after_rollback FROM public.events WHERE id::text LIKE 'f0930000-%';

-- output
BEGIN
INSERT 0 3
INSERT 0 3
                                result
-----------------------------------------------------------------------
 {"1h": 0, "24h": 3, "checked_at": "2026-09-25T23:10:52.983047+00:00"}

            title             |  status  | soft_deleted | reminder_24h_rows |                      reminder_text
------------------------------+----------+--------------+-------------------+----------------------------------------------------------
 F-093 approved               | approved | f            |                 1 | "F-093 approved" starts in about 24 hours.
 F-093 approved, soft-deleted | approved | t            |                 1 | "F-093 approved, soft-deleted" starts in about 24 hours.
 F-093 pending                | pending  | f            |                 1 | "F-093 pending" starts in about 24 hours.

ROLLBACK
 fixture_rows_after_rollback
-----------------------------
                           0

exit=0
```

**Result today:** all three saved events are reminded (`"24h": 3`); the correct count is 1 (only the
approved, non-deleted event). The transaction rolled back and left no row.

**Fix (06-05):** `CREATE OR REPLACE FUNCTION public.send_event_reminders()` in
`20260926120000_async_edge_definer_hardening.sql` with `e.deleted_at IS NULL AND e.status = 'approved'`
in both loops and `SET search_path = public, pg_temp`. INTENTIONAL: the function's md5 pin becomes a
behaviour pin. Validation: a pgTAP case in `supabase/tests/database/070-definer-functions.test.sql` runs
this fixture and asserts exactly one `reminder_24h` row, for the approved, non-deleted event. The fix
reaches production only through DI-23 (Phase 8), so the finding stays Open at "08" with a local-proof
resolution when 06-05 lands (DEC-72).

---

## F-094 — handlers parse input without a schema

**Subject:** every route handler that reads request input by hand. The census at the base commit
(`evidence/floor.before.txt` C2-C5): 21 raw `request.json()`/`req.json()` sites in 20 route files, 5
`.formData()` sites, 59 `searchParams` reads in 19 route files, and 15 `readJsonObject` sites. There is no
schema: each handler checks types, presence and format with its own `if` ladder, and the 400 texts are
per-route strings (06-RESEARCH.md § Inventory C lists about 130).

Three shapes, each cited at the base commit:

1. **A malformed body answers 500, not 400 (IN-03).** `src/app/api/clubs/[id]/invites/route.ts:86`
   calls `await request.json()` inside the POST's `try` (`:65`); a body that is not JSON throws, and the
   catch at `:163-167` answers `500 {"error":"Failed to create invitation"}`. Of the other 20 raw sites,
   only `events/[id]/reviews:33` and `events/[id]/rsvp:215` catch the parse and answer 400
   `Invalid JSON body` by hand; the rest (for example `feedback/route.ts:20`, `interactions/route.ts:69`,
   `events/create/route.ts:33`, `users/[id]/route.ts:31`) let it throw, which answers a 500: JSON where a
   `try` encloses the read, Next's HTML page where none does.
2. **A non-string field answers an HTML 500 (IN-02).** `src/app/api/clubs/[id]/appeal/route.ts:26` runs
   `if (!message?.trim())` on a value `readJsonObject` only guarantees to be a property of an object.
   `{"message": 5}` throws `TypeError: message.trim is not a function`; the handler's first `try` opens at
   `:96`, so Next answers its HTML 500 page. `admin/clubs/[id]/route.ts:36,51`
   (`rejectionMessage?.trim()`, before the first `try` at `:150`) has the same shape;
   `clubs/[id]/invites/route.ts:96` (`email.trim()`) has the same unchecked call inside a `try`, so it
   answers a JSON 500 instead.
3. **One field, two rules (IN-04).** Club link fields: `POST /api/clubs` refuses only an unsafe scheme
   (`src/app/api/clubs/route.ts:77-86`, `hasUnsafeUrlScheme(value.trim())`), so it stores a scheme-less
   `www.example.com`; `PATCH /api/clubs/[id]` requires an absolute http(s) URL
   (`src/app/api/clubs/[id]/route.ts:132-136`, `isHttpUrl`) and answers 400 `Invalid URL for website_url`
   for the value POST stored, so the club settings form cannot save a club created that way.

A fourth, related shape (IN-09, proposed DI-64): admin self-checks compare route UUIDs as strings, so a
differently-cased id for the caller's own row passes a "not yourself" check (`admin/users/[id]/ban`,
`admin/users/[id]` roles). A schema that canonicalizes the id once closes it.

**Fix (06-04, 06-08..06-10):** zod contracts in `src/contracts/` read through `parseBody`, `parseQuery`
and `parseForm` in `src/server/body.ts`; each rule carries today's 400 text; an invalid body answers 400
`Invalid JSON body`, a non-object body 400 `Request body must be a JSON object`, a non-string field 400;
club links use one `ClubLinkFields` rule on POST and PATCH; route UUIDs parse through one lower-casing
`Uuid` schema (DEC-65, DEC-66). Each moved byte is a DEFECT move with a defect-ledger row, INTENTIONAL.
Validation: `node scripts/check-contracts.mjs` exits 0 with an empty allow-list, and the DEFECT suites
that pin 500 on malformed input move to 400.
