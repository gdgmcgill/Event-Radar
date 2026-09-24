# Six defects on the Phase 5 slices that had no register entry

**Plan:** 05-01 · **Phase:** 05-slices-3-5-auth-club-authorization-admin-containment · **Recorded:** 2026-09-24

This is the audit-side evidence for **F-086** through **F-091**. It lives under
`.planning/audit/` because the finding register's schema requires every `evidence` value to
resolve there. The plan-side narrative is
`.planning/phases/05-slices-3-5-auth-club-authorization-admin-containment/05-RESEARCH.md`
§ Corrections C2, C7, C10, C11, C12 and C14, § Inventories A, B and G, and the Phase 4 deferred
register's DI-36 entry. The research measured these on 2026-09-23. **Every reproduction below
was re-run on 2026-09-24 against base commit `4a9e2723d0d84ae402b92dcfbe55f2f44a4f40a2`**
(05-01 Task 1's DI-38 commit; `src/` and `supabase/` are identical to the research commit), or
re-read where it is a code fact. Every file:line pointer was re-read on that commit, not
transcribed.

Why these needed ids: CONTEXT Area 4 requires every DEFECT characterization suite to cite a
registered F-nnn, and `scripts/check-characterization-tags.mjs` rejects an id the register does
not hold. Phase 5 pins or fixes each of these six, so each needs an id before its suite exists.

Method notes, stated once:

- RLS facts were probed on the **local** stack only, as
  `docker exec -i supabase_db_Event-Radar psql -U postgres < probe.sql`, the script held in the
  session scratchpad. Each impersonation ran inside `BEGIN … ROLLBACK` with
  `SET LOCAL ROLE authenticated` and `set_config('request.jwt.claims', '{"sub":"<persona id>",…}', true)`,
  on the seeded database (`npx tsx scripts/seed/load.ts`, the fixed persona UUIDs of
  `scripts/seed/personas.ts:90-128`). No row changed. No key was printed or written.
  Production was not read.
- The transform probe was an inline `npx tsx -e` expression importing `src/lib/tagMapping.ts`.
  It created no file.
- Code facts are quoted with the line numbers they have on the base commit.

---

## F-086 — pending edits never reach their creator

**Subject:** `GET /api/events/[id]`, `src/app/api/events/[id]/route.ts:71-138`.

- Line 87 reads the row with `select("*")`, so `pending_edits` is on `data`.
- Line 110 builds the response body with `transformEventFromDB(data …)`.
- Lines 112-128 are the stripping gate: for a caller who is neither the creator nor an admin
  (roles read at 118-122), they remove `pending_edits` from `event` and return the rest.
- `transformEventFromDB` (`src/lib/tagMapping.ts:94-175`) builds a fresh object literal and
  never copies `pending_edits`. `grep -n pending_edits src/lib/tagMapping.ts` prints nothing.

Probe, re-run on the base commit:

```
$ npx tsx -e '…transformEventFromDB({ …, pending_edits: { title: "new", submitted_at: "x" } })…'
input has pending_edits: true / transform output has pending_edits: false
```

So the key is gone before the gate runs. No caller receives it: not the creator, not an admin.
The gate at 112-128 is dead at the response level.

**Consequence.** `src/components/events/EventDetailView.tsx:207-213` renders "You have edits
awaiting approval" only when `isCreator && event.pending_edits`, and `EventDetailClient.tsx:394`
passes `event.pending_edits` to the edit form as `initialData`. Both read this route
(`EventDetailClient.tsx:78`). A creator whose edit is awaiting moderation never sees the notice,
and the edit form opens on the live values instead of the pending ones. `/my-events` reads
`GET /api/events/my-events` (raw `select("*")` rows) and is unaffected.

**Why Low.** Nothing is disclosed to anyone who should not see it. The defect withholds the
creator's own data from the creator, and it crosses no boundary. The one control that would matter
if the transform ever started copying the column, the stripping gate, is correct but unreachable
through the real path. Phase 4 pinned it through a transform that carries the column
(`events-detail-characterization.test.ts` layer b).

**Pointers.** Phase 4 register `.planning/phases/04-…/evidence/deferred-items.md` § DI-36;
05-RESEARCH.md § G; DEC-53 (`evidence/phase-05-decisions.md`).

## F-087 — owner club writes are denied by rls

**Subject:** the three owner-only club writes, all on the cookie client:

- `PATCH /api/clubs/[id]` — `src/app/api/clubs/[id]/route.ts:127-139`:
  `supabase.from("clubs").update(updates).eq("id", clubId).select("*").single()`, and on
  `error`, 500 `{ error: "Failed to update club" }`.
- `DELETE /api/clubs/[id]` — `:191-212`: `supabase.from("clubs").update({ status: "deleted" }).eq("id", clubId)`
  with no `.select()`. On no error it writes an `admin_audit_log` row `club_deleted` through
  `createServiceClient()` (`:201-210`) and returns `{ success: true }`.
- `PATCH /api/clubs/[id]/members/role` — `src/app/api/clubs/[id]/members/role/route.ts:54-63`:
  `supabase.from("club_members").update({ role }).eq("id", memberId).select().single()`, and on
  `error`, 500 `{ error: "Failed to update role" }`.

Each handler first confirms that the caller is the club's owner (`route.ts:58-71`, `:168-177`;
`members/role/route.ts:17-26`). So the write is attempted only by the real owner.

RLS probe, as `club_owner` (`5eed…0004`) on its own `approvedClub` (`5eed…00c1`), rolled back:

```
 role
-------
 owner
(1 row)

-- PATCH /api/clubs/[id] shape: UPDATE clubs SET description
UPDATE 0
-- DELETE /api/clubs/[id] shape: UPDATE clubs SET status = deleted
UPDATE 0
-- PATCH /members/role shape: UPDATE club_members SET role = organizer on another member of the club
UPDATE 0
ROLLBACK
```

The policies that exist for those commands:

```
  tablename   |        policyname         |  cmd   |      roles      | qual
 club_members | Admins manage memberships | ALL    | {authenticated} | (EXISTS (… users.id = auth.uid() AND 'admin' = ANY (users.roles)))
 clubs        | Admins can update clubs   | UPDATE | {authenticated} | is_admin()
```

`clubs` has no owner UPDATE policy, and `club_members` UPDATE is admin-only. So:

- **PATCH** updates 0 rows. `.single()` on zero rows returns an error, so the owner gets
  **500 "Failed to update club"**.
- **DELETE** updates 0 rows **without an error** (no `.select()`), so the owner gets
  **`{ success: true }`**. The club is not deleted, and an audit row records a deletion that did
  not happen.
- **PATCH /members/role** updates 0 rows, and the owner gets **500 "Failed to update role"**.

The Phase 1 RLS review's note that these paths are "masked by service-role handlers" is wrong for
these three (research C11). Only `transfer` and `POST /api/clubs` use the service role.

**Why Medium.** It crosses no boundary and exposes nothing: RLS is denying writes, which is the
safe direction. But it is a correctness defect on a Validated organizer workflow (club edit,
delete and role management do not work in either environment), and the DELETE arm reports false
success and writes a false audit record. The compensating control is that nothing is corrupted.
It is not Low because the false-success audit row is a data-integrity defect in the moderation
record. Related: F-016 (the other broken club-membership write), F-022 (the club read policy).

**Pointers.** 05-RESEARCH.md § C11 and § D; DEC-41.

## F-088 — the auth ring fails open on its own errors

**Subject:** the proxy (`src/proxy.ts`) and the legacy ban helper (`src/lib/ban.ts`).

- **Outer catch passes through.** `src/proxy.ts:140-144`:
  `catch (e) { console.error("[Middleware] Error:", e); return NextResponse.next({ request }); }`.
  Any throw inside the ring (a Supabase client fault, a cookie parse error) admits the request
  with no ban check and no protected-route redirect.
- **A failed ban read counts as not banned.** `src/proxy.ts:92-111`: `isBanned` starts `false`.
  The `users` read's `error` is never inspected (`const { data: banProfile } = …`), so a read that
  fails, or that finds no row, leaves `banProfile` null and the request passes.
- **The legacy helper admits a caller with no profile row.** `src/lib/ban.ts:20-37`: when
  `profile` is null (no row, or a read error that is not inspected), `profile && isBanned(profile)`
  is false and the function returns `null`, which every caller reads as "not banned".
- **Most state-changing handler arms carry no ban check.** On the base commit there are 40
  exported POST/PUT/PATCH/DELETE arms under `src/app/api` outside `admin/` and `cron/`, and 10
  files call `checkBanStatus()` (`evidence/floor.before.txt` block 17). The DELETE arms of save
  (`src/app/api/events/[id]/save/route.ts:24`) and rsvp (`src/app/api/events/[id]/rsvp/route.ts:366`)
  are among the 30 without one. Phase 4 pinned that asymmetry as PRESERVE (DEC-24).

**Why Medium.** On the happy path the proxy blocks a banned user at `/api/*` (with the wrong
format, F-062), so exploiting this needs a proxy fault or a missing `users` row. But the Next.js
documentation treats the handler ring as authoritative (the proxy is advisory), and that ring has
no ban check on 30 of 40 write arms. That is a fail-open shape on an authorization control with
only a partial compensating control. It is not High, because a ban is a moderation sanction and
not a tenant boundary: a banned user reaching a write arm acts only as themselves. Related:
F-003 (the env-conditional ring), F-062 (the ring's response format), F-069 (the two-ring model).

**Pointers.** 05-RESEARCH.md § A and § B; DEC-34, DEC-35, DEC-36.

## F-089 — the onboarding guard is a deletable cookie

**Subject:** the onboarding redirect, `src/proxy.ts:123-136`.

- The predicate is `request.cookies.get("needs_onboarding")?.value === "1"`. The database value
  `users.onboarding_completed` is never read by the proxy.
- The cookie is set by the callback (`src/app/auth/callback/route.ts:223-230`,
  `httpOnly`, `sameSite: "lax"`, `maxAge: 3600`) and cleared by
  `POST /api/onboarding/complete` (`src/app/api/onboarding/complete/route.ts:15-22`), which clears
  it for any signed-in caller without checking `onboarding_completed`.
- The guard skips every path under `/api/` and `/auth/` (`:130-131`).

So an un-onboarded account can (a) browse every page after deleting the cookie, calling
`POST /api/onboarding/complete` directly, or waiting an hour, and (b) call every write API
directly at any time. Seeded fact (read as the database owner):
`mid_onboarding_student` (`5eed…0002`) has `onboarding_completed = f`.

**Why Low.** Onboarding collects profile preferences. It is not an authorization or consent
gate, and bypassing it grants no privilege and crosses no boundary. It is recorded because
REFAC-11 requires the onboarding guard to hold at the API ring, and today it is a client-held
hint. Related: F-088 (the same ring).

**Pointers.** 05-RESEARCH.md § B row "Proxy, onboarding" and § C2; DEC-34, DEC-36.

## F-090 — no origin check on state-changing api routes

**Subject:** every non-GET route under `src/app/api`, and the proxy.

- `command grep -rniE "sec-fetch-site|headers\.get\(.origin.\)|get\(\"origin\"\)" src` excluding
  tests prints nothing (exit 1) on the base commit. No route and no proxy branch checks `Origin`
  or `Sec-Fetch-Site`.
- The only barrier to cross-site request forgery is the cookie attribute:
  `node_modules/@supabase/ssr/dist/main/utils/constants.js` `DEFAULT_COOKIE_OPTIONS` sets
  `sameSite: "lax"`, so a cross-site form POST or a cross-origin `fetch` does not carry the
  Supabase session cookies.
- Two GET handlers change state, and a Lax cookie **is** sent on a top-level cross-site GET
  navigation:
  - `src/app/invites/[token]/page.tsx:137-147` auto-accepts an invitation on GET: it inserts a
    `club_members` row and updates `club_invitations` to `accepted`. A cross-site link can make a
    signed-in invitee join a club they were invited to. They must already hold the token, and RLS
    pins the invitee's email.
  - `src/app/api/recommendations/route.ts:230` inserts an `experiment_assignments` row on GET.
    It is benign: it assigns the caller to an experiment variant.

**Why Low.** `SameSite=Lax` stops the state-changing POST/PATCH/DELETE vector in every current
browser. The two state-changing GETs need the invitation token (a secret) or produce a benign
assignment. The residual is legacy browsers and a Chrome Lax-by-default POST window that applies
to cookies without an explicit `SameSite` (research A3, carried into the CSRF assessment). It is
recorded because REFAC-17 requires the assessment and a defence-in-depth check wherever exposure
remains.

**Pointers.** 05-RESEARCH.md § C14 and Pattern 5; DEC-52; DI-41.

## F-091 — admin role changes cannot land and strip admin

**Subject:** `PATCH /api/admin/users/[id]`, `src/app/api/admin/users/[id]/route.ts:1-43`, and its
one caller, `src/app/moderation/users/page.tsx:44-66` (`toggleOrganizer`, the fetch at 53-57).

- The write uses the **cookie** client returned by `verifyAdmin()` (`:9`), at
  `:31-36`: `supabase.from("users").update(updateData).eq("id", id).select().single()`, and on
  `error`, 500 `{ error: "Internal server error" }`.
- `:21-26` filters `"admin"` out of every submitted `roles` array
  (`// Strip 'admin' — admin role is hardcoded via ADMIN_EMAILS env var only`) and prepends
  `"user"`.
- No `logAdminAction` call exists in the file.
- The moderation page sends the target's **whole** role array with `club_organizer` added or
  removed (`page.tsx:49-51`), and updates local state only on `res.ok`.

RLS probe, as `admin` (`5eed…0007`, roles `{user,admin}`) on `onboarded_student` (`5eed…0001`),
rolled back:

```
              acting_as               | caller_roles
 5eed0000-0000-4000-8000-000000000007 | {user,admin}

UPDATE 0
-- same statement on the caller's own row (the only row the policy admits)
UPDATE 1
ROLLBACK

          policyname          |  cmd   |  roles   |       qual
 Users can update own profile | UPDATE | {public} | (auth.uid() = id)
```

`users` has no admin UPDATE policy. So for any target other than the caller, the update affects 0
rows, `.single()` errors, and the route returns **500**. The organizer toggle on
`/moderation/users` silently does nothing. For an admin target it would also strip `admin` if it
ever landed. On the caller's own row the update lands (the own-row policy, with the F-006 table
grant), which is the only case that "works".

**Why Medium.** The broken path fails safe (nothing is written). The admin-strip clause is a
latent hazard. Once F-004 deletes the callback's `ADMIN_EMAILS` grant, this route is the only admin
grant path, and the strip would make admin ungrantable. The missing audit row means a role change,
once it works, would leave no moderation trace (the same class as F-073). It needs an admin
session to reach, and it crosses no boundary today, which is why it is not High. Related: F-004
(the callback admin grant), F-006 (the self-role escalation this route must not reopen).

**Pointers.** 05-RESEARCH.md § C12; DEC-45.
