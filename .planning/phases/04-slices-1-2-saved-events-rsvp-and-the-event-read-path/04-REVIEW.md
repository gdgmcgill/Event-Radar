---
phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path
reviewed: 2026-09-23T23:07:07Z
depth: standard
diff_base: 794556a
files_reviewed: 52
files_reviewed_list:
  - .github/workflows/ci.yml
  - e2e/specs/event-read-path.spec.ts
  - e2e/specs/save-and-rsvp.spec.ts
  - scripts/check-characterization-tags.mjs
  - scripts/check-elevated-ratchet.mjs
  - scripts/probes/search-escape-probe.ts
  - src/__tests__/api/clubs/analytics.test.ts
  - src/__tests__/api/events/analytics.test.ts
  - src/__tests__/api/events/calendar-events-characterization.test.ts
  - src/__tests__/api/events/club-fabrication-defect.test.ts
  - src/__tests__/api/events/date-validation.test.ts
  - src/__tests__/api/events/events-detail-characterization.test.ts
  - src/__tests__/api/events/events-list-characterization.test.ts
  - src/__tests__/api/events/friends-defect.test.ts
  - src/__tests__/api/events/get-events.test.ts
  - src/__tests__/api/events/pagination-contract-defect.test.ts
  - src/__tests__/api/events/reviews.test.ts
  - src/__tests__/api/events/rsvp-characterization.test.ts
  - src/__tests__/api/events/rsvp-count-defect.test.ts
  - src/__tests__/api/events/rsvp.test.ts
  - src/__tests__/api/events/save-characterization.test.ts
  - src/__tests__/api/events/saved-events-characterization.test.ts
  - src/__tests__/api/events/saved-events-time-floor-defect.test.ts
  - src/__tests__/api/events/search-escaping-defect.test.ts
  - src/__tests__/helpers/fakeSupabase.ts
  - src/__tests__/lib/tag-coercion-defect.test.ts
  - src/__tests__/moderation/audit-shape.test.ts
  - src/app/api/calendar/events/route.ts
  - src/app/api/events/[id]/friends/route.ts
  - src/app/api/events/[id]/route.ts
  - src/app/api/events/[id]/rsvp/route.ts
  - src/app/api/events/[id]/save/route.ts
  - src/app/api/events/following/route.ts
  - src/app/api/events/happening-now/route.ts
  - src/app/api/events/new/route.ts
  - src/app/api/events/popular/route.ts
  - src/app/api/events/route.test.ts
  - src/app/api/events/route.ts
  - src/app/api/users/saved-events/route.ts
  - src/lib/eventCursor.test.ts
  - src/lib/eventCursor.ts
  - src/lib/eventTags.test.ts
  - src/lib/eventTags.ts
  - src/lib/searchFilter.test.ts
  - src/lib/searchFilter.ts
  - src/lib/tagMapping.ts
  - src/server/__tests__/context.test.ts
  - src/server/__tests__/requireRole.test.ts
  - src/server/context.ts
  - src/server/db/elevated/REGISTRY.md
  - src/server/db/elevated/index.ts
  - supabase/functions/events-webhook/index.ts
findings:
  critical: 1
  warning: 3
  info: 12
  total: 16
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-09-23T23:07:07Z
**Depth:** standard
**Files Reviewed:** 52
**Status:** issues_found

## Summary

Reviewed the 52 files changed between `794556a` and `HEAD`, reading every application source file in full and using `git diff 794556a..HEAD` per file to separate this phase's changes from pre-existing code. Application source was reviewed first (the eleven route handlers, `eventCursor.ts`, `searchFilter.ts`, `eventTags.ts`, `tagMapping.ts`, `context.ts`, `elevated/index.ts`), then the two CI scripts, the probe and the CI workflow, then the test suites and the fake-Supabase helper.

**What holds up under adversarial reading.** The three security-relevant paths named in the review brief were each traced end to end and none has an exploitable gap:

- *Search escaping.* `ilikeContainsFilter` composes `escapeLikeLiteral` (backslash, `%`, `_`) inside `postgrestQuotedValue` (backslash, `"`, then wrap). I walked the escaping by hand for `100%`, `a_b`, `a\b`, `a"b`, `a,b` and `(x` and each produces a value that stays inside the PostgREST quoted-value grammar; `postgrest-js` `.or()` appends (not sets) so the search `or()` and the keyset `or()` are ANDed, and `e2e/specs/event-read-path.spec.ts` tests 6, 7 and 11 pin that against the real parser. The `*` limitation is documented honestly and pinned as KNOWN.
- *Cursor decoding.* `decodeEventCursor` never throws, bounds length, requires strict padded base64, rejects arrays/primitives, requires a canonical UUID, and rejects the four PostgREST metacharacters on `sortValue` before the ISO regex runs. The route rejects a bad cursor with 400 before any query and `keysetAfter` double-quotes both values anyway. Defence in depth is real, not asserted.
- *Service-role reach and the seam.* None of the eleven reviewed routes imports `@/lib/supabase/service` or `getElevatedClient`. `node scripts/check-elevated-ratchet.mjs` reports `committed=25 live=25 delta=0 PASS` on this tree and `check-characterization-tags.mjs --all` reports `ok 18 files`; both run in CI before `npm test`. `requireUser` fails closed (no user → 401, no fallthrough). The RSVP head-count change (F-079) is correct: two `{ count: "exact", head: true }` reads, error from either surfaced.

**What does not.** One finding is Critical, three are Warnings, twelve are Info. The Critical (CR-01) is a plain-object lookup in the newly created `src/lib/eventTags.ts` that resolves prototype keys — a stored tag of `constructor` or `__proto__` makes the API emit `null` / `{}` inside `tags`, and `EventBadge` renders that object as a React child and throws. The mechanism pre-dates the phase (the old `tagMapping[lowerTag] || EventTag.SOCIAL` had it too) but the phase created this module as "the single definition of the mapping", the tag value is settable without moderation through `PATCH /api/events/[id]`, and the fix is one line. The Warnings are: the unvalidated `page`/`limit` that cursor mode now builds on; the friends fallback (rewritten this phase) swallowing four errors without a log line; and the cursor decoder accepting calendar-impossible dates that V8 rolls over and Postgres rejects, which turns a client-side 400 into a 500 that echoes the Postgres message. Info items are mostly pre-existing and are labelled as such.

No source files were modified.

## Critical Issues

### CR-01: `TAG_ALIASES` plain-object lookup resolves prototype keys, injecting a function or object into `event.tags`

**File:** `src/lib/eventTags.ts:91-92` (new module); consumers `src/lib/tagMapping.ts:95`, every list route, `src/components/events/EventBadge.tsx:25-32`, `src/components/events/EventDetailView.tsx:282-284`
**Issue:** `TAG_ALIASES` is an object literal and `partitionTags` does `const alias = TAG_ALIASES[lowerTag]; if (alias) …`. A database tag whose lower-cased form is `constructor` or `__proto__` hits `Object.prototype`, so `alias` is `Object`'s constructor function or `Object.prototype` itself — both truthy — and is added to `mapped`. Verified at runtime on this tree: `JSON.stringify([...mapped])` yields `[null, {}]`. The API then serialises `tags: [null]` or `tags: [{}]`. On the client, `EventDetailView` maps `event.tags` into `<EventBadge tag={tag}>`; `EventBadge` looks up `EVENT_CATEGORIES[tag]`, finds nothing, and renders `{tag}` as a child — an object child throws "Objects are not valid as a React child" and takes down the detail page (and any card that renders badges) for every viewer of that event. The tag value is attacker-controlled: `POST /api/events/create` (line 50) checks only that `tags` is a non-empty array, and `PATCH /api/events/[id]` lists `tags` in `EDITABLE_FIELDS` but not `MODERATED_FIELDS` (lines 141-155), so the creator of an already-approved event can set `tags: ["__proto__"]` with no re-moderation. The old `tagMapping` had the same lookup, so this is a carried-forward defect, but the phase created this module as the single definition of the mapping and its completeness test does not cover it.
**Fix:** Look up own properties only, or use a prototype-less container. Minimal change:
```ts
// src/lib/eventTags.ts
const alias = Object.prototype.hasOwnProperty.call(TAG_ALIASES, lowerTag)
  ? TAG_ALIASES[lowerTag]
  : undefined;
```
or declare the table as `Object.freeze(Object.assign(Object.create(null), { … }))` / a `Map<string, EventTag>`. Add a unit row to `eventTags.test.ts`: `expect(mapTags(["constructor", "__proto__"])).toEqual([EventTag.SOCIAL])` and `expect(partitionTags(["constructor"]).unmapped).toEqual(["constructor"])`. Separately (Phase 5 scope, not this fix), `create` and `PATCH` should validate tag values against `EVENT_TAGS`.

## Warnings

### WR-01: `page` and `limit` are unvalidated and now feed cursor mode, the fuzzy RPC and `totalPages`

**File:** `src/app/api/events/route.ts:269-270` (pre-existing lines), `:327`, `:407`, `:413-415`, `:441`, `:498` (cursor path added this phase)
**Issue:** `parseInt(searchParams.get('limit') || '50')` accepts `abc` (→ `NaN`), `0`, and negatives. Consequences on this tree: `limit=abc` gives `range(NaN, NaN)` and `result_limit: NaN` to `search_events_fuzzy`; `limit=0` gives `range(0, -1)` and `Math.ceil(total / 0)` = `Infinity`, which `NextResponse.json` serialises as `totalPages: null`; `page=0` gives a negative offset. Each malformed value reaches PostgREST, which answers 400, and the handler's error branch (lines 447-451) returns that message as a 500 (the F-059 echo). The phase did not introduce the parsing but built cursor mode on it (`range(0, limit - 1)` at line 407) and copied it into the seven-key early returns, so the surface grew. A 400 with a field name is the house convention for validation failures.
**Fix:**
```ts
const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
const rawPage = parseInt(searchParams.get('page') || '1', 10);
if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) {
  return NextResponse.json({ error: 'limit must be an integer from 1 to 100', field: 'limit' }, { status: 400 });
}
if (!Number.isInteger(rawPage) || rawPage < 1) {
  return NextResponse.json({ error: 'page must be a positive integer', field: 'page' }, { status: 400 });
}
const limit = rawLimit; const page = rawPage;
```
Pin with two rows in `events-list-characterization.test.ts` (or a new DEFECT suite if the 400 is deferred to Phase 5).

### WR-02: The friends fallback swallows the RPC error and three query errors with no log line

**File:** `src/app/api/events/[id]/friends/route.ts:29-41`, `:45-48`, `:71-73` (block rewritten this phase)
**Issue:** When `get_friends_going_to_event` errors, `error` is never logged. The three fallback reads (`user_follows` twice, `saved_events`) destructure only `data`, so a failed read is indistinguishable from "no friends"; an RLS denial or a schema drift on `user_follows` silently yields `{ friends: [], count: 0 }` forever. The outer `catch {}` also logs nothing. The project convention (CLAUDE.md, Error Handling) is `console.error` before returning; the same route's siblings do so. Graceful degradation is fine, silent degradation is not — the F-071 defect this phase fixed went undetected for exactly this reason (its TypeError was swallowed by this same catch).
**Fix:**
```ts
if (error) {
  console.error("get_friends_going_to_event RPC error, using fallback:", error);
  const { data: following, error: followingError } = await supabase.from("user_follows")…;
  if (followingError) console.error("friends fallback: user_follows read failed:", followingError);
  …
}
} catch (e) {
  console.error("Unexpected error fetching friends going:", e);
  return NextResponse.json({ friends: [], count: 0 });
}
```
Apply the same to the `saved_events` and reverse-follow reads. While there, the three `(r: any)` / `(f: any)` casts at lines 51, 55, 56 can be typed from the select shape.

### WR-03: The cursor decoder accepts calendar-impossible timestamps that V8 rolls over and Postgres rejects

**File:** `src/lib/eventCursor.ts:102-106`; downstream `src/app/api/events/route.ts:447-451`
**Issue:** The `ISO_DATE_OR_TIMESTAMP` regex checks shape only, and the `Date.parse` check is the sole calendar validation. Verified on this tree: `Date.parse("2026-02-30")` is `1772409600000` (rolled to 2026-03-02) and `Date.parse("2026-04-31")` also parses, so a cursor carrying either passes the decoder. It is safe against injection (quoted, no metacharacters), but Postgres rejects the value with `22008 date/time field value out of range`, PostgREST returns 400, and the route's error branch returns a **500** whose body is the Postgres message verbatim (F-059). Net effect: a malformed client input that the decoder promises to turn into `400 Invalid cursor` instead produces a 500 that leaks internal error text. The unit test "an impossible calendar date" (`2026-13-45`) only covers the case V8 also rejects.
**Fix:** Validate calendar fields after the regex match:
```ts
const m = ISO_DATE_OR_TIMESTAMP.exec(sortValue);
const [y, mo, d] = sortValue.slice(0, 10).split("-").map(Number);
const probe = new Date(Date.UTC(y, mo - 1, d));
if (!m || probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) {
  return null;
}
```
and add `["a rolled-over calendar date", suiteEncode({ sortValue: "2026-02-30", id: ID })]` to the reject table in `eventCursor.test.ts`. Hours/minutes/seconds are already bounded to two digits but not to 23/59/59; `Date.parse` does reject `T25:00:00Z` (verified), so those are covered.

## Info

### IN-01: Error branches echo PostgREST / Postgres message text to the caller (F-059, pre-existing)

**File:** `src/app/api/events/[id]/route.ts:100`, `src/app/api/calendar/events/route.ts:67`, `src/app/api/events/happening-now/route.ts:54`, `src/app/api/events/route.ts:448-451`
**Issue:** Each returns `error.message` (happening-now also a `details` field) in a 500. Registered as F-059 and pinned by `search-escaping-defect.test.ts`; Phase 5 owns it. Noted because WR-01 and WR-03 both terminate in this branch.
**Fix:** Return the generic `serverError(action)` and keep the detail in `console.error`.

### IN-02: `pending_edits` stripping in the detail GET is dead code (DI-36, pre-existing)

**File:** `src/app/api/events/[id]/route.ts:113-129`
**Issue:** `transformEventFromDB` builds a fresh object and never copies `pending_edits`, so the strip at line 126 removes a key that is never present, and the creator/admin never receive it either. Already recorded as DI-36 and pinned by `events-detail-characterization.test.ts` layer (b). Untouched by this phase.
**Fix:** When DI-36 is addressed, either copy `pending_edits` in the transform for the two permitted callers or delete the branch.

### IN-03: `any` casts remain in touched routes

**File:** `src/app/api/calendar/events/route.ts:72`, `src/app/api/events/[id]/friends/route.ts:51,55,56`, `src/app/api/users/saved-events/route.ts:75,102`, `src/app/api/events/popular/route.ts:137`
**Issue:** All pre-existing; friends and saved-events were edited by this phase without removing them. The project's typing plan removed the last `as any` under `src/app/api/` on the friends route's defect line but these remain.
**Fix:** Type from the select: `(savedRows as { event_id: string; created_at: string }[])`, and `transformEventFromDB(e as Parameters<typeof transformEventFromDB>[0])` as the sibling routes already do.

### IN-04: Whitespace-only lines left where `eslint-disable` comments were removed (pre-existing)

**File:** `src/app/api/users/saved-events/route.ts:55,72,74,101`
**Issue:** Four lines contain only spaces (verified with `cat -A`; present in the base commit too). Cosmetic, but Prettier will flag them and they suggest a comment was removed without its line.
**Fix:** Delete the four lines.

### IN-05: `prevCursor` is not a previous-page position

**File:** `src/app/api/events/route.ts:472`, Swagger `:246-249`
**Issue:** `prevCursor` names the first row of the *current* page. Sending it back as `cursor` returns the current page minus its first row, not the previous page — there is no `before` parameter (DEC-25 dropped it). This is only harmless because `src/hooks/useEvents.ts:190-194` treats `prevCursor` as a boolean and pops its own stack. A second consumer that used it literally would paginate wrongly.
**Fix:** Either document in the Swagger description that the value is a marker, not a navigable position, or emit `prevCursor: cursorParam ?? null` (the cursor that produced this page) which is at least the honest "where you came from".

### IN-06: A cursor is silently ignored when the fuzzy RPC succeeds (dead today, F-078)

**File:** `src/app/api/events/route.ts:400`
**Issue:** `keyset = cursor && !fuzzyRankedIds ? cursor : null` drops a valid cursor on the rank-ordered path and returns page 1 with `nextCursor: null`. `useEvents` has already pushed onto its cursor stack by then, so its `prev` state would be one step off. Unreachable while F-078 keeps the RPC failing; DEC-25 records the choice.
**Fix:** When F-078 is fixed, either page the ranked list by `page`/`limit` and reject `cursor` with 400 on a search, or emit cursors over the ranked id list.

### IN-07: One `console.warn` per transformed event with an unmapped tag; the seed triggers it on every list request

**File:** `src/lib/tagMapping.ts:96-101`
**Issue:** The seeded approved event carries `tech`, which is unmapped, so every `/api/events`, `/api/events/new`, `/api/events/popular` call logs at least one warning in every environment. Documented as accepted until Phase 6's structured logging.
**Fix:** Aggregate per request (one warning listing `{ eventId, unmapped }[]`) or gate behind `NODE_ENV !== "production"` until Phase 6.

### IN-08: `partitionTags` throws on a non-string element of `tags` (pre-existing)

**File:** `src/lib/eventTags.ts:90`
**Issue:** `tag.toLowerCase()` on a `null` element (a Postgres `text[]` can hold NULLs) throws a TypeError, which each list route turns into a 500. Carried over from the old `mapTags`.
**Fix:** `for (const tag of dbTags || []) { if (typeof tag !== "string") continue; … }`.

### IN-09: Date query parameters pass straight into `gte`/`lte` (pre-existing)

**File:** `src/app/api/events/route.ts:264-265,357`, `src/app/api/calendar/events/route.ts:23-24,57-62`
**Issue:** `dateFrom`, `dateTo`, `from`, `to` are unvalidated; a non-date value produces a PostgREST 400 that surfaces as the IN-01 500. Not an injection (single filters are not parsed as logic trees), but a 400-class input yielding a 500.
**Fix:** `if (dateFrom && !isValidISODate(dateFrom)) return badRequest("dateFrom must be an ISO 8601 date", "dateFrom")` using the existing `@/lib/dateValidation`.

### IN-10: Early returns omit the `Cache-Control` header the success path sets (pre-existing)

**File:** `src/app/api/events/route.ts:344-352`, `:375-383`, `:436-444` vs `:503-505`
**Issue:** Three of the four 200 responses from this handler are uncached while the fourth is `public, s-maxage=30`. Not incorrect, but the early-return bodies were rewritten this phase (seven keys) and the header was not carried along.
**Fix:** Build the empty body once via a small `emptyPage(page, limit, total)` helper that also sets the header.

### IN-11: `checkBanStatus()` and `createRequestContext()` each build a client and call `auth.getUser()` (registered: DEC-24 / REFAC-11)

**File:** `src/app/api/events/[id]/rsvp/route.ts:202-206`, `src/app/api/events/[id]/save/route.ts:53-57`, `src/lib/ban.ts:20-31`
**Issue:** On every RSVP POST and save POST there are now two server clients, two `getUser()` round-trips to the auth server and two `users` reads. The seam's stated purpose ("read the slice once") is not yet realised on these two write paths, and their DELETE arms perform no ban check at all. `context.ts:37-53` documents this precisely and REFAC-11 (Phase 5) owns the fail-closed seam ban guard.
**Fix:** In Phase 5, have `requireUser` (or a `requireNotBanned(ctx)`) read `banned_at`/`ban_expires_at` from `ctx.profile` and delete the standalone `checkBanStatus()` calls.

### IN-12: `check-characterization-tags.mjs` tag detection is a bare word match

**File:** `scripts/check-characterization-tags.mjs:73-74,132-133`
**Issue:** `\bPRESERVE\b` / `\bDEFECT\b` will accept a docblock that says "this is NOT a PRESERVE suite". Discovery-by-content is also case-insensitive on "characterization" while tags are case-sensitive, which is intended but worth knowing. Low risk; the gate does what the plan asked.
**Fix:** Optionally require the tag on the docblock's first content line (`PRESERVE characterization —` / `DEFECT characterization —`), which every suite in this phase already follows.

---

_Reviewed: 2026-09-23T23:07:07Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
