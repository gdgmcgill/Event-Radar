# Seven defects on the Phase 4 slices that had no register entry

**Plan:** 04-01 · **Phase:** 04-slices-1-2-saved-events-rsvp-and-the-event-read-path · **Recorded:** 2026-09-23

This is the audit-side evidence for **F-079** through **F-085**. It lives under
`.planning/audit/` because the finding register's schema requires every `evidence` value to
resolve there. The plan-side narrative is
`.planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/04-RESEARCH.md`
§ Q(b)–Q(g), Pitfall 6 and the Runtime State Inventory. The research measured these on
2026-09-16. **Every reproduction below was re-run on 2026-09-23 against base commit
`794556af090ad39f55bb792143b1d2c880615ace`,** or re-read where it is a code fact. Every
file:line pointer was re-read on that commit, not transcribed.

Why these needed ids: ROADMAP success criterion 1 requires characterization tests "tagged
PRESERVE or DEFECT (referencing their F-nnn)". Before this document, only F-066 and F-071 of
the defects this phase touches had one.

Method notes, stated once:

- The PostgREST probes were sent to the **local** stack (`http://127.0.0.1:54321`) with its
  anon key read from `supabase status -o env` into a shell variable. The key was never
  printed and appears in no file. Production was not read.
- The tag probe was an inline `npx tsx -e` expression importing `src/lib/tagMapping.ts`. It
  created no file, and `git status --short` afterwards showed only the three standing
  untracked paths.

---

## F-079 — rsvp counts load every row

**Subject:** `src/app/api/events/[id]/rsvp/route.ts` GET, lines 92-105.

```ts
// lines 93-97
const { data: rsvps, error: rsvpError } = await supabase
  .from("rsvps").select("id, status")
  .eq("event_id", eventId).neq("status", "cancelled");
// lines 104-105
const goingCount = rsvps?.filter((r) => r.status === "going").length ?? 0;
const interestedCount = rsvps?.filter((r) => r.status === "interested").length ?? 0;
```

- `supabase/config.toml:18` sets `max_rows = 1000`. PostgREST caps a row-returning select at
  that value, so an event with more than 1000 non-cancelled RSVPs under-reports. No error is
  raised and nothing is logged.
- No in-process mock can reproduce the cap because it lives in PostgREST. The mockable
  property is that the handler issues a row-returning select with **no** `count` option and
  counts in JavaScript.
- **Production's `max_rows` is unverified** (04-RESEARCH.md assumption A1). Only the local
  `config.toml` was read. Phase 4 does not read production.
- In-repo prior art for the fix: `src/app/profile/page.tsx:38-42` counts `saved_events` with
  `{ count: "exact", head: true }`. `head: true` switches the request to HEAD, and the count
  arrives in `Content-Range` as a server-side `COUNT(*)` that `max_rows` does not cap.
- Seeded data: `scripts/seed/personas.ts:566-579` seeds one `going` and one `cancelled` RSVP,
  so a count assertion has a real row on each side of the `neq("status","cancelled")`
  predicate.

## F-080 — event responses fabricate a club

**Subject:** `src/lib/tagMapping.ts:102-144`, `transformEventFromDB`.

```ts
if (dbEvent.club) {                 // 105-123: 10 real columns copied, and
  club = { …, banner_url: null, website_url: null, discord_url: null,
           twitter_url: null, linkedin_url: null, contact_email: null, … };
} else if (dbEvent.organizer) {     // 124-143: FABRICATED
  club = { id: dbEvent.organizer, name: dbEvent.organizer, /* all else null */
           status: "approved", … };
}
```

- **Two routes reach the fabricating branch** because they select `*` with no club embed:
  - `src/app/api/events/[id]/route.ts:79-86`. The comment on line 79 reads "Fetch event
    without club relation since Clubs table does not exist", which is false: `clubs` exists
    and six sibling routes embed it.
  - `src/app/api/users/saved-events/route.ts:92-97`.
- **The fabricated `club.id` is the organizer string.** It is not a UUID and not a `clubs.id`.
  Its `status` is hard-coded `"approved"` whatever the real club's status is.
- **The quieter fabrication on the real branch:** five real URL columns (`banner_url`,
  `website_url`, `discord_url`, `twitter_url`, `linkedin_url`) are hard-coded `null` because
  the embed's column list omits them. A caller cannot tell "the club has no website" from "the
  API didn't ask". `contact_email` is nulled the same way.
- **Why it is live on real data.** `src/app/api/events/create/route.ts:88` sets
  `organizer = profile?.name || profile?.email || user.email || "Unknown"`, and line 176
  stores it. So every event created through the app carries the creator's display name as
  `organizer`. Its detail page, rendered from `/api/events/[id]` by
  `src/components/events/EventDetailView.tsx:219-260`, therefore reads **"Hosted by <creator
  name>"**. The same row's list card (from `/api/events`, which embeds the club) shows the real
  club. Two surfaces disagree about one row.
- The detail view's "View Profile" link at `EventDetailView.tsx:257-258` uses
  `event.club_id`, not `club.id`. On an event with a real `club_id` the link is correct while
  the name beside it is the organizer string. On an organizer-only event (`club_id` null) it
  links to `/clubs/null`.
- **Seeded data shows it.** `scripts/seed/load.ts:325-349` gives every seeded event both a
  `club_id` and a PRNG-picked organizer label (`Seed Organizer A|B|C`). Every seeded event's
  detail page renders "Hosted by Seed Organizer X" today, not the club's name.
- No new exposure: F-022 records that the clubs read policy ignores `status`, and six routes
  already embed the club. Adding the embed to two more discloses nothing new.

## F-081 — six of twelve tags do not round-trip

**Subject:** `src/lib/tagMapping.ts:10-50`, `tagMapping` and `mapTags`. Line 45:
`return tagMapping[lowerTag] || EventTag.SOCIAL; // Default to SOCIAL if no mapping`.

Probe re-run 2026-09-23, each `EventTag` member passed through `mapTags([member])`:

```
academic    -> academic
social      -> social
sports      -> sports
career      -> career
cultural    -> cultural
wellness    -> wellness
music       -> cultural   <- remapped (lossy)
tech        -> social     <- coerced (absent from tagMapping)
food        -> social     <- coerced (absent from tagMapping)
volunteer   -> social     <- coerced (absent from tagMapping)
arts        -> social     <- coerced (absent from tagMapping)
networking  -> social     <- remapped (lossy)
quidditch   -> social
seeded [academic,tech] -> ["academic","social"]
seeded [music,social]  -> ["cultural","social"]
non-identity members: 6 of 12
```

Three independent facts make this live:

1. `src/lib/constants.ts:7-20` lists all 12 members in `EVENT_TAGS` (the filter chips).
   `EVENT_CATEGORIES` (from line 22) gives each a full theme.
2. `src/lib/classifier.ts:553-584` assigns all 12 when ingesting Instagram posts. The write
   path and the read path disagree by construction.
3. The seed carries `["academic","tech"]` and `["music","social"]`. The research's `curl`
   confirmed the stored values (2026-09-16). They render as academic+social and
   cultural+social.

**A third mapping disagrees with both.** `TAG_HIERARCHY` at `src/lib/constants.ts:342-351`
maps granular tags to parents differently from the read path:

| Granular tag | `TAG_HIERARCHY` (constants.ts) | `tagMapping` (read path) |
|---|---|---|
| `hackathon` | tech | academic |
| `workshop` | tech | academic |
| `fitness` | sports | wellness |
| `competition` | career | sports |

(The plan named the first three; `competition` was found on re-reading.)

The round trip is inconsistent in both directions. `/api/events?tags=tech` filters the raw
column with `.overlaps('tags', ['tech'])` (`src/app/api/events/route.ts:210-211`) and matches
the seeded event, but the returned card displays a Social badge. Filtering by `social` does
not return it.

## F-082 — search input is interpolated raw into a postgrest filter

**Subject:** `src/app/api/events/route.ts:214-243` (the fuzzy RPC and its ILIKE fallback) and
`:280-307` (the error path).

```ts
// lines 225-227 — the only path search ever takes today, because the RPC always errors (F-078)
eventsQuery = eventsQuery.or(
  `title.ilike.%${search}%,description.ilike.%${search}%`
);
```

`.or()` does no escaping. postgrest-js 2.81.1 `PostgrestFilterBuilder.js` appends
`` `(${filters})` `` verbatim; only `.in()` escapes, and only `,()`.

**Measured against local PostgREST on 2026-09-23** (`GET /rest/v1/events?select=title&status=eq.approved&or=…`):

| `or=` value sent | HTTP | Body |
|---|---|---|
| `(title.ilike.%Music%,description.ilike.%Music%)` | 200 | `[{"title":"Seed Approved Music Night"}]`: plain-text search works |
| `(title.ilike.%a,b%,description.ilike.%a,b%)` (search `a,b`, as the handler builds it) | **400** | `{"code":"PGRST100","details":"unexpected \"%\" expecting letter, digit, \"-\", \"->>\", \"->\" or delimiter (.)","hint":null,"message":"\"failed to parse logic tree ((title.ilike.%a,b%,description.ilike.%a,b%))\" (line 1, column 2…` |
| `(title.ilike.%%%,description.ilike.%%%)` (search `%`) | 200 | both seeded approved events: `%` is a live wildcard |
| `(title.ilike.%_%,description.ilike.%_%)` (search `_`) | 200 | both seeded approved events: `_` is a live wildcard |
| `(title.ilike."%\\_%",…)` (two-layer escaped `_`) | 200 | `[]`: literal underscore, correct |
| `(title.ilike."%\\%%",…)` (two-layer escaped `%`) | 200 | `[]`: literal percent, correct |
| `(title.ilike."%a,b%",…)` (quoted comma) | 200 | `[]`: the quote stops the comma breaking the group |
| `(title.ilike."%*%",…)` (quoted asterisk) | 200 | both seeded approved events: PostgREST rewrites `*` to `%` even inside quotes |
| `POST /rest/v1/rpc/search_events_fuzzy {"search_term":"jazz"}` | — | `{"code":"0A000",…,"message":"SET is not allowed in a non-volatile function"}`: F-078, which is why the ILIKE path is the only path |

**The 400 becomes a 500 that carries the internal filter.** `route.ts:286-289` treats only
`PGRST103`, `PGRST116` and a message starting with `{` as benign. The PGRST100 message
starts with `"`, so `route.ts:303-306` returns HTTP 500 with `{ error: <the message> }`, and
the message text contains the whole internal logic tree. An anonymous visitor who types a
comma into the search box gets a 500 that discloses query structure: one more instance of
the F-059 class.

**What bounds it.** The injected `or=` group is ANDed with the handler's own
`.eq('status','approved').is('deleted_at', null)` (`route.ts:197-198`) and with the events
RLS policy. A crafted term can therefore widen or break the OR group but cannot reach a row
outside approved, undeleted events. No credential is in the echoed text.

**The asterisk is out of reach of any escape.** PostgREST maps `*` to `%` in like/ilike values
after unquoting and ignores backslashes there. The quoted `"%*%"` row above matched both seeded
events on local PostgREST v16.1. No ilike pattern can match a literal `*`.

## F-083 — the list pages by offset while the client pages by cursor

**Subject:** the contract between `src/hooks/useEvents.ts:53-138` and
`src/app/api/events/route.ts:158-339`.

| | `src/hooks/useEvents.ts` | `src/app/api/events/route.ts` |
|---|---|---|
| Sends / reads | sends `cursor` (68-69), `sort`, `direction` (65-66), `clubId` (88-89); reads `data.nextCursor`, `data.prevCursor` (134-135) | reads `tags, search, dateFrom, dateTo, ids, timeOfDay, dayType, page, limit` (164-172), and nothing else |
| Pagination | keyset, `{sortValue, id}` base64 | `.range(from, to)` at 275: OFFSET |
| Ordering | `sort`/`direction` sent | hard-coded `.order('start_date', { ascending: true })` at 196 |
| Returns | expects `nextCursor`/`prevCursor` | `{ events, total, page, limit, totalPages }` (326-333) |

Re-measured 2026-09-23: `command grep -c -i cursor src/app/api/events/route.test.ts` → **27**;
`command grep -c -i cursor src/app/api/events/route.ts` → **0**.

**The live symptom.** `src/app/page.tsx:510-518` renders "Load More" only inside
`{nextCursor && …}`. `nextCursor` is `data.nextCursor ?? null`, the route never emits it, so the
button **never renders**. A user who searches or filters sees at most `limit: 30` results and
cannot reach a second page. `loadMore`, `goToNext`, `goToPrev` and `loadAll` in the hook are
dead for the same reason.

**The contract's only written statement is skipped.** `src/app/api/events/route.test.ts:19`
is `describe.skip("GET /api/events cursor pagination — tests written for cursor-based route that
no longer exists", …)`. It is F-066's first clause (zero skipped suites) and the reason
`npx jest --ci` reports 1 skipped suite / 5 skipped tests
(`evidence/floor.before.txt` block 1). The 20 executing `useEvents.test.ts` tests assert cursor
semantics against a mocked `fetch`, so they cannot see this divergence (Phase 2
`skipped-suite-disposition.md` § 3).

## F-084 — the rsvp_count column is written by nothing

**Subject:** `events.rsvp_count`, declared at
`supabase/migrations/20260915214553_baseline.sql:797` as `"rsvp_count" integer DEFAULT 0`.

Re-derived 2026-09-23:

- `command grep -n rsvp_count supabase/migrations/*.sql` → **one hit**, the declaration. No
  trigger, no function, no later migration writes it. The archived pre-baseline migrations
  contain no occurrence either, so no historical writer exists in the repository.
- The **readers** in `src/` (tests and generated types excluded):
  - `src/lib/tagMapping.ts:161`: `rsvp_count: dbEvent.rsvp_count ?? null`, passed through
    to `Event.rsvp_count` on every event response.
  - `src/app/api/events/export/route.ts:32` and `:231`: the CSV export has an `rsvp_count`
    column filled with `event.rsvp_count ?? 0`. **Research did not list this reader.** Every
    exported row therefore carries 0 locally, and whatever production's never-maintained
    column holds (production not read).
- `src/app/api/clubs/[id]/events/route.ts:91-94` and the two club tab components use a
  **different**, computed `rsvp_counts` object, not this column.
- `scripts/seed/load.ts:440` names the column only in the `--dump` column list (a read).

The real counts come from F-079's route. This column is a second, stale source that nothing
maintains, and the CSV export presents it as data.

## F-085 — two upcoming floors disagree

**Subject:** the "not in the past" floor on two list endpoints.

| Endpoint | Floor | Line |
|---|---|---|
| `/api/events` | `getESTNowISO()`: Eastern wall-clock expressed as a naive-UTC ISO string | `src/app/api/events/route.ts:245-246` |
| `/api/users/saved-events` | `new Date().toISOString()`: true UTC | `src/app/api/users/saved-events/route.ts:99-101` |

`src/lib/timezone.ts:1-25` documents the convention: `start_date` is stored as Eastern
wall-clock with a `+00` offset, and "to compare against 'now' we must express the current
instant in the same naive-UTC form the DB uses". `/api/events` follows that and
`/api/users/saved-events` does not.

Worked instance (EDT, UTC-4): at 14:30 Eastern the true-UTC instant is 18:30Z. An event
stored as `16:00Z` (i.e. 16:00 Eastern, 90 minutes away) passes `/api/events`' floor
(`16:00Z ≥ 14:30Z`) and fails the saved-events floor (`16:00Z < 18:30Z`). So an event starting
within the next four hours (five under EST) is listed as upcoming in the feed and dropped from
the user's upcoming saved list. That band moves with the clock, so every event spends four to
five hours a day on the wrong side of one of the two floors.

Why this is registered and **not** fixed in Phase 4: unifying the two is a timezone-dependent
behaviour change with no characterization behind it yet (04-RESEARCH.md Pitfall 6). The
phase pins the asymmetry with a test and leaves the unification to Phase 6.

---

## Register change made in the same edit

**F-050's owner.** `closes_in_phase` moved from `null` to `"04"`. Its validation criterion (no
`event_date`/`event_time` outside historical DDL, and the analytics tests still passing after
their fixtures are corrected) is exactly Phase 4's work. The residue it names measured
**8 lines across 4 files** on the base commit (`evidence/floor.before.txt` block 14). Plan 02-08
already fixed the `useEvents.test.ts` location F-050 listed.

*Phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path*
*Plan: 04-01*
