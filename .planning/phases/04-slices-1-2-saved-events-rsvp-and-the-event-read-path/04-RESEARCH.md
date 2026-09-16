# Phase 4: Slices 1–2 — Saved Events/RSVP and the Event Read Path - Research

**Researched:** 2026-09-16
**Domain:** Behaviour-preserving refactor of two Next.js 16 App Router read/write workflows over Supabase/PostgREST, proven by characterization tests + a Playwright persona harness
**Confidence:** HIGH for the code inventory and the measured defects (re-derived in this working tree and against the running local stack); MEDIUM for the PostgREST escaping recipe (measured locally, docs are thin); MEDIUM for the SDK-bump scope

---

## Summary

Phase 4 is the first phase in this program that **changes application source on a user-facing
workflow**. Everything before it built instruments: the reconciled schema and pgTAP suite, the
generated types behind a CI drift gate, the `src/server/` seam applied to zero routes, the
deterministic seed, and the 27-test Playwright persona harness. This phase spends those instruments
on the two highest-traffic workflows and settles the data-shape confusion under the event read path.

The research found that **the two slices are not symmetric in risk**. Slice 1 (saved events + RSVP)
is a clean seam-adoption exercise: five handlers, none of which touch the service-role client, all
already using `getUser()`, with one clearly measurable defect (RSVP counts computed by loading every
row, silently capped at `max_rows = 1000`). Slice 2 (the event read path) is where the real work is:
it carries **five separate defects that have no `F-nnn` id yet**, one of which — the tag mapping —
is user-visible on the seeded data and cannot be fixed without an intentional visual change. The
phase's own success criteria 3 and 4 are in direct tension there, and the plan must resolve that
tension deliberately rather than discover it during execution.

The largest single planning consequence is procedural: success criterion 1 requires characterization
tests **"tagged PRESERVE or DEFECT (referencing their `F-nnn`)"**, and only two of the defects this
phase owns currently *have* an `F-nnn` (F-066, F-071). Everything else — club fabrication, the
load-all-rows RSVP count, the tag coercion, the search escaping, the pagination contract drift — is
recorded in `PROJECT.md`'s "Known concerns" prose and in the roadmap's success criteria, **not in
`findings.json`**. Wave 0 of this phase must therefore register the new findings *before* any DEFECT
test can cite one.

**Primary recommendation:** Run this phase as **three waves, not two slices**. Wave 0 registers the
missing findings and writes the characterization suites against the unmodified handlers (the
`03-02` auth-callback precedent). Wave 1 is Slice 1 (saved events + RSVP through the seam, count
query, DI-24's tsconfig fix landing alongside because 18 of its 77 errors are in `rsvp.test.ts`).
Wave 2 is Slice 2 (club join, date-schema cleanup, centralized tag mapping, search escaping,
pagination contract). Keep the seam-adoption change and the defect fixes in **separate commits
within each slice** so "the refactor preserved behaviour" and "this defect was deliberately fixed"
are two reviewable facts, not one.

---

## Project Constraints (from CLAUDE.md)

Both `./CLAUDE.md` and `./.claude/CLAUDE.md` were read. Directives that bind this phase:

| Directive | Source | Consequence for Phase 4 |
|---|---|---|
| **Three Supabase clients**; using the wrong one is "a common mistake" | `CLAUDE.md` § Architecture | Every Phase 4 handler uses `@/lib/supabase/server` (async). None may reach `@/lib/supabase/service`. The ESLint boundary already enforces this for `src/app/**`. |
| The file is `src/proxy.ts`, **not** `middleware.ts`; do not re-create `middleware.ts` | `CLAUDE.md` § Auth Flow | Nothing in this phase edits the proxy. DI-35's ban decision must not be resolved by adding a second `middleware.ts`. |
| `PROTECTED_ROUTES` at `src/proxy.ts:114` is the **only** authority; re-derive, never trust a copy | `CLAUDE.md` § Auth Flow | Verified: 8 routes, re-derived at line 114. `e2e/fixtures.ts:43-55` already parses this file at load time. Any new spec must reuse `protectedRoutes()`. |
| **Jest is the single runner.** No Vitest. Two projects, routed by directory not extension | `.claude/CLAUDE.md` § Frameworks | New unit tests under `src/**/*.test.ts` land in the `node` project; `src/hooks/**` and `*.test.tsx` land in `jsdom`. Do not write Vitest-style tests. |
| Use the `EventTag` enum, not raw strings | `CLAUDE.md` § Key Patterns | Directly relevant: the centralized tag mapping must be keyed on `EventTag`, and `src/lib/constants.ts` `EVENT_TAGS` / `EVENT_CATEGORIES` are the two existing enumerations to reconcile against. |
| Never modify `.env.local` | both | Local stack credentials come from `npx supabase status -o env`, which is what `e2e/env.ts` already does since `855da7f`. |
| Types in `src/types/index.ts` must stay in sync with the DB schema | `CLAUDE.md` | `Event.tags: EventTag[]` is the frontend contract; `events.tags: string[] \| null` is the DB column. The mapping between them is exactly what Slice 2 centralizes. |
| **"This is NOT the Next.js you know"** — read `node_modules/next/dist/docs/` before writing code | `CLAUDE.md` | Applies to any route-handler signature work (DI-24's 17 `TS2554` "handlers take 2 args" errors are a Next.js 16 signature fact, not a test bug). |
| Test files are excluded from the main tsconfig | `CLAUDE.md` § Important Notes | This is DI-24 / F-066 itself. Closing it changes a documented project fact; `CLAUDE.md` must be updated in the same change. |

**Project skills** (`.agents/skills/`): `supabase` and `supabase-postgres-best-practices` are both
present and both load-bearing here. The Postgres skill's `data-pagination` rule explicitly prefers
**cursor/keyset pagination over OFFSET** — which is the side the skipped contract suite and
`useEvents.ts` are already on, and the side `src/app/api/events/route.ts` is not. Its
`query-missing-indexes` and `schema-foreign-key-indexes` rules were already discharged by Phase 3
plan 03-05. The `supabase` skill's security checklist matters for any new DB function
(`SECURITY INVOKER` by default; `SECURITY DEFINER` in `public` is anon-callable — the mechanism
behind F-074/F-075).

---

<phase_requirements>
## Phase Requirements

| ID | Description (verbatim from REQUIREMENTS.md:74-75) | Research Support |
|----|-------------|------------------|
| **REFAC-09** | *Slice 1 (saved events + RSVP): handlers use the seam kit, RSVP counts use a count query or DB function instead of loading all rows, characterization tests pass before and after* | § Slice 1 Inventory names all 5 handlers and their 3 client consumers; § Q(b) gives the measured count defect and two fix shapes with a recommendation; § Architecture Pattern 1 gives the exact seam-adoption diff shape; § Architecture Pattern 2 gives the characterization-test pattern from `friends-defect.test.ts` |
| **REFAC-10** | *Slice 2 (event read path): events list uses a real club join instead of fabricating club objects, the dual date schema is resolved to the authoritative columns from AUDIT-19, tag mapping is centralized with unknown tags surfaced instead of silently coerced to SOCIAL, `%`/`_` are escaped in search* | § Q(c) locates the fabrication in one function and the 2 routes that trigger it; § Q(d) reproduces AUDIT-19's verdict and re-derives the 8 surviving stale references; § Q(e) measures the tag coercion at 6 of 12 enum members with a runnable probe; § Q(f) gives an empirically verified two-layer escaping recipe and the 400→500 leak it fixes; § Q(g) resolves the pagination contract with a live user-visible symptom |

Both requirements are `Pending` in the ROADMAP traceability table (lines 210-211). Neither has any
prior partial credit.
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Save / unsave an event | API (`/api/events/[id]/save`) | Database (RLS on `saved_events` + `saved_events_count` trigger) | The toggle is a read-then-write decision that must be atomic against one user's rows; the counter is already a DB trigger (`update_saved_events_count`, baseline:593) and must stay there |
| Listing a user's saved events | API (`/api/users/saved-events`) | — | Needs the session; must never be CDN-shareable (F-025/F-026 territory, Phase 6) |
| Saved-events **count and list on `/profile`** | Frontend Server (RSC) | Database | `src/app/profile/page.tsx:37-60` reads `saved_events` directly server-side with `{ count: "exact", head: true }` — it does **not** call the API. This is the in-repo prior art for the RSVP count fix |
| RSVP create/update/cancel | API (`/api/events/[id]/rsvp`) | Database (RLS on `rsvps`) | Ownership is asserted from `getUser()`, and the body's `user_id` is compared to it (403 on mismatch) — correct today, must be preserved |
| **RSVP counts for an event** | **Database** | API | Currently computed in JS after fetching rows. `COUNT(*)` belongs in Postgres; this is the REFAC-09 correction |
| Event list / search / filter / paginate | API (`/api/events`) | Database (`get_event_ids_by_time_filter`, `search_events_fuzzy`) | Two RPCs already push filtering into Postgres; the third concern (pagination) is still application-tier and is the contract question |
| **Mapping DB tag strings → `EventTag`** | **Shared lib** (`src/lib/tagMapping.ts`) | Frontend (theming) | One function, six call sites. Centralization means *one* mapping consulted by both the read path and the ingestion classifier, which today disagree by construction |
| Club data on an event | Database (PostgREST embedded resource) | API | `club:clubs(...)` is a real FK embed; the `organizer`-string fallback is application-tier fabrication and is what REFAC-10 removes |
| Search input escaping | API (before the PostgREST call) | — | PostgREST's `.or()` is documented as an escape hatch the caller must sanitize; there is no DB-tier control that can do this |

---

## Inherited Deferred Items — disposition for this phase

`evidence/deferred-items.md` (the authoritative register) assigns six open items to Phase 4.
**DI-20 and DI-32 are already CLOSED** (quick task `260916-nst` / commit `855da7f`+`b9f9bcb`) and
must not be re-planned.

| Item | What it is | Measured state, today | Recommended disposition |
|---|---|---|---|
| **DI-24** | `tsconfig.json` excludes `**/*.test.ts(x)`, **and** F-066's first clause (zero skipped suites) is unmet because `src/app/api/events/route.test.ts` asserts a cursor contract the handler lacks | **Re-measured in this tree: 77 errors across 8 files** (Phase 2 measured 68 across 6; `friends-defect` +6 and `audit-shape` +3 arrived since). `npx jest --ci` → **1 skipped suite, 5 skipped tests** | **Split across both waves.** The tsconfig un-exclusion rides with **Slice 1** (18 of the 77 are in `rsvp.test.ts`, 9 in `events/analytics.test.ts`). The skipped suite is **Slice 2** — it *is* the pagination contract |
| **DI-25** | `@supabase/supabase-js` 2.81.1 → 2.116.0 (35 minors) reverted in Phase 2 on six `TS2345` errors at data-mutation routes; `@supabase/ssr` 0.7.0 → 0.12.7 is a separate **major** | Verified installed: `supabase-js@2.81.1`, `ssr@0.7.0`, `postgrest-js@2.81.1`. Registry latest: `2.116.0` / `0.12.7` | **Scope the minor into this phase only if the six blocking sites are in scope.** They are not: they are *data-mutation* routes. Recommend **re-deferring the minor to Phase 5** and the `ssr` major to Phase 6+, and recording that decision rather than letting it drift — see § Open Question 3 |
| **DI-30 / F-071** | The last `(supabase as any)` under `src/app/api/`, at `events/[id]/friends/route.ts:38` (cast) / `:48` (the `.in()` call) | Confirmed by reading `postgrest-js` source: `in(column, values)` begins `Array.from(new Set(values))`; a builder is not iterable | **Fix in Slice 1 or as its own wave item.** The friends route is neither saved-events nor the read path, but it is `closes_in_phase: 04` and its DEFECT suite already exists. Its fix is ~4 lines and its validation criterion is precise ("the assertions MOVE rather than being deleted, and `grep -rn "(supabase as any)" src/app/` returns 0") |
| **DI-31** | The `no-restricted-properties` companion rule + wiring `check-elevated-ratchet.mjs` into CI, "together with the first actual shrink" | **There is no shrink available in this phase.** Verified: the 24-entry allow-list contains **zero** Phase 4 slice routes | **Do the CI wiring; defer the shrink.** Wiring the ratchet into `.github/workflows/ci.yml` is independent of a shrink and is a pure enforcement gain. The `no-restricted-properties` design is entangled with DI-34 — do both together or neither |
| **DI-34** | The elevated boundary's `files` glob and the ratchet's `APP_DIR` are `src/app/**` only; `src/lib/audit.ts` reaches the service role indirectly from 10 admin route files | **Measured widened census** (`grep -rl "supabase/service\|@supabase/supabase-js" src/`, tests excluded) finds **5 files beyond the 24**: `src/lib/audit.ts`, `src/lib/supabase/service.ts`, `src/server/authz/requireUser.ts`, `src/server/context.ts`, `src/server/db/elevated/index.ts`. **Three of the five are false positives** — `requireUser.ts` and `context.ts` match only on `import type { User } from "@supabase/supabase-js"` | **Design the widening here; land it as its own plan with its own red/green fixture.** The naive widening would add 5 rows to a shrink-only list. The correct widening carves out `src/lib/supabase/**` (the factory's home) and `src/server/db/elevated/**` (the sanctioned door), ignores type-only imports, and then adds **exactly one** row: `src/lib/audit.ts` |
| **DI-35** | `RequestProfile` selects `banned_at`/`ban_expires_at`; no guard in `src/server/authz/` reads either, and there is no `requireNotBanned` | Re-derived: `grep -rn 'banned_at\|ban_expires_at' src/server/` → 2 hits, both in `context.ts`. `src/proxy.ts:91-110` is the only ban ring and its outer `catch` at `:140-143` returns `NextResponse.next({ request })` — **fail-open**. Separately, `src/lib/ban.ts checkBanStatus()` is called by the **POST** handlers of `save` and `rsvp` but *not* by DELETE or GET | **Decide it, do not add a second ring.** See § Q(h) for the recommendation and its evidence |

---

## Slice 1 Inventory — saved events and RSVP, end to end

Every path below was re-derived by `grep` in this working tree, not transcribed.

### Handlers (5)

| Path | Methods | Auth today | Seam adoption notes |
|---|---|---|---|
| `src/app/api/events/[id]/save/route.ts` | `POST` (toggle), `DELETE` | `getUser()`; POST additionally calls `checkBanStatus()` | 2 handlers × `requireUser`. POST's toggle does a 3-query dance (event exists → existing row → insert/delete) |
| `src/app/api/events/[id]/rsvp/route.ts` | `GET`, `POST`, `DELETE` | `getUser()`; POST calls `checkBanStatus()`. **GET is anonymous-tolerant** — it returns counts to anyone and `user_rsvp: null` when unauthenticated | GET must **not** gain `requireUser` (that is a behaviour change). POST/DELETE → `requireUser`. The `user_id`-in-body vs `getUser()` 403 comparison is correct and must survive verbatim |
| `src/app/api/users/saved-events/route.ts` | `GET` | `getUser()`, 401 on absence | Straight `requireUser`. Note it uses `new Date().toISOString()` for its "not past" floor while `/api/events` uses `getESTNowISO()` — an **unflagged inconsistency**, see Pitfall 6 |
| `src/app/api/calendar/events/route.ts` | `GET` | `getUser()` | Reads **both** `saved_events` and `rsvps` for the user. In scope for Slice 1 by data, adjacent by route. Recommend: characterize, adopt the seam, do not otherwise touch |
| `src/app/api/events/[id]/friends/route.ts` | `GET` | `getUser()`, returns `{friends:[],count:0}` when anonymous | F-071's home. Reads `saved_events` + `user_follows` |

**None of these five appears in `eslint.elevated-allowlist.mjs`.** Confirmed by reading the list:
the 24 entries are admin/clubs/cron/profile/users/auth routes. Slice 1 therefore produces **no**
ratchet movement.

### Client consumers (4)

| Path | Role |
|---|---|
| `src/components/events/RsvpButton.tsx` | `GET /rsvp` on mount for counts + user status; POST/DELETE with **optimistic count arithmetic** (`:62-67`, `:91-104`). The optimistic path is what makes an end-state Playwright assertion necessary rather than a label assertion — already documented at `e2e/specs/save-and-rsvp.spec.ts:20-26` |
| `src/components/events/EventCard.tsx:115` | `POST /save` |
| `src/app/events/[id]/EventDetailClient.tsx:117,197` | `GET /api/users/saved-events` to seed `saved`, `POST /save` to toggle. `EventDetailView.handleSave` flips state **before** the POST |
| `src/app/calendar/page.tsx:630,672,683` | `POST /save`, `POST`/`DELETE /rsvp` |

### Pages that read the same data without the API (do not miss these)

`src/app/profile/page.tsx` is a **Server Component** that queries `saved_events` directly
(`:37-60`) — four separate queries including two `{ count: "exact", head: true }` counts. It never
touches `/api/users/saved-events`. The `save-and-rsvp.spec.ts` assertion "a saved upcoming event
must appear on the profile's saved list" therefore exercises the **RSC path**, not the API path. A
refactor that changes only the API and passes that spec has proven less than it looks.

### Existing test coverage for Slice 1

`npx jest --ci src/__tests__/api/events src/hooks/useEvents.test.ts` → **7 suites, 101 passed, 1
skipped** (measured). Of these:

- `src/__tests__/api/events/rsvp.test.ts` — 16 tests across GET/POST/DELETE. **All are error-path
  tests** (401/400/403/404/500). There is **no** happy-path assertion and **no** count assertion.
- `src/__tests__/api/events/friends-defect.test.ts` — the DEFECT exemplar (F-071), 5 tests.
- **No test exists** for `/api/events/[id]/save`, `/api/users/saved-events`, or
  `/api/calendar/events`.

---

## Slice 2 Inventory — the event read path, end to end

### Handlers that return `Event` objects (7)

All seven funnel through `transformEventFromDB` (`src/lib/tagMapping.ts:97`):

| Path | `select()` | Club source |
|---|---|---|
| `src/app/api/events/route.ts:180` | `*, club:clubs(10 cols)` + `{count:'exact'}` | **real join** |
| `src/app/api/events/new/route.ts:16` | `*, club:clubs(...)` | **real join** |
| `src/app/api/events/following/route.ts:39` | `*, club:clubs(...)` | **real join** |
| `src/app/api/events/happening-now/route.ts:29` | `*, club:clubs(...)` | **real join** |
| `src/app/api/events/popular/route.ts:99` | `*, club:clubs(...), popularity:event_popularity_scores(*)` | **real join** |
| `src/app/api/calendar/events/route.ts:53` | `*, club:clubs(...)` | **real join** |
| **`src/app/api/events/[id]/route.ts:82`** | **`*`** | **FABRICATED** — comment on `:79` reads *"Fetch event without club relation since Clubs table does not exist"*, which is false |
| **`src/app/api/users/saved-events/route.ts:94`** | **`*`** | **FABRICATED** |

### Client consumers of the list

- `src/hooks/useEvents.ts` — the only consumer of `/api/events`. Sends `limit`, `sort`, `direction`,
  and (when set) `cursor`, `tags`, `search`, `dateFrom`, `dateTo`, `clubId`. Reads `data.events`,
  `data.total`, `data.nextCursor`, `data.prevCursor`.
- `src/app/page.tsx:247` and `:270` — two `useEvents()` instances (default feed `limit:100`; filtered
  feed `limit:30` + a **"Load More"** button gated on `nextCursor` at `:510-513`).
- `src/components/events/EventSearch.tsx`, `EventFilters.tsx`, `FilterSidebar.tsx` — build the filter
  state that becomes `search` / `tags`.

---

## The ten open questions, answered

### (a) Which handlers, hooks, components and pages constitute each workflow?

Answered in full in the two inventories above. Counts: **Slice 1 = 5 handlers + 4 client consumers +
1 RSC page**; **Slice 2 = 8 handlers (7 list-shaped + 1 detail) + 1 hook + 1 page + 3 filter
components**. `[VERIFIED: grep over src/ in this working tree]`

### (b) How are RSVP counts computed today, and what would a count query look like?

**Today** — `src/app/api/events/[id]/rsvp/route.ts:93-105`:

```ts
const { data: rsvps } = await supabase
  .from("rsvps").select("id, status")
  .eq("event_id", eventId).neq("status", "cancelled");
const goingCount      = rsvps?.filter((r) => r.status === "going").length ?? 0;
const interestedCount = rsvps?.filter((r) => r.status === "interested").length ?? 0;
```

**The defect is not merely "slow" — it is wrong above 1000 rows.** `supabase/config.toml:18` sets
`max_rows = 1000`. PostgREST caps a row-returning `select` at that value, so an event with 1,200
going RSVPs reports at most 1,000, silently, with no error and no log line.
`[VERIFIED: supabase/config.toml:18]`

**The fix.** `supabase-js` `select(columns, { count, head })` sets `Prefer: count=<algorithm>` and
switches the HTTP method to `HEAD` when `head: true` (read from
`node_modules/@supabase/postgrest-js/dist/cjs/PostgrestQueryBuilder.js:18-53`). The count is a
server-side `COUNT(*)` and is **not** subject to `max_rows`. Measured against the running local
stack: `HEAD /rest/v1/events?select=id&status=eq.approved` with `Prefer: count=exact` returned
`Content-Range: 0-1/2`. `[VERIFIED: local Supabase stack, 2026-09-16]`

Two shapes are available; **recommend (A)**:

| | (A) Two count queries | (B) One DB function |
|---|---|---|
| Round trips | 2 (parallelizable with `Promise.all`) | 1 |
| Migration required | no | yes — plus pgTAP, plus `supabase gen types`, plus a green `types` drift job |
| RLS semantics | **identical to today** (the count is RLS-filtered exactly as the row select was) | `SECURITY INVOKER` needed to stay identical; `SECURITY DEFINER` would change who can see what and lands in F-074/F-075 territory |
| Production-push exposure | none | the migration is local-only until Phase 8 (DI-23), so the fix ships to prod later than the code that calls it |
| Verdict | **Recommended.** REFAC-09 explicitly permits "a count query **or** DB function" | Defer; revisit if a future slice needs per-event counts in a list |

```ts
const [going, interested] = await Promise.all([
  supabase.from("rsvps").select("id", { count: "exact", head: true })
    .eq("event_id", eventId).eq("status", "going"),
  supabase.from("rsvps").select("id", { count: "exact", head: true })
    .eq("event_id", eventId).eq("status", "interested"),
]);
const goingCount = going.count ?? 0;
const interestedCount = interested.count ?? 0;
```

Note the predicate change: today's single query is `.neq("status","cancelled")` then filters in JS,
so a row with any *third* status value would be counted in neither bucket but **would** be excluded
from `total`… except `total` is computed as `going + interested`, so it wouldn't. The two-query form
is behaviourally identical for the two statuses the schema uses (`VALID_STATUSES = ["going",
"interested"]`, plus `"cancelled"`). **A PRESERVE test should pin `total === going + interested`.**

`src/app/profile/page.tsx:37-41` is the **in-repo prior art** for this exact pattern — cite it in
the plan so the change reads as "apply the pattern this repo already uses", not as novel.

### (c) Where are club objects fabricated, and what does a real join cost?

**One function, two triggering routes.** `src/lib/tagMapping.ts:100-143`:

```ts
if (dbEvent.club) { club = { …10 real columns, 6 hard-coded nulls… }; }
else if (dbEvent.organizer) {
  club = { id: dbEvent.organizer, name: dbEvent.organizer, /* everything else null */ };
}
```

The fabricated object sets **`club.id` to the organizer string** — which is not a UUID and is not a
`clubs.id`. Any consumer that links to `/clubs/{club.id}` from a fabricated club produces a dead
link. The two routes that reach this branch are `/api/events/[id]` and `/api/users/saved-events`
(both `select("*")`).

**A second, quieter fabrication** exists even on the *real* branch: `banner_url`, `website_url`,
`discord_url`, `twitter_url`, `linkedin_url` and `contact_email` are hard-coded `null` because the
embed's column list omits them. Callers cannot distinguish "the club has no website" from "the API
didn't ask". `[VERIFIED: src/lib/tagMapping.ts:104-121]`

**Cost of the real join.** The embed is a PostgREST FK resource embed on `events.club_id →
clubs.id`. `clubs.id` is the primary key and `events.club_id` was given an index by Phase 3 plan
03-05 (`20260915230000_fk_indexes_and_policy_gaps.sql`). Under RLS the embed applies the `clubs`
SELECT policy — and F-022 records that the club read policy **ignores `status`**, so pending and
rejected clubs are already publicly readable; adding the join to two more routes therefore exposes
nothing that the other six routes do not already expose. `[VERIFIED: findings.json F-022; migration
file read]` **Measure the added latency with an `EXPLAIN` or a timed local request in the plan** —
do not assert "negligible" without a number, per the program's own evidence discipline.

**Behaviour question the plan must answer:** what should `club` be when `club_id IS NULL` *and*
`organizer` is set? Deleting the fallback outright changes what `/api/events/[id]` returns for
scraped Instagram events (which the classifier writes with `organizer` and no `club_id`). Options:
`club: undefined` + keep `event.organizer` for display (the honest shape, and `Event.organizer`
already exists on the type), or a discriminated `{ kind: "organizer-string" }`. **Recommend the
former**, with a DEFECT test that flips.

### (d) What did AUDIT-19 conclude, and where are the non-authoritative columns still read?

**Verdict, verbatim** from `.planning/audit/schema/events-date-columns.md`:

> **The older `event_date` / `event_time` pair does not exist in production.**
> **The authoritative event scheduling columns on `public.events` are `start_date` and `end_date`,
> both `timestamp with time zone`, both `NOT NULL`.**

Confirmed independently against the generated types: `src/lib/supabase/types.ts:388-414` declares
`end_date: string` and `start_date: string` (both non-optional in `Row`) and no `event_date` /
`event_time`. `[VERIFIED: types.ts + information-schema-columns.json]`

**"Resolving the dual date schema" in this phase therefore means deleting the residue, not migrating
data.** Re-derived today — **8 occurrences across 4 files** (F-050 listed 5 locations; plan 02-08
already fixed `useEvents.test.ts`):

| File | Lines | What |
|---|---|---|
| `src/__tests__/api/clubs/analytics.test.ts` | 166, 167, 168 | 3 mock rows keyed on `event_date`; the route selects `start_date` → `start_date` is `undefined` throughout and the assertions look elsewhere |
| `src/__tests__/api/events/analytics.test.ts` | 95, 112, 140 | same defect, 3 mock rows |
| `src/lib/tagMapping.ts` | 98 | comment: *"no more event_date/event_time split"* |
| `supabase/functions/events-webhook/index.ts` | 99 | comment asserting `club_id` and `status` are **absent** from `events` — both are present (types.ts:391, 410) |

**A ninth stale comment, not in F-050**, was found: `src/app/api/events/[id]/route.ts:79` —
*"Fetch event without club relation since Clubs table does not exist"*. It is the *cause* of the
fabrication in (c). The plan should fix the comment and the `select()` in the same commit.

F-050's `closes_in_phase` is `null`. **Recommend Phase 4 claims it** — its validation criterion
("a grep asserting no occurrence … and the three analytics tests still passing after the fixtures are
corrected") is exactly this phase's work, and correcting the fixtures is *also* how two of DI-24's
77 type errors go away.

### (e) Where are tags coerced to SOCIAL, and how is "surfaced" observable without a visual change?

**Measured, not reasoned.** A throwaway Jest probe was run against `mapTags` and deleted
(`git status` confirmed clean afterward):

```
ENUM MEMBER  -> mapTags RESULT        Enum members ABSENT from tagMapping: ["tech","food","volunteer","arts"]
academic     -> academic              Aliases that REMAP a real enum member: ["music","networking"]
social       -> social                tagMapping key count: 22
sports       -> sports                unknown tag 'quidditch' -> social
career       -> career
cultural     -> cultural
wellness     -> wellness
music        -> cultural   ← lossy
tech         -> social     ← coerced
food         -> social     ← coerced
volunteer    -> social     ← coerced
arts         -> social     ← coerced
networking   -> social     ← coerced
```

**6 of the 12 `EventTag` members do not round-trip.** `[VERIFIED: runnable probe, this tree,
2026-09-16]`

This is not theoretical. Three independent facts make it live:

1. `src/lib/constants.ts:7-20` lists **all 12** in `EVENT_TAGS` (the filter chips) and
   `:22-143` gives **all 12** a full theme in `EVENT_CATEGORIES` (label, colours, border, icon).
2. `src/lib/classifier.ts:553-584` assigns **all 12** when ingesting Instagram posts. The write path
   and the read path disagree by construction.
3. The **seed** proves it end to end. `curl` against the local stack returns
   `{"title":"Seed Approved Event","tags":["academic","tech"]}` and
   `{"title":"Seed Approved Music Night","tags":["music","social"]}`. Rendered, those become
   `[academic, social]` and `[cultural, social]`. `[VERIFIED: local stack, 2026-09-16]`
4. The round trip is inconsistent in *both* directions: `/api/events?tags=tech` filters the raw DB
   column via `.overlaps('tags', ['tech'])` and **does** match that event — but the card it returns
   displays a "Social" badge. Filtering by `social` does **not** return it, though its badge says
   social.

**"Surfaced rather than coerced", without a visual change — how.** Criteria 3 and 4 are in tension
here, and the plan must say so out loud. Three observable channels, in increasing visibility:

| Channel | Visual change? | Recommendation |
|---|---|---|
| A **test** that enumerates `Object.values(EventTag)` and asserts every member is a key of the mapping, plus one asserting `mapTags(["quidditch"])` is not silently `social` | none | **Required.** This is the machine-checkable form of "surfaced" and it is what makes the mapping *stay* centralized |
| A structured server-side warning (one `console.warn` today; a logger in Phase 6) naming the unmapped tag and the event id | none | **Recommended.** Cheap, and it is the only channel that reports *unknown* (non-enum) tags from the scraper |
| Returning the unmapped tag to the client as itself, or as an `unknownTags` field | **yes — a badge appears or changes colour** | **Split into a second, logged commit.** The roadmap's cross-cutting discipline already permits this: *"each slice landing as one reviewable change naming the finding IDs it closes and any intentional behavior change logged"* |

**Recommended split, explicitly:** Slice 2 commit *N* centralizes the mapping (one exported
function, one exported alias table, the completeness test, the warning) with `mapTags`' output
byte-identical — a pure refactor, harness green, zero visual delta. Slice 2 commit *N+1* adds the six
missing identity mappings as a **logged intentional behaviour change**, with its DEFECT test's
assertions moving from `expect(mapTags(["tech"])[0]).toBe(EventTag.SOCIAL)` to
`…toBe(EventTag.TECH)`, and with the Playwright badge assertion updated in the same commit. If the
phase owner would rather not ship the visual change in Phase 4, commit *N+1* is the one to defer —
and it must be deferred **in writing with an owner**, per this program's rule.

### (f) How does search input reach `ilike`, and where must `%`/`_` escaping go?

**F-078 confirmed live, not inferred.** Against the running local stack:

```
POST /rest/v1/rpc/search_events_fuzzy {"search_term":"jazz","result_limit":5}
→ {"code":"0A000","message":"SET is not allowed in a non-volatile function"}
```

`[VERIFIED: local Supabase stack, 2026-09-16]` The function is `LANGUAGE plpgsql STABLE` with
`SET pg_trgm.similarity_threshold = 0.1;` as its first body statement
(`20260915214553_baseline.sql:352-356`). **Every search on every deployment falls through to the
ILIKE branch at `src/app/api/events/route.ts:222-224`.** F-078 is owned by Phase 5, and that
ownership is correct — but the consequence for Phase 4 is that the ILIKE path is not a fallback, it
is **the** path, and escaping it is not optional.

The ILIKE path is:

```ts
eventsQuery = eventsQuery.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
```

**`.or()` performs no escaping whatsoever.** Read from source:
`node_modules/@supabase/postgrest-js/dist/cjs/PostgrestFilterBuilder.js:356-360` appends
`` `(${filters})` `` verbatim. Only `.in()` escapes, and only against
`PostgrestReservedCharsRegexp = /[,()]/` (`:5`, `:151-163`). The library's own docstring for
`.filter()` calls it *"an escape hatch … you also need to make sure they are properly sanitized."*
`[VERIFIED: postgrest-js 2.81.1 source]`

**Measured consequences, on the local stack:**

| Search term | HTTP | Body |
|---|---|---|
| `a,b` (unquoted, as today) | **400** | `PGRST100 … "failed to parse logic tree ((title.ilike.%a,b%,description.ilike.%a,b%))" (line 1, column 20)` |
| `a)` , `(a` , `a.b` , `a"b` (unquoted) | 200 | `[]` — silently wrong, not an error |
| `a,b` wrapped in double quotes | 200 | `[]` |

`[VERIFIED: curl against local PostgREST, 2026-09-16]`

**And the 400 becomes a 500 that leaks the query.** `route.ts:283-289` treats only `PGRST103`,
`PGRST116`, and a message starting with `{` as benign. `PGRST100`'s message starts with `"`, so the
handler returns **HTTP 500 with `safeMessage` = the full internal filter string**, to the browser.
Typing a comma in the search box is a user-triggerable 500 that discloses the query structure.
`[VERIFIED: code read + the 400 above]`

**The escaping recipe — two layers, empirically derived.** Inside a PostgREST double-quoted value,
the quoted-string grammar consumes one backslash before SQL `LIKE` sees the pattern. Measured:

| Pattern sent | Result on seeded data | Interpretation |
|---|---|---|
| `or=(title.ilike."%_%",…)` | matches both events | `_` is a live LIKE wildcard |
| `or=(title.ilike."%\_%",…)` | matches both events | one backslash is eaten by the quoted-string layer; `_` is still a wildcard |
| `or=(title.ilike."%\\_%",…)` | `[]` | **correct** — literal underscore |
| `or=(title.ilike."%\%",…)` | matches both events | one backslash eaten → pattern became `%%` |
| `or=(title.ilike."%\\%",…)` | `[]` | **correct** — literal percent |
| `or=(title.ilike."%Music%",…)` | matches 1 event | wildcards still work inside quotes |

`[VERIFIED: local PostgREST, 2026-09-16]`

So the escape is two composed transforms, in this order:

```ts
/** Layer A — SQL LIKE: make %, _ and \ literal. Backslash is Postgres's
 *  default LIKE escape character, so no ESCAPE clause is needed (and
 *  PostgREST exposes none). */
const likeLiteral = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c);

/** Layer B — PostgREST quoted value: \ and " are escaped, then the whole
 *  value is wrapped in double quotes so , ( ) . cannot break out of the
 *  or=(...) group. */
const postgrestQuoted = (s: string) =>
  '"' + s.replace(/[\\"]/g, (c) => "\\" + c) + '"';

const pattern = postgrestQuoted("%" + likeLiteral(term) + "%");
// .or(`title.ilike.${pattern},description.ilike.${pattern}`)
```

Applied to `_` this yields `"\\_"` — the form measured correct above. Applied to `%` it yields
`"\\%"` — likewise. **Verify the `"` and `\` cases with their own assertions in the plan**: the
seeded data contains neither character, so those two rows of the table above could not be
discriminated by observation and rest on the two-layer model rather than on a measurement (see
Assumption A2).

**Where the escaping goes.** In `src/lib/` as a named, unit-tested function — **not** inline in the
route. Two reasons: it must be reused if any other handler ever calls `.or()`, and a named function
is the thing a test can prove escapes each of the five characters. Do **not** put it in
`search_events_fuzzy` — that function is Phase 5's and it is currently unreachable.

### (g) What does REFAC-10's pagination contract require, and how does it interact with DI-24?

**The client and the server have never agreed, and the divergence is user-visible.**

| | `src/hooks/useEvents.ts` | `src/app/api/events/route.ts` |
|---|---|---|
| Sends / reads | `cursor`, `sort`, `direction`, `clubId`; reads `nextCursor`, `prevCursor` | reads `page`, `limit`, `tags`, `search`, `dateFrom`, `dateTo`, `ids`, `timeOfDay`, `dayType` |
| Pagination | keyset (`{sortValue, id}` base64) | `.range(from, to)` — OFFSET |
| Returns | — | `{events, total, page, limit, totalPages}` |

`grep -c -i cursor` → **27 in the skipped suite, 0 in the handler**. The handler ignores `cursor`,
`sort`, `direction` and `clubId` entirely; `sort`/`direction` happen to coincide with the hard-coded
`.order('start_date', {ascending:true})`, which is why nobody noticed.

**The live symptom.** `src/app/page.tsx:510-513` renders the **"Load More"** button only
`{nextCursor && …}`. `nextCursor` is `data.nextCursor ?? null` and the route never emits it, so the
button **never renders**. A user who searches or filters sees at most `limit: 30` results and has no
way to reach a second page. `loadMore`, `goToNext`, `goToPrev` and `loadAll` are all dead for the
same reason. `[VERIFIED: code read, both files]`

**How to decide which side is authoritative.** The evidence points one way:

- `.planning/phases/02-…/evidence/skipped-suite-disposition.md` § 3 hands REFAC-10 the question and
  warns that the 20 executing `useEvents.test.ts` tests assert cursor semantics **against a mocked
  `fetch`**, so *"they will not catch this divergence."*
- The project skill `.agents/skills/supabase-postgres-best-practices/references/data-pagination.md`
  is titled **"Use Cursor-Based Pagination Instead of OFFSET"** and gives the multi-column form
  `where (created_at, id) > (…)` — exactly the `{sortValue, id}` shape the skipped suite encodes.
  `start_date` is not unique, so a single-column cursor would skip or repeat rows.
- Phase 1's rule T-01-11-04 forbids reviving the suite against current behaviour: *"recording broken
  behaviour as the contract would launder a defect into a specification."*

**Recommendation: implement the cursor contract in the route** (client and skipped suite are the
surviving description of intent), keep `page`/`limit` accepted for one release so nothing that
currently works breaks, and **rewrite the skipped suite** rather than deleting it. Three complications
the plan must confront, because they are the reason this is a whole slice and not a task:

1. `search` replaces the ordering with a fuzzy-rank order (`fuzzyRankedIds`, `route.ts:314-322`) —
   which is dead today (F-078) but will not be after Phase 5. A cursor over a rank order needs a
   different key.
2. `timeOfDay`/`dayType` and `ids` reduce to an `.in('id', …)` set; a keyset cursor over a bounded
   `IN` list is possible but the empty-set early returns (`:246-266`) bypass pagination entirely.
3. `total` / `totalPages` are part of the current response and `{count:'exact'}` is already
   requested. Keep them; a cursor response may carry both.

**Interaction with DI-24.** F-066 has two clauses and they resolve in two different waves:

- *"zero skipped suites"* → **Slice 2**, because the suite is the pagination contract.
- *"test files type-checked"* → best landed with **Slice 1**, because 18 of the 77 errors are in
  `rsvp.test.ts` and 9 in `events/analytics.test.ts`, both Slice 1 territory.

**Measured cost of removing the tsconfig exclusion, in this tree today:**

```
77 errors, 8 files
  TS2451 Cannot redeclare block-scoped variable   29 ┐ cross-file scope collision
  TS2393 Duplicate function implementation        13 ┘ (mockUser ×6, mockSupabase ×6, mockAuthError ×5, GET ×5, mockQueryResults ×4, POST ×3)
  TS2554 wrong argument count                     17 ┐ route handlers take 2 args in Next.js 16
  TS2352 unsafe conversion                        15 ┘ NextRequest handler cast to a Request handler
  TS2353 / TS2339 / TS2322                         3   genuine drift (see below)

rsvp 18 · reviews 17 · events/analytics 9 · clubs/analytics 9 · get-events 8 ·
date-validation 7 · friends-defect 6 · audit-shape 3
```

`[VERIFIED: throwaway tsconfig probe, this tree, 2026-09-16]`

The 42 collisions are fixed by adding `export {}` to the colliding files — mechanical. The 3 genuine
ones are worth naming because each is a real fixture lie:

- `date-validation.test.ts:100` — `email` supplied to a `{ id: string }`
- `friends-defect.test.ts:112` — the Next.js 16 handler signature
- `friends-defect.test.ts:192` — `rpc` missing from the narrowed mock type

**The 32 `TS2554`/`TS2352` errors are the dangerous ones.** Phase 2 wrote down why and the warning
still stands: *"the obvious-looking fix is to widen the handler signatures under `src/app/**`. That
is a behaviour change disguised as a type fix."* Fix them **in the test files**, by typing the
handler references correctly, never by touching a route signature.

### (h) What do DI-34 and DI-35 require of the seam application here?

**DI-34 — the boundary's reach.** The widened census is measured above. The design the plan needs:

```js
// scripts/check-elevated-ratchet.mjs
- const APP_DIR = join(REPO_ROOT, "src", "app");
+ const SCAN_DIR = join(REPO_ROOT, "src");
+ // Not a loosening: three directories are the credential's *home*, not a reach into it.
+ const EXEMPT = ["src/lib/supabase/", "src/server/db/elevated/"];
+ // And a type-only import is not a reach: `import type { User } from "@supabase/supabase-js"`
+ // matches the marker but cannot construct a client.
```

Without the carve-outs the widened census adds **5** rows to a list whose header says it may only
shrink. With them it adds **exactly one**: `src/lib/audit.ts`. That one addition is the whole point
— it is the indirect reach that ten admin route files and fourteen callsites use today, and the
thing `REGISTRY.md`'s "known elevated caller neither control can see" paragraph currently documents
in prose because no control could count it.

**Do this as its own plan with its own red/green fixture** (a throwaway `src/lib/probe.ts` importing
the service module, imported by a route, proving the widened rule bites on an *indirect* import).
Regenerating the allow-list inside a slice diff is precisely how a ratchet gets quietly reset — the
register says so, and plan 03-08 already refused that shortcut once.

**DI-35 — should `requireUser` enforce the ban?** The evidence:

- `src/proxy.ts:91-110` is the only ban ring. Its outer `catch` at `:140-143` returns
  `NextResponse.next({ request })` — **fail-open by construction**.
- F-003: the entire proxy authentication ring is environment-variable-conditional.
- F-062: the ban ring answers JSON API calls with a **307 redirect to an HTML page**, on 92 routes.
- `src/lib/ban.ts checkBanStatus()` is a *second* ban check that already exists and is called by
  exactly two handlers in this phase's scope: `save` **POST** and `rsvp` **POST**. Not `DELETE`, not
  `GET`. So a banned user can today un-save and cancel an RSVP but not create one.
- `grep -rn 'banned_at\|ban_expires_at' src/server/` → 2 hits, both in `context.ts`. No guard reads
  them.

**Recommendation: narrow `RequestProfile` and its docblock; do NOT add `requireNotBanned` in this
phase.** Reasons, in order:

1. Adding a third ban ring whose disagreement with the other two is unspecified is exactly the
   failure DI-35 warns about, and F-062 proves the existing ring already disagrees with itself about
   response format.
2. Ban enforcement is **REFAC-11, Phase 5** — *"middleware is advisory-only and the ban check fails
   closed"* — by name. Doing it here pre-empts the slice that owns it and does so without the
   characterization harness that slice is supposed to inherit.
3. Narrowing the type to the three columns something actually reads (`id`, `roles`,
   `onboarding_completed`) makes the docblock true today and costs one extra read *if and when*
   Phase 5 adds the guard — a cost Phase 5 will pay knowingly.
4. **Preserve `checkBanStatus()` exactly where it is called today.** Moving it into the seam, or
   adding it to `DELETE`, is a behaviour change. Pin its current asymmetry with a PRESERVE test so
   Phase 5 inherits a measured starting point rather than a guess.

Record the decision in the plan and in `STATE.md` as a `DEC-`, with the narrowing as the deliverable
and the guard as Phase 5's.

### (i) What does DI-31 require, and is there a shrink to do?

Two gaps, and **only one of them has a home in this phase**.

- **CI wiring.** `scripts/check-elevated-ratchet.mjs` is invoked by path and appears in neither
  `package.json` nor `.github/workflows/ci.yml` (verified by reading both). It runs clean today:
  `committed=24 live=24 delta=0`, exit 0. Wiring it as a step in the `ci` job — between "Migration
  filename parse check" and "Run tests", where its sibling structural check already lives — is a
  pure enforcement gain independent of any shrink. **Do it.** Phase 3's stated reason for deferring
  ("three plans in this phase touch that file") no longer applies if exactly one Phase 4 plan owns
  the workflow file.
- **The shrink.** **There is none available.** The 24 allow-list entries are admin, clubs, cron,
  profile, users and auth routes. None of the 13 handlers in Slices 1 and 2 imports the service-role
  client. Manufacturing a shrink by migrating an unrelated admin route into this phase would break
  the slice boundary and pre-empt REFAC-13. **Record "no shrink available in Phase 4, by
  measurement" rather than leaving DI-31 to look half-done for an unstated reason.**
- **The `no-restricted-properties` companion rule.** Its blocker is unchanged: scoped as originally
  written it bans `process.env` outright in the app layer and 12 legitimate `NEXT_PUBLIC_*` reads
  across 5 files become errors. The narrow form must name `SUPABASE_SERVICE_ROLE_KEY` specifically.
  **Ship it together with DI-34's widening or not at all** — they are one design.

### (j) Does the `@supabase/supabase-js` minor bump belong in this phase?

**Recommend: no, and record the refusal.**

- Installed: `supabase-js 2.81.1`, `postgrest-js 2.81.1`, `ssr 0.7.0`. Registry latest:
  `supabase-js 2.116.0`, `ssr 0.12.7`. `[VERIFIED: npm view + node_modules read, 2026-09-16]`
- Phase 2 measured the blocker: six `TS2345` errors across six **data-mutation API routes**,
  every one silenceable only by a cast or by widening an update payload's type. Plan 03-06 fixed
  one of the six (`logAdminAction`'s `metadata` narrowed to the generated `Json` type) and produced
  the worked example for the other five.
- DI-25 routes the minor here on the reasoning that *"the slice that characterizes the saved-events
  and RSVP mutation paths is the first phase that can fix those call sites honestly."* That reasoning
  is sound **only for sites inside this phase's slices** — and the six sites are not named. The plan
  must **identify the six sites first** and only then decide; if they sit in admin/club/moderation
  routes, they belong to Phase 5 with REFAC-12/13.
- **The bump closes no advisory.** `npm audit --audit-level=high --omit=dev` is clean today. Nothing
  security-relevant is deferred.
- Every query-builder surface these slices touch was read at **2.81.1** — `.or()`, `.ilike()`,
  `.in()`, `select(_, {count, head})`. The count/head behaviour and the `.or()` no-escaping behaviour
  are properties of 2.81.1 as installed, so the escaping and count work is correct against the
  version that is actually running.
- `@supabase/ssr` 0.7 → 0.12 is a **major** and touches cookie/session handling — the exact surface
  Phase 5's REFAC-11 owns. Defer to Phase 5 at the earliest.

**Deliverable for this phase: a one-paragraph written decision** (six sites enumerated with their
owning phase) so DI-25 does not cross a third phase undecided.

---

## Standard Stack

**No new runtime or dev dependency is required by this phase.** Everything needed is installed and
in use.

### Core (all already present)
| Library | Version (installed) | Purpose | Why standard here |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.81.1 | Query builder, `count`/`head`, `.or()`, `.ilike()` | The whole data layer; do not bump in this phase (§ Q(j)) |
| `@supabase/ssr` | 0.7.0 | Cookie-based server client | Untouched; the major is Phase 5+ |
| `next` | ^16.3.5 | App Router route handlers | Handler signature is 2-arg — relevant to DI-24's `TS2554`s |
| `jest` / `ts-jest` | 30.2.0 / 29.4.6 | The single test runner, two projects | Characterization suites |
| `@playwright/test` | 1.63.0 (pinned exact) | The 27-test persona harness | The before/after regression net |

### Supporting (already present)
| Library | Version | When to use |
|---------|---------|-------------|
| `@testing-library/react` + `jest-dom` | 16.3.3 / 7.0.1 | Only if a component-level characterization test is needed (`jsdom` project) |
| `tsx` | ^4.21.0 | `npx tsx scripts/seed/load.ts` |
| Supabase CLI | **pinned 2.115.0 in CI** | `supabase test db --local`, `gen types --local`. Generator output is not byte-stable across versions — do not use a different CLI locally when regenerating types |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Two `{count:'exact', head:true}` queries | A `get_event_rsvp_counts(uuid)` SQL function | One round trip, but a migration + pgTAP + type regeneration + a green `types` drift job, and the migration cannot reach production until Phase 8 (DI-23). Not worth it for one endpoint |
| A hand-written PostgREST escaper | `zod` + a transform | `zod` is not installed and `src/contracts/` is **REFAC-15, Phase 6** by name. Introducing it here pre-empts that requirement |
| Rewriting the search to `.textSearch()` / `tsvector` | — | A different search algorithm is a behaviour change, and F-078's owner is Phase 5 |
| Deleting the skipped contract suite | Rewriting it against the decided contract | Deleting removes the only written statement of the cursor contract at the moment we know the client still depends on one (02-08 § 2.5) |

**Installation:** none.

---

## Package Legitimacy Audit

**This phase installs no external packages.** The gate is therefore recorded as examined-and-empty
rather than skipped, and the three packages whose *versions* are in question were checked against the
registry:

| Package | Registry | Installed | Latest | Source Repo | Verdict | Disposition |
|---|---|---|---|---|---|---|
| `@supabase/supabase-js` | npm | 2.81.1 | 2.116.0 | github.com/supabase/supabase-js | OK | **Not bumped** — see § Q(j) |
| `@supabase/ssr` | npm | 0.7.0 | 0.12.7 | github.com/supabase/auth-helpers | OK | **Not bumped** — major, Phase 5+ |
| `@supabase/postgrest-js` | npm | 2.81.1 (transitive) | — | github.com/supabase/postgrest-js | OK | Read as source of truth for `.or()`/`.in()`/`count` behaviour |

**Packages removed due to [SLOP] verdict:** none — no new package was proposed.
**Packages flagged as suspicious [SUS]:** none.

If the plan later decides to take the `supabase-js` minor, it must run
`gsd-tools query package-legitimacy check --ecosystem npm @supabase/supabase-js` and re-run the
clean-room install, because Phase 2's lockfile discipline (reviewed as diffs, never regenerated)
applies to every version move.

---

## Architecture Patterns

### System Architecture Diagram

```
                    ┌──────────────────────── BROWSER ────────────────────────┐
  user types  ───►  │ EventSearch / EventFilters / FilterSidebar              │
  a search term     │            ↓ filter state                               │
                    │ src/app/page.tsx ──► useEvents(filters, limit, sort)    │
                    │            │  builds ?cursor&sort&direction&search&tags │
                    │            │  reads  data.nextCursor ← ALWAYS null      │
                    │            │         ("Load More" never renders)        │
                    │ EventCard ─┤ RsvpButton ─┤ EventDetailClient ─┐         │
                    └────────────┼─────────────┼───────────────────┼─────────┘
                       fetch     │             │                   │
       ┌───────────────────────────────────────────────────────────┴───────────┐
       ▼                         ▼             ▼                               ▼
┌──────────────┐  ┌────────────────────┐ ┌──────────────┐  ┌────────────────────────┐
│ GET          │  │ POST/DELETE        │ │ GET/POST/DEL │  │ GET                    │
│ /api/events  │  │ /api/events/:id/   │ │ /api/events/ │  │ /api/users/saved-events│
│              │  │        save        │ │  :id/rsvp    │  │                        │
│ 1 validate   │  │ checkBanStatus()   │ │ GET: anon OK │  │ getUser() → 401        │
│   timeOfDay  │  │   (POST only)      │ │ POST/DEL:    │  │        │               │
│   dayType    │  │ getUser() → 401    │ │  getUser()   │  │        ▼               │
│ 2 rpc        │  │        │           │ │  + body      │  │ saved_events →ids      │
│   search_    │  │        ▼           │ │    user_id   │  │        ▼               │
│   events_    │  │ events exists?     │ │    ==403     │  │ events.select("*")     │
│   fuzzy ─────┼──┼─► ALWAYS 0A000     │ │      │       │  │   ← NO CLUB JOIN       │
│   │ error    │  │        ▼           │ │      ▼       │  └───────────┬────────────┘
│   ▼          │  │ saved_events row?  │ │ rsvps.select │              │
│ 3 .or(ILIKE) │  │   yes→DELETE       │ │  ("id,status")│             │
│   ← RAW      │  │   no →INSERT       │ │  ← ALL ROWS  │              │
│     INTERP.  │  │        ▼           │ │    capped at │              │
│ 4 filters    │  │  trigger updates   │ │    max_rows  │              │
│ 5 .range()   │  │  users.saved_      │ │    = 1000    │              │
│   ← OFFSET,  │  │  events_count      │ │      ▼       │              │
│     not      │  └────────────────────┘ │ .filter() in │              │
│     cursor   │                         │   JavaScript │              │
└──────┬───────┘                         └──────────────┘              │
       │  events rows (+ club embed)                                   │
       ▼                                                               ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│  src/lib/tagMapping.ts :: transformEventFromDB()   ← the single shared chokepoint  │
│    • club present  → copy 10 cols, hard-code 6 nulls                              │
│    • club absent   → FABRICATE from organizer string (club.id = a non-UUID)       │
│    • tags          → mapTags(): 6 of 12 EventTag members do not round-trip        │
└───────────────────────────────────────────────────────────────────────────────────┘
       │                                                               │
       ▼                                                               ▼
┌──────────────────────────── POSTGRES (local; prod untouched until Ph.8) ──────────┐
│ events(start_date,end_date NOT NULL · club_id · organizer · tags text[] · status) │
│ clubs · saved_events(+trigger update_saved_events_count) · rsvps(+updated_at trg) │
│ RLS on every table · PostgREST max_rows = 1000                                    │
└───────────────────────────────────────────────────────────────────────────────────┘

  SEPARATE PATH, easy to miss:
  src/app/profile/page.tsx (RSC) ──► saved_events {count:'exact', head:true}  ──► Postgres
     (the save-and-rsvp Playwright spec asserts through THIS path, not the API)
```

### Recommended Project Structure

No new top-level directory. The phase adds files in three places that already exist:

```
src/
├── server/                 # the seam kit — ADOPT, do not extend
│   ├── context.ts          #   ← narrow RequestProfile (DI-35)
│   └── authz/requireUser.ts
├── lib/
│   ├── tagMapping.ts       #   ← split: transformEventFromDB stays, mapping moves out
│   ├── eventTags.ts        #   ← NEW: the centralized tag mapping + completeness test hook
│   └── searchFilter.ts     #   ← NEW: the PostgREST/LIKE escaper
└── __tests__/api/events/   # characterization suites live beside the existing 6
    ├── save-characterization.test.ts        # NEW
    ├── saved-events-characterization.test.ts # NEW
    ├── rsvp-count-defect.test.ts            # NEW (DEFECT, cites new F-nnn)
    └── events-list-characterization.test.ts # NEW
e2e/specs/
└── save-and-rsvp.spec.ts   #   ← EXISTING, the before/after net
```

### Pattern 1: Seam adoption — the shape of a correct diff

The seam was built to make this a mechanical, byte-preserving change. `src/server/errors.ts`'s own
docblock states the contract: *"Every helper here emits a response that is byte-identical to what
handlers under `src/app/**` already return."*

```ts
// Source: src/server/context.ts + src/server/authz/requireUser.ts + src/server/errors.ts
// BEFORE
const supabase = await createClient();
const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// AFTER — same bytes on the wire, one revalidating read per request
const ctx = await createRequestContext();
const auth = requireUser(ctx);
if (!auth.ok) return auth.response;     // unauthorized() === { error: "Unauthorized" }, 401
const { user } = auth;
const { supabase } = ctx;
```

Three rules that make this safe:

1. **Guards return, never throw** — the repo's existing convention, preserved deliberately.
2. `createRequestContext()` is called **once at the top** of each handler and threaded down.
   *Do not* use `getRequestContext()` in a route handler — `context.ts`'s docblock says so, and the
   React 18.3.1 `cache` fallback it documents is an un-memoized re-read.
3. The seam's own unit tests (`src/server/__tests__/`, 7 files) already pass. Adoption must not need
   a change to any of them; if it does, the adoption is changing behaviour.

### Pattern 2: Characterization tests — PRESERVE and DEFECT

The exemplars are in-tree and must be followed, not reinvented:

| Tag | Exemplar | What it asserts |
|---|---|---|
| **DEFECT** | `src/__tests__/api/events/friends-defect.test.ts` | Pins **today's wrong behaviour**, cites `F-071` in its header, and states in prose that it *"passes today and is expected to keep passing until the fixing slice lands"*. Its mock **re-implements the real `postgrest-js` algorithm** rather than stubbing it, because the defect lives in the library's argument handling |
| **DEFECT** | `src/__tests__/moderation/audit-shape.test.ts` | Same shape for F-072/F-073, with a table of measured HTTP status + PostgREST error codes in the header |
| **PRESERVE** | `src/app/auth/callback/route.test.ts` | Written against source **proven byte-identical to the plan's start** (a git-ancestry fact, not a claim), and every assertion proven to bite by **9 mutation cycles, 9 reds, 0 greens** |

**The header block is part of the pattern.** Every one of the three opens with: what the subject is,
what the defect is, what the file *is and is not*, why the mock is shaped the way it is, and the
`F-nnn` it is registered under. Reproduce that structure.

**The mutation check is part of the pattern too.** Phase 3 automated it for pgTAP
(`scripts/pgtap-mutation-check.sh`, DEC-20) and did it by hand for the callback (9 cycles). Plan for
at least a hand-run mutation cycle per new PRESERVE suite, with the evidence captured — an assertion
that has never been proven to go red is not a characterization.

### Pattern 3: The count query

```ts
// Source: src/app/profile/page.tsx:37-41 — this repo's own existing usage
const { count } = await supabase
  .from("saved_events")
  .select("id, events!inner(start_date)", { count: "exact", head: true })
  .eq("user_id", user.id)
  .lt("events.start_date", new Date().toISOString());
```

`head: true` switches the request to `HEAD`; the body is empty and the count arrives in
`Content-Range`. Measured: `Content-Range: 0-1/2` for a 2-row table.

### Pattern 4: Escaping user input before `.or()`

See § Q(f) for the two-layer function and the measurements behind it. The pattern rule:
**never interpolate a user string into a `.or()` argument.** `.or()` is an escape hatch; the
library's own docstring says the caller must sanitize.

### Anti-Patterns to Avoid

- **Widening a route handler's signature to silence a `TS2554` from a test file.** Phase 2 flagged
  this by name: *"a behaviour change disguised as a type fix."* Fix the test's handler reference.
- **Reviving the skipped suite against current behaviour.** T-01-11-04: *"recording broken behaviour
  as the contract would launder a defect into a specification."*
- **Regenerating `eslint.elevated-allowlist.mjs` to make a check pass.** The file's header forbids it
  and plan 03-08 refused that exact shortcut once already.
- **Adding `requireNotBanned` because the columns are sitting there.** Two rings that disagree about
  an expired suspension is a worse failure than one ring that fails open — DI-35 says so and F-062
  proves the existing ring is already inconsistent.
- **Reserializing `.planning/audit/findings.json`.** `JSON.stringify(…, null, 2)` produced a 912/231
  whole-file reformat for seven record changes in 03-08 and was reverted. Edit **surgically**.
- **Fixing the tag mapping and calling it "no visual change."** It is one. Log it.
- **Running `supabase db push` against production.** Forbidden until Phase 8 (DI-23), full stop.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Counting rows | `select(...).then(rows => rows.length)` | `select(col, { count: "exact", head: true })` | `max_rows = 1000` silently truncates the row form; the count form is a server-side `COUNT(*)` |
| Escaping a LIKE pattern | a bespoke regex per call site | one named exported function + its unit test | Two composed layers with non-obvious interaction (§ Q(f)); getting it wrong once is a 500 that leaks the query |
| Auth in a route handler | a fresh `createClient()` + `getUser()` + inline 401 | `createRequestContext()` + `requireUser()` | The seam exists, its error bytes are proven identical, and its guards fail closed by construction |
| Club → `Club` object | an inline object literal in each route | the PostgREST embed `club:clubs(...)` + one transform | The embed applies RLS and the FK; the literal fabricates a non-UUID id |
| Tag string → `EventTag` | a per-component `switch` | one exported map + a completeness test over `Object.values(EventTag)` | The mapping already exists in three places that disagree (`tagMapping`, `EVENT_CATEGORIES`, `classifier`) |
| Re-deriving `PROTECTED_ROUTES` in a test | a transcribed array | `e2e/fixtures.ts protectedRoutes()` | Already parses `src/proxy.ts` at load; `src/proxy.test.ts`'s transcription is the thing that can drift |
| Cursor encoding | ad-hoc query params | the base64 `{sortValue, id}` shape the skipped suite already defines | Multi-column keyset is required because `start_date` is not unique |

**Key insight:** every problem in this phase already has a solution somewhere in this repository that
someone wrote down and then didn't reuse. The phase's job is consolidation, not invention — which is
also why "no new dependency" is the right answer to every stack question.

---

## The finding-register gap — read this before planning Wave 0

Success criterion 1 requires characterization tests **"tagged PRESERVE or DEFECT (referencing their
`F-nnn`)."** `findings.json` holds **78 findings**. Only **four** touch any file in this phase's
scope, and only **two** are owned by Phase 4:

| Finding | Owner | Covers |
|---|---|---|
| `F-066` | 04 | the skipped suite + the tsconfig exclusion |
| `F-071` | 04 | the friends `.in()` builder defect |
| `F-050` | `null` | the 8 stale `event_date`/`event_time` references |
| `F-078` | 05 | `search_events_fuzzy` never executes |

**Nothing in the register covers:**

1. RSVP counts computed by loading all rows, capped at `max_rows` — *the subject of REFAC-09's second
   clause*
2. Club objects fabricated from the `organizer` string at two routes — *REFAC-10 clause 1*
3. Six of twelve `EventTag` members not round-tripping through `mapTags` — *REFAC-10 clause 3*
4. Raw interpolation of user input into a PostgREST `.or()` filter, producing a 400 that the handler
   converts to a 500 echoing the internal query — *REFAC-10 clause 4*
5. The client/server pagination contract divergence that makes "Load More" unreachable — *the
   question REFAC-10 inherited from 02-08*

**Wave 0 must register these (F-079…F-083 or the next free ids) before any DEFECT test can cite
one.** Procedure, from Phase 2 and Phase 3 precedent:

```bash
# 1. edit findings.json SURGICALLY — per-record insertion, never a whole-file reserialize (T-03-08-08)
# 2. regenerate the human-readable register
node .planning/audit/tools/gen-foundation-audit.mjs
# 3. the register's own gate must stay green
node .planning/audit/tools/validate.mjs --check findings
```

Each new record needs every schema field: `severity` + `severity_rationale` (exposure-adjusted, per
`SEVERITY_SLA.md`), `category`, `affected_paths` with line numbers, `evidence`, `reproduction` (the
commands in § Q(b), (c), (e), (f), (g) of this document are reproductions ready to paste),
`recommended_fix`, `validation_criterion`, `status`, `closes_in_phase: "04"`.

Also recommend: move `F-050`'s `closes_in_phase` from `null` to `"04"` in the same surgical edit.

---

## Common Pitfalls

### Pitfall 1: Proving the save workflow through the wrong path
**What goes wrong:** the API handler is refactored, `save-and-rsvp.spec.ts` stays green, and everyone
concludes the workflow is preserved.
**Why it happens:** that spec's profile assertion goes through `src/app/profile/page.tsx`, a Server
Component that queries `saved_events` **directly** and never calls `/api/users/saved-events`.
**How to avoid:** add an explicit assertion that exercises the API path (the event-detail page's
`GET /api/users/saved-events` at `EventDetailClient.tsx:117` is the one that does).
**Warning sign:** a diff that touches `/api/users/saved-events` with no failing test at any point.

### Pitfall 2: The RSVP button's optimistic arithmetic hides a wrong count
**What goes wrong:** the UI shows the right number after a click even if the server's count is wrong,
because `RsvpButton` increments locally (`:62-67`, `:91-104`).
**Why it happens:** the correct count is only ever observed on **mount** or after a reload.
**How to avoid:** any Playwright count assertion must follow `page.reload()`. The existing spec
already does this for the RSVP *state* and documents why (`save-and-rsvp.spec.ts:20-26`).

### Pitfall 3: The seed has no rows for the two things Slice 1 must prove
**What goes wrong:** the count refactor is untestable end to end because every event has 0 RSVPs, and
the club-fabrication fix is untestable because every seeded event has a `club_id`.
**Why it happens:** `SAVED_EVENTS` is deliberately empty (documented: its trigger would unpin
`users.updated_at` and break the determinism proof) and there are no seeded `rsvps` at all.
**How to avoid:** Wave 0 extends `scripts/seed/personas.ts` with (a) RSVP rows including a
`cancelled` one, and (b) **one approved event with `organizer` set and `club_id` null**. Both changes
**move the determinism hash** — `sha256 964ac785…` must be re-derived and the three places that cite
it updated, and the `saved_events`-trigger reasoning must be re-checked for `rsvps` (its trigger is
`update_rsvps_updated_at`, which stamps the *rsvp* row, not `users` — so RSVPs are safe where saves
were not, but **verify that rather than assume it**).
**Warning sign:** a seed change with no new `sha256` in the evidence.

### Pitfall 4: `supabase test db` behaves differently against a seeded database
**What goes wrong:** `040-seed-coverage.test.sql` emits 21 TAP **SKIP**s with a reason when the
database is unseeded and executes for real when it is. A local run against a seeded stack is not the
same run as the `types` CI job's.
**How to avoid:** state which of the two runs an evidence file captured. CI runs both: `types`
(unseeded, 5 files) and `e2e` (seeded).

### Pitfall 5: Regenerating types with the wrong CLI reds the drift gate
**What goes wrong:** `supabase gen types` output is not byte-stable across CLI versions
(postgres-meta v0.99.0 parenthesises four generic constraints v0.98.0 leaves bare). CI pins
**2.115.0**.
**How to avoid:** only regenerate with 2.115.0, and only from `--local`. This bit Phase 3 on its
closing commit — run `35055054211` went red on exactly this step.

### Pitfall 6: The two "now" functions disagree
**What goes wrong:** `/api/events` floors on `getESTNowISO()` (Eastern wall-clock expressed as naive
UTC); `/api/users/saved-events` floors on `new Date().toISOString()` (true UTC). For up to 5 hours a
day the same event is "upcoming" on one endpoint and "past" on the other.
**How to avoid:** **do not unify them in this phase** — that is a behaviour change with a
timezone-dependent blast radius and no finding behind it. Pin the current asymmetry with a PRESERVE
test and register it.
**Warning sign:** a "tidy-up" commit that swaps one for the other.

### Pitfall 7: A widened elevated census grows the shrink-only list
**What goes wrong:** widening `APP_DIR` to `src/` without carve-outs adds 5 entries to a file whose
header says it may only shrink — three of them false positives from `import type`.
**How to avoid:** the design in § Q(h). Prove the widened rule with a red/green fixture on an
**indirect** import before regenerating anything.

### Pitfall 8: Fixing the tag mapping silently changes the UI
**What goes wrong:** adding six identity mappings changes badge labels and colours on real events.
Criterion 4 forbids an *unintentional* visual change; this one would be intentional but unlogged.
**How to avoid:** the two-commit split in § Q(e), with the second commit naming the finding id and
the visual delta.

### Pitfall 9: `git add -A` in this repository
**What goes wrong:** the tree carries untracked files at all times (`.agents/`,
`docs/product-master-plan.md`, `skills-lock.json`, plus 47 pre-existing untracked files noted in
Phase 2). `.mcp.json` carries the production project ref in cleartext and was only gitignored in
`b9f9bcb`.
**How to avoid:** stage by explicit path. Phase 2 recorded this rule after hitting it.

---

## Code Examples

### Adopting the seam in a two-handler file

```ts
// Source: src/server/context.ts, src/server/authz/requireUser.ts, src/server/errors.ts
import { createRequestContext } from "@/server/context";
import { requireUser } from "@/server/authz/requireUser";
import { serverError } from "@/server/errors";
import { ok } from "@/server/http";

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id: eventId } = await params;
    const ctx = await createRequestContext();

    const auth = requireUser(ctx);
    if (!auth.ok) return auth.response;          // 401 { error: "Unauthorized" }

    const { error } = await ctx.supabase
      .from("saved_events").delete()
      .eq("user_id", auth.user.id).eq("event_id", eventId);

    if (error) {
      console.error("Error deleting saved event:", error);
      return serverError("unsave event");        // 500 { error: "Failed to unsave event" }
    }
    return ok({ saved: false });
  } catch (error) {
    console.error("Unexpected error unsaving event:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

Note the outer catch keeps its literal `"Internal server error"` body — `serverError()` emits
`"Failed to <action>"`, which is a **different string**. Preserve the bytes.

### The count query, replacing the load-all

```ts
// BEFORE — src/app/api/events/[id]/rsvp/route.ts:93-105  (capped at max_rows = 1000)
const { data: rsvps } = await supabase.from("rsvps")
  .select("id, status").eq("event_id", eventId).neq("status", "cancelled");
const goingCount = rsvps?.filter(r => r.status === "going").length ?? 0;

// AFTER
const [going, interested] = await Promise.all([
  supabase.from("rsvps").select("id", { count: "exact", head: true })
    .eq("event_id", eventId).eq("status", "going"),
  supabase.from("rsvps").select("id", { count: "exact", head: true })
    .eq("event_id", eventId).eq("status", "interested"),
]);
if (going.error || interested.error) {
  console.error("Error fetching RSVPs:", going.error ?? interested.error);
  return NextResponse.json({ error: "Failed to fetch RSVPs" }, { status: 500 });
}
const goingCount = going.count ?? 0;
const interestedCount = interested.count ?? 0;
```

### Escaping search input (derived from measurements in § Q(f))

```ts
// src/lib/searchFilter.ts
/** SQL LIKE layer: backslash is Postgres's DEFAULT escape character for LIKE,
 *  so no ESCAPE clause is needed — and PostgREST exposes none. */
export function escapeLikeLiteral(term: string): string {
  return term.replace(/[\\%_]/g, (c) => "\\" + c);
}

/** PostgREST quoted-value layer: wrapping in double quotes is what stops a
 *  comma or paren in the term from breaking out of the or=(...) group.
 *  MEASURED: an unquoted comma returns HTTP 400 PGRST100; quoted returns 200. */
export function postgrestQuotedValue(value: string): string {
  return '"' + value.replace(/[\\"]/g, (c) => "\\" + c) + '"';
}

export function ilikeContainsFilter(column: string, term: string): string {
  return `${column}.ilike.${postgrestQuotedValue("%" + escapeLikeLiteral(term) + "%")}`;
}

// call site, src/app/api/events/route.ts
eventsQuery = eventsQuery.or(
  [ilikeContainsFilter("title", search), ilikeContainsFilter("description", search)].join(",")
);
```

### A DEFECT characterization header (the house style)

```ts
/**
 * DEFECT characterization — F-0NN
 *
 * Subject: `src/app/api/events/[id]/rsvp/route.ts` GET, lines 93-105.
 *
 * The defect: counts are computed by SELECTing every non-cancelled row and
 * calling .filter().length in JavaScript. PostgREST caps a row-returning
 * select at `max_rows`, which supabase/config.toml sets to 1000, so an event
 * with more than 1000 RSVPs under-reports — silently, with no error and no log.
 *
 * What this file is and is not:
 *   - It is a DEFECT test. It pins what the handler does TODAY and is expected
 *     to keep passing until the fixing commit lands.
 *   - It is NOT a failing test and it is NOT a fix.
 *
 * Why the mock asserts on the QUERY rather than on a 1001-row fixture: the cap
 * lives in PostgREST, not in the client, so no in-process mock can reproduce
 * it. The observable, mockable property is that the handler issues a
 * row-returning select with no `count` option and counts in JS.
 *
 * Registered as F-0NN in .planning/audit/findings.json. Closes in Phase 4.
 */
```

---

## Runtime State Inventory

This is a refactor phase, so the inventory is mandatory. Each category was checked, and "nothing
found" is stated where it is true.

| Category | Items found | Action required |
|---|---|---|
| **Stored data** | `events.tags` holds the 12 raw enum strings (`["academic","tech"]`, `["music","social"]` measured on the seeded local DB). **No data migration is needed** — the read mapping is wrong, not the stored values. `events.rsvp_count` (integer, default 0) exists as a column and is written by **nothing** (`grep "rsvp_count" supabase/migrations/*.sql` → one hit, the column declaration) — it is a dead denormalized counter and must not be quietly adopted as the count source | Code edit only. Register the dead `rsvp_count` column as a finding candidate; do **not** drop it (schema change → Phase 8 gate) |
| **Live service config** | **None in this phase's scope.** No n8n, no Datadog, no Cloudflare. The three pg_cron jobs and three storage buckets that exist only in production are DI-33 and are untouched by these slices | None |
| **OS-registered state** | **None.** No Task Scheduler, pm2, launchd or systemd registration exists for this project | None |
| **Secrets / env vars** | **None changed.** `.env.local` is not modified (project rule). CI's workflow-level `NEXT_PUBLIC_SUPABASE_*` placeholders are load-bearing for the `ci` job and must stay; `e2e/env.ts` no longer consults them since `855da7f` (DI-32's fix) | None — but do not "tidy" the placeholder env block |
| **Build artifacts / installed packages** | `src/lib/supabase/types.ts` is a **generated** artifact behind the `types` CI job. Any migration this phase adds (none is recommended) forces a regeneration with CLI **2.115.0** from `--local`. `playwright/.auth/*.json` storage states are gitignored and regenerate per run | Regenerate types only if a migration lands; never hand-edit `types.ts` (that is what created the phantom `events_tests` table) |
| **Test-fixture state (extra category, and it bites here)** | The deterministic seed's hash is `sha256 964ac785…`, cited in three committed notes. Adding RSVP rows or an organizer-only event **changes it** | Re-derive the hash, update every citation, and re-run `supabase test db --local` because `040-seed-coverage.test.sql` asserts 21 coverage properties over the seed |

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | pinned `24.x` / `.nvmrc` `24` | — |
| npm | install | ✓ | `>=11` | — |
| Docker | local Supabase | ✓ | 11 `supabase_*_Event-Radar` containers running | — |
| Local Supabase stack | pgTAP, seed, Playwright, every measurement in this document | ✓ | API on `http://127.0.0.1:54321` (HTTP 200) | none — hard requirement |
| Supabase CLI | `test db`, `gen types` | ✓ | CI pins **2.115.0**; local version must match for type regeneration | — |
| Playwright + Chromium | the persona harness | ✓ | `@playwright/test` 1.63.0 pinned exact | `npx playwright install --with-deps chromium` |
| GitHub Actions | the three-job CI | ✓ | 3 jobs green on `8433e04` (run `35055404669`) | — |
| **Staging Supabase** | nothing in this phase | ✗ | — | DI-29; blocks nothing here |
| **Production DB write access** | **must NOT be used** | n/a | — | DI-23: `supabase db push` forbidden until Phase 8 |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none. The one missing environment (staging) is not needed by
either slice.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30.2.0 via `ts-jest` 29.4.6, **two projects** (`node`, `jsdom`) |
| Config file | `jest.config.js` (routing rule is by **directory**, not extension: `src/hooks/**` → jsdom) |
| Quick run command | `npx jest --ci --selectProjects node <path>` (≈2s for a single suite) |
| Full suite command | `npx jest --ci` (**measured 2.4s**, 35 suites) |
| DB tests | `supabase test db --local` (pgTAP, 5 test files) |
| E2E | `npx playwright test` (config runs `npm run build && npm run start`; **not** `next dev` — Turbopack HMR never finishes hydrating in Playwright's Chromium) |
| Structural gates | `node scripts/check-elevated-ratchet.mjs`, `node scripts/check-migration-filenames.mjs`, `node .planning/audit/tools/validate.mjs --quick` |

### The floor — re-measured in this working tree, 2026-09-16

Every number below was produced by running the command, not transcribed:

| Command | Measured now | Must not regress |
|---|---|---|
| `npx jest --ci` | **358 passed, 5 skipped, 363 total; 34 passed suites, 1 skipped, 35 total** | ✔ |
| `npm run lint` | **0 errors, 19 warnings** | 0 errors |
| `npx tsc --noEmit` | clean (exit 0) | clean |
| `npm audit --audit-level=high --omit=dev` | 0 high | 0 high |
| `node scripts/check-elevated-ratchet.mjs` | **`committed=24 live=24 delta=0`**, exit 0 | may shrink, never grow |
| `node scripts/check-migration-filenames.mjs` | **4 filenames parse**, exit 0 | ✔ |
| `node .planning/audit/tools/validate.mjs --quick` | **118 passed, 2 failed, 1 skipped** — both failures are AUDIT-01's staging/local snapshot rules, **failing by design** | 118 passed, the same 2 |
| `supabase test db --local` | 86 assertions (cited, 03-VERIFICATION §136) | 86 |
| `npx playwright test` | 27 passed (cited, 03-VERIFICATION §136) | 27 |
| **The phase-relevant subset** `npx jest --ci src/__tests__/api/events src/hooks/useEvents.test.ts` | **7 suites, 101 passed, 1 skipped** | grows |

CI reference run: **`35055404669` on `8433e04`** — `ci`, `types`, `e2e` all `success`.

### Phase Requirements → Test Map

| Req | Behaviour | Test type | Automated command | Exists? |
|---|---|---|---|---|
| REFAC-09 | save toggle: unsaved→saved→unsaved, 401 anon, 404 missing event, ban blocks POST only | unit (node) | `npx jest --ci --selectProjects node src/__tests__/api/events/save-characterization` | ❌ **Wave 0** |
| REFAC-09 | saved-events list: 401 anon, three sort orders, past-event exclusion | unit (node) | `… saved-events-characterization` | ❌ **Wave 0** |
| REFAC-09 | RSVP GET returns `{counts:{going,interested,total}, user_rsvp}`; `total === going + interested`; anon gets counts + `null` | unit (node) | `npx jest --ci --selectProjects node src/__tests__/api/events/rsvp` | ⚠️ **partial** — 16 error-path tests exist, **no happy path, no count assertion** |
| REFAC-09 | **DEFECT**: counts come from a row-returning select with no `count` option | unit (node) | `… rsvp-count-defect` | ❌ **Wave 0**, needs a new `F-nnn` |
| REFAC-09 | seam adoption does not change any response byte | unit (node) | the PRESERVE suites above, run before and after | ❌ **Wave 0** |
| REFAC-09 | `F-071` fix: `.in()` receives an array; assertions **move**, `grep -rn "(supabase as any)" src/app/` → 0 | unit (node) | `npx jest --ci --selectProjects node --testPathPatterns friends-defect` | ✅ exists (DEFECT) |
| REFAC-10 | `/api/events/[id]` and `/api/users/saved-events` return a real club | unit (node) + e2e | `… events-detail-characterization` + a new Playwright assertion on the event page | ❌ **Wave 0**, needs an organizer-only seed row |
| REFAC-10 | **DEFECT**: `transformEventFromDB` fabricates `club.id` from `organizer` | unit (node) | `… club-fabrication-defect` | ❌ **Wave 0**, new `F-nnn` |
| REFAC-10 | no `event_date`/`event_time` outside archived DDL; the 3 analytics suites still pass | unit + grep | `command grep -rn "event_date\|event_time" src/ supabase/ \| grep -v _archive_pre_baseline` → 0, then `npx jest --ci src/__tests__/api` | ❌ **Wave 0** (currently **8 hits / 4 files**) |
| REFAC-10 | every `EventTag` member round-trips through the mapping | unit (node) | `… eventTags.test.ts` iterating `Object.values(EventTag)` | ❌ **Wave 0** |
| REFAC-10 | **DEFECT**: 6 of 12 members do not round-trip; unknown tags become `social` | unit (node) | `… tag-coercion-defect` | ❌ **Wave 0**, new `F-nnn` |
| REFAC-10 | `%`, `_`, `,`, `(`, `)`, `"`, `\` in a search term are escaped | unit (node) | `… searchFilter.test.ts` — one assertion per character | ❌ **Wave 0** |
| REFAC-10 | **DEFECT**: a comma in the search box returns 500 with the internal filter | unit (node) + e2e | `… search-escaping-defect` + an anonymous-browse spec that types `a,b` | ❌ **Wave 0**, new `F-nnn` |
| REFAC-10 | the decided pagination contract | unit (node) | `npx jest --ci --selectProjects node src/app/api/events/route.test.ts` (**currently `describe.skip`**) | ⚠️ **skipped** — rewrite, do not delete |
| REFAC-10 | the hook and the route agree | unit (jsdom) | `npx jest --ci --selectProjects jsdom src/hooks/useEvents.test.ts` | ⚠️ 20 tests exist but assert against a **mocked fetch** — 02-08 § 3 warns they **cannot** catch the divergence |
| F-066 / DI-24 | zero skipped suites **and** test files type-checked | gate | `npx jest --ci` → 0 skipped suites; `npx tsc --noEmit` clean **after** the `exclude` entries are removed | ❌ **77 errors / 8 files today** |
| Both | every Validated workflow still behaves identically | e2e | `npx playwright test` → 27 (+ new) passed | ✅ exists |
| Both | schema unchanged, RLS unchanged | pgTAP | `supabase test db --local` → 86 | ✅ exists |
| Both | types match the migrations | gate | the `types` CI job (`diff -u src/lib/supabase/types.ts /tmp/types.gen.ts`) | ✅ exists |
| DI-31 | the ratchet is **enforced**, not merely correct | gate | a new step in `.github/workflows/ci.yml` running `node scripts/check-elevated-ratchet.mjs` | ❌ **not wired** |

### Sampling rate

- **Per task commit:** `npx jest --ci --selectProjects node <the suite this task touched>` (~2s)
- **Per slice commit:** `npx jest --ci` + `npm run lint` + `npx tsc --noEmit` +
  `node scripts/check-elevated-ratchet.mjs`
- **Per slice merge (the "after" evidence):** the full floor table above, **plus**
  `npx playwright test` and `supabase test db --local`
- **Phase gate:** the full floor green **and** a green CI run id recorded for all three jobs, before
  `/gsd-verify-work`

### Before-and-after evidence each slice must capture

The program's discipline is that a claim without a captured command is not evidence. Per slice:

1. **`before.txt`** — the floor table, run on the slice's **base commit**, with the commit sha.
2. **The characterization suites, green on unmodified source**, with `git log -1 -- <handler>` proving
   the handler predates the suite (the `03-02` precedent: *"which is what 'before' asks for and is a
   git-ancestry fact rather than a claim"*).
3. **A mutation cycle per PRESERVE suite** — mutate, watch it go red naming the expected test,
   restore, watch it go green. Capture the cycle.
4. **`after.txt`** — the same floor table on the slice's final commit, with every number ≥ before.
5. **`playwright-<slice>.txt`** — the harness run, before and after, from a clean `supabase db reset`
   + seed load.
6. **A DEFECT ledger** — for each DEFECT suite whose assertions moved, the old assertion, the new
   one, and the `F-nnn` it closes.
7. **If the seed changed:** the new `sha256`, re-derived twice, plus the `supabase test db --local`
   run that re-executes the 21 seed-coverage assertions.

---

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1` in `.planning/config.json`.

### Applicable ASVS categories

| ASVS Category | Applies | Standard control in this tree |
|---|---|---|
| V2 Authentication | yes | `supabase.auth.getUser()` (revalidating) via `createRequestContext()`; **never** `getSession()`. Every handler in scope already uses `getUser()` — verified |
| V3 Session Management | partly | `@supabase/ssr` cookie handling in `src/proxy.ts`. **Untouched by this phase**; the `ssr` major is deferred |
| V4 Access Control | yes | `requireUser` for the four authenticated handlers; RLS as the independent second ring. **`/api/events/:id/rsvp` GET must stay anonymous-readable** — that is current behaviour and F-011 already records the underlying policy |
| V5 Input Validation | **yes — this is the phase's security core** | `%`/`_`/`,`/`(`/`)`/`"`/`\` escaping before `.or()`; `timeOfDay`/`dayType` allow-lists already exist (`route.ts:175-191`) and must be preserved. `zod` contracts are **REFAC-15, Phase 6** — do not pull them forward |
| V6 Cryptography | no | Nothing in scope encrypts, signs or hashes |
| V7 Error Handling & Logging | yes | The PGRST100 → 500 path returns the internal PostgREST filter to the caller. F-059 already records 22 route files returning internal error text across 40 sites; this is one of them and the escaping fix removes the trigger |

### Known threat patterns for this stack

| Pattern | STRIDE | Standard mitigation | State here |
|---|---|---|---|
| PostgREST filter injection via `.or()` string interpolation | Tampering / Information disclosure | quote the value; escape `"` and `\` | **Live today.** Measured: 400 → 500 leaking the filter |
| LIKE-wildcard injection (`%`, `_`) | Tampering | escape with `\` (Postgres default LIKE escape char) | **Live today.** Not a security boundary crossing, but an unbounded-scan vector: `%` matches everything on an unindexed ILIKE |
| Service-role credential reaching a request path | Elevation of privilege | `src/server/db/elevated/` + ESLint boundary + shrink-only ratchet | **Not reachable from any Phase 4 handler** (verified: none of the 13 is in the allow-list). The **indirect** reach via `src/lib/audit.ts` is DI-34 and is admin-only |
| Personalized response served from a shared CDN cache | Information disclosure | `private, no-store` on personalized routes | **Live and Critical** (F-025/F-026). `/api/events` even sets its own `public, s-maxage=30` (`route.ts:335-337`). **Phase 6 (REFAC-19)** — do not touch it here, but do not let the slice *add* a cache header either |
| Banned user reaching a mutation | Elevation of privilege | fail-closed ban ring | `checkBanStatus()` guards `save` POST and `rsvp` POST only; the proxy ring fails open (`proxy.ts:140-143`). **Phase 5 (REFAC-11)**; pin the asymmetry here |
| Cross-user read of saved events / RSVPs | Information disclosure | user id from `getUser()`, never from the body; RLS as the second ring | Correct today. The RSVP POST/DELETE body-vs-session 403 comparison must survive the refactor **verbatim** |

**Security deliverable for this phase:** the escaping function and its per-character unit test.
Everything else in the table is explicitly owned by Phase 5 or Phase 6 and must be left alone.

---

## Explicitly NOT in this phase

Naming these is as important as naming the scope, because every one of them is adjacent enough to be
tempting while touching the same files.

**Phase 5 (Slices 3–5: auth, club authorization, admin containment) — REFAC-11/12/13/17/18**
- `getUser()`-everywhere, the advisory-only proxy, **the fail-closed ban check** (DI-35's guard)
- The onboarding guard; env-var non-null assertions → validated config
- The 19 hand-rolled club-membership checks → `requireClubRole`
- Every fail-open endpoint; `verifyAdmin()` coverage; service-role containment and the ratchet
  **shrink**
- Distributed rate limiting; CSRF assessment
- **`F-078`** (`search_events_fuzzy` volatility) — Phase 4 escapes the input, Phase 5 makes the RPC
  run
- **`F-072` / `F-073`** (`admin_audit_log.admin_email`) and the second surviving cast
- **`F-074`–`F-077`** (anon-executable `SECURITY DEFINER`, mutable `search_path`, the unvalidated
  `next` redirect)

**Phase 6 (Slices 6–7: async edge, contracts, caching, observability) — REFAC-14/15/16/19/20/21/22**
- **`zod` contracts in `src/contracts/`** — do not create that directory here
- **The blanket `s-maxage=60` in `vercel.json`** and `/api/events`' own `s-maxage=30`
  (F-025/F-026/F-027/F-028, DI-26)
- Structured logging replacing `console.*`; Sentry; `/api/health`
- Cron/webhook credentials; the recommendation-surface characterization

**Phase 7 (certification datasets, persona coverage) — CERT-01…10, 19**
- The adversarial and scale datasets; the 13-persona × workflow matrix; the generated persona ×
  endpoint authorization matrix; per-table RLS allow/deny coverage

**Phase 8 (operational certification) — CERT-11…18, 20**
- **The production migration-history repair (DI-23).** `supabase db push` against production is
  forbidden for the whole of Stage 3
- k6 load; rollback and restore drills; alerting and chaos; the certification report
- **`F-045`** (45 applied versions vs 44 files)

**Deferred indefinitely / no owner in Stage 3**
- `DI-29` — no staging Supabase project exists (blocks nothing here)
- `DI-21` — the CSP has no local-development entry; the Playwright harness runs with `bypassCSP`
- `DI-22` — the `/moderation?status=pending` deep link is ignored
- `DI-27` — the five signed-in Tier 3 manual acceptance steps
- `DI-33` — three storage buckets and three pg_cron jobs governed by no migration
- React 19 / Next.js beyond 16 / declarative schema (UPG-01..03); visual-regression and axe smoke
  (QUAL-01..03)

---

## Assumptions Log

| # | Claim | Section | Confidence | Risk if wrong |
|---|---|---|---|---|
| **A1** | Production's PostgREST `max_rows` equals the local `1000`. Only `supabase/config.toml` was read; the production API setting was not captured in Phase 1 | Q(b) | `[ASSUMED]` | If production is uncapped, the count defect is latent rather than live — the fix is still correct and still an improvement, but the DEFECT finding's severity rationale would be wrong. **Closeable with one credentialed read of the project's API settings** |
| **A2** | The `"` and `\` rows of the escaping table follow the two-layer model. The `%`, `_`, `,` and wildcard rows were **measured**; the quote and backslash rows could not be discriminated because no seeded row contains either character | Q(f) | `[ASSUMED]` | An unescaped `"` silently misparses (200 `[]`) rather than erroring — a wrong result, not a crash. **Closeable by seeding one event whose title contains `"` and `\` and asserting both directions** |
| **A3** | Adding `rsvps` rows to the seed will not unpin a timestamp the determinism proof depends on. `update_rsvps_updated_at` stamps the **rsvp** row, unlike `update_saved_events_count` which writes `public.users` and triggers its `BEFORE UPDATE` stamp | Pitfall 3 | `[ASSUMED]` | A non-deterministic seed breaks the `sha256 964ac785…` proof and REFAC-07. **Closeable by loading twice and diffing the dump — the exact procedure 03-07 used** |
| **A4** | Adding the club embed to `/api/events/[id]` and `/api/users/saved-events` costs no meaningful latency, because `events.club_id` was indexed by 03-05 and six sibling routes already do it | Q(c) | `[ASSUMED]` | A slow detail page. **Closeable with an `EXPLAIN` or a timed local request** |
| **A5** | The six `TS2345` sites that block the `supabase-js` minor are outside this phase's slices. Phase 2's note says "six data-mutation API routes" and 03-06 fixed one, but the remaining five are not enumerated anywhere | Q(j) | `[ASSUMED]` | If one of the five is a Phase 4 handler, DI-25 genuinely does belong here. **Closeable by applying the bump on a throwaway branch and reading `tsc`'s output — ~10 minutes** |
| **A6** | Rewriting the skipped suite to the cursor contract, rather than deleting it, is what the phase owner wants. The evidence (the skill, the live client, 02-08's hand-off) points that way, but this is a **product** decision about pagination, not a technical one | Q(g) | `[ASSUMED]` | Implementing a cursor contract the owner did not want is a large wasted slice. **This is the single item most worth a `/gsd-discuss-phase` answer before planning** |
| **A7** | The tag mapping's visual change is acceptable in Phase 4 if logged | Q(e) | `[ASSUMED]` | Criterion 4 could be read as forbidding it outright. **The two-commit split makes either answer cheap** — only commit *N+1* would be deferred |
| **A8** | `supabase test db --local` still reports 86 and `npx playwright test` still reports 27. Both were **cited from `03-VERIFICATION.md` §136, not re-run** in this research session (the local DB is currently seeded, which changes which of the two `supabase test db` runs it is — see Pitfall 4) | Validation Architecture | `[ASSUMED]` | A floor number that is wrong makes "no regression" unprovable. **Closeable by running both once at the start of Wave 0** |

---

## Open Questions

1. **Which pagination contract is authoritative?**
   - *What we know:* the client speaks cursor, the route speaks OFFSET, the skipped suite describes
     cursor, the project skill recommends cursor, and "Load More" is unreachable today for real users.
   - *What's unclear:* whether the product wants keyset pagination at all, or whether the simpler
     answer is to make the hook speak `page`/`limit` and delete the cursor code.
   - *Recommendation:* **take this to the phase owner before planning.** It sizes the whole of Slice 2.
     If undecided, the plan's own rule should make the deferral explicit rather than silent — the
     03-08 precedent.

2. **Does the tag-mapping visual change ship in Phase 4?**
   - *What we know:* 6 of 12 enum members mis-render today, measurably, on the seeded data. Fixing it
     changes badges and colours.
   - *What's unclear:* whether criterion 4's "no intentional visual change" is absolute or means "no
     *unlogged*" change (the roadmap's cross-cutting discipline says the latter).
   - *Recommendation:* the two-commit split in § Q(e). Plan both; defer only the second if the owner
     says so, in writing, with an owner.

3. **Is DI-25's minor in scope?**
   - *Recommendation:* enumerate the six sites on a throwaway branch first (≈10 min), then decide.
     Record the decision either way so it does not cross a third phase undecided.

4. **Should `/api/calendar/events` be in Slice 1?**
   - *What we know:* it reads both `saved_events` and `rsvps` for the user and has no test.
   - *Recommendation:* include it in the characterization suite (it is the same data), adopt the seam,
     change nothing else. Excluding it leaves an untested consumer of the tables Slice 1 refactors.

5. **What is `events.rsvp_count` for?**
   - *What we know:* the column exists (`integer DEFAULT 0`), `transformEventFromDB` passes it through
     to `Event.rsvp_count`, and **no migration, trigger or route writes it**.
   - *Recommendation:* register it as a finding candidate in Wave 0. Do **not** adopt it as the count
     source and do **not** drop it — a schema change would need the Phase 8 production gate.

6. **How many `F-nnn` ids does Wave 0 need to mint?**
   - *Recommendation:* five, plus one `closes_in_phase` correction on `F-050`. The plan should fix the
     exact count and the id range before any DEFECT test is written, because the id goes in the test's
     header.

---

## Sources

### Primary (HIGH confidence) — this repository and the running local stack
- `node_modules/@supabase/postgrest-js/dist/cjs/PostgrestFilterBuilder.js` — `.or()` (356-360),
  `.ilike()` (105-108), `.in()` + `PostgrestReservedCharsRegexp` (5, 151-163)
- `node_modules/@supabase/postgrest-js/dist/cjs/PostgrestQueryBuilder.js:18-53` — `count` / `head`
- Local Supabase stack, `http://127.0.0.1:54321` — 14 `curl` probes: `search_events_fuzzy` → `0A000`;
  `Prefer: count=exact` → `Content-Range`; the full escaping matrix
- `src/` (13 handlers, 4 components, 2 pages, 1 hook, `tagMapping.ts`, `proxy.ts`, `ban.ts`,
  `timezone.ts`, the 7 seam files), `scripts/`, `e2e/`, `supabase/migrations/20260915214553_baseline.sql`
- Measured command output: `npx jest --ci`; `npm run lint`; the tsconfig probe (77/8);
  `check-elevated-ratchet.mjs`; `check-migration-filenames.mjs`; `validate.mjs --quick`; a throwaway
  `mapTags` probe (created and deleted, `git status` clean)
- `npm view @supabase/supabase-js version` → 2.116.0; `@supabase/ssr` → 0.12.7

### Primary (HIGH confidence) — committed program artifacts
- `.planning/audit/findings.json` (78 records) and `FOUNDATION_AUDIT.md`
- `.planning/audit/schema/events-date-columns.md` — AUDIT-19's verdict
- `.planning/phases/03-…/evidence/deferred-items.md` — DI-19…DI-35, the authoritative register
- `.planning/phases/03-…/03-VERIFICATION.md` §§ 103-106, 136, 138 — the floor and the CI run ids
- `.planning/phases/02-…/evidence/skipped-suite-disposition.md` — the pagination hand-off, §§ 2-5
- `ROADMAP.md`, `REQUIREMENTS.md`, `PROJECT.md`, `STATE.md`, `.planning/config.json`
- `./CLAUDE.md`, `./.claude/CLAUDE.md`, `.agents/skills/*/SKILL.md` and
  `references/data-pagination.md`, `references/data-n-plus-one.md`

### Secondary (MEDIUM confidence)
- `https://docs.postgrest.org/en/v13/references/api/tables_views.html` — reserved characters must be
  double-quoted inside `or=(…)`; `*` is an alias for `%` in `like`/`ilike`; **no LIKE `ESCAPE` clause
  is documented**. Thin on escaping *inside* a quoted value, which is why § Q(f) is measured rather
  than cited
- `supabase:supabase` skill — the security checklist (`SECURITY DEFINER` in `public` is anon-callable;
  RLS/`TO` clause guidance), applied to the "count query vs DB function" choice

### Tertiary (LOW confidence)
- None relied upon. Every claim in this document is either measured in this session or cited to a
  committed artifact.

---

## Metadata

**Confidence breakdown:**
- *Code inventory (both slices)* — **HIGH**: every path re-derived by `grep`/`command grep` in this
  working tree; no path transcribed from a planning document
- *Measured defects (RSVP count cap, tag coercion, `or()` injection, pagination, stale date refs,
  tsconfig cost)* — **HIGH**: each has a runnable reproduction that was run, with its output quoted
- *PostgREST escaping recipe* — **MEDIUM**: four of six characters measured against the live stack;
  the `"` and `\` rows follow the model but lack a discriminating observation (A2)
- *Seam-adoption mechanics* — **HIGH**: the seam's own unit tests pass and `errors.ts` states the
  byte-identity contract explicitly
- *DI dispositions* — **HIGH** for DI-24/30/31/34 (all re-measured); **MEDIUM** for DI-25 (the six
  blocking sites are not enumerated anywhere, A5) and DI-35 (a design decision, not a measurement)
- *Floor numbers* — **HIGH** for the seven re-run commands; **MEDIUM** for pgTAP 86 and Playwright 27
  (cited, not re-run — A8)

**Research date:** 2026-09-16
**Valid until:** 2026-10-16 for the program artifacts; **7 days** for the measured floor and the
`77 errors / 8 files` figure, both of which move with any commit to this tree
