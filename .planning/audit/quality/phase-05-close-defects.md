# One defect found during Phase 5 that had no register entry

**Plan:** 05-19 · **Phase:** 05-slices-3-5-auth-club-authorization-admin-containment · **Recorded:** 2026-09-25

This is the audit-side evidence for **F-092**. It lives under `.planning/audit/` because the finding
register's schema requires every `evidence` value to resolve there. 05-15 observed the defect while
moving `GET /api/admin/reports` to the cookie client and recorded it as a candidate for the phase close
(`.planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/evidence/service-role-migration.txt`
§ 4). 05-19 re-ran the probe below on 2026-09-25 against commit `8c0cf58` (code identical to `941bee7`),
on the local stack after a reset and seed. The anon key was read from `supabase status -o env` into a
shell variable and never printed. Production was not read.

---

## F-092 — the admin reports list always answers 500

**Subject:** `GET /api/admin/reports`, `src/app/api/admin/reports/route.ts:27-50`, and its one caller,
`src/app/moderation/reports/page.tsx:41` (the list fetch).

- The route's select embeds
  `reporter:users!event_reports_reporter_id_fkey(id, display_name, avatar_url)` (`:32`).
- `event_reports.reporter_id` references `auth.users`, not `public.users`, so PostgREST finds no
  relationship named by that hint in the `public` schema. `public.users` also has no `display_name`
  column.
- On any error the route answers `500 {"error":"Internal server error"}` (`:48-50`). The page shows
  its list only when `res.ok`, so the reports queue is empty for every admin, whatever the data.
- It fails the same way on the cookie client (since 05-15) and on the service client (before it): the
  error is a schema-cache relationship error, not a permission. 05-15 recorded it before and after its
  own change.

Probe (verbatim):

```
$ curl -s "$API_URL/rest/v1/event_reports?select=*,event:events!inner(id,title,status,deleted_at),reporter:users!event_reports_reporter_id_fkey(id,display_name,avatar_url)&limit=1"   (local stack, anon key; key not printed)
API_URL=http://127.0.0.1:54321
{"code":"PGRST200","details":"Searched for a foreign key relationship between 'event_reports' and 'users' using the hint 'event_reports_reporter_id_fkey' in the schema 'public', but no matches were found.","hint":"Perhaps you meant 'events' instead of 'users'.","message":"Could not find a relationship between 'event_reports' and 'users' in the schema cache"}
exit=0
$ the same select without the reporter embed
[]
exit=0
$ docker exec -i supabase_db_Event-Radar psql -U postgres -d postgres < fk.sql   (event_reports foreign keys; users.display_name)
            conname             | references 
--------------------------------+------------
 event_reports_event_id_fkey    | events
 event_reports_reporter_id_fkey | auth.users
 event_reports_reviewed_by_fkey | auth.users
(3 rows)

 users_display_name_columns 
----------------------------
                          0
(1 row)

exit=0
```

The first request is the route's own select string. It answers `PGRST200`. Without the reporter
embed the same request succeeds (the seed has no reports, so `[]`). The foreign-key listing shows
`event_reports_reporter_id_fkey` pointing at `auth.users`, and `public.users` has no `display_name`.

**Why Medium.** A Validated workflow in `.planning/PROJECT.md` ("Admins … review reports and appeals")
cannot list reports at all. Resolving a single report by id (`PATCH /api/admin/reports/[id]`) still
works (`e2e/specs/admin-write-paths.spec.ts`, "resolving a report"), and nothing is exposed: the route
fails closed. That is a correctness defect with a partial compensating path, which is the SLA's Medium.
It is pre-existing: the embed predates Phase 5, and production has the same foreign key (the baseline
migration is the production schema). Related: F-072 (the other moderation surface that read a column
that does not exist).

**Recommended fix.** Drop the embed and resolve reporter names with a second query on `users` by id
(`.in("id", reporterIds)` selecting `id, name, avatar_url`), the two-query pattern 05-14 used for the
audit-log actor (`src/app/moderation/page.tsx`). Pin it first with a DEFECT test that feeds the route a
PGRST200 error and asserts the 500, then move it.
