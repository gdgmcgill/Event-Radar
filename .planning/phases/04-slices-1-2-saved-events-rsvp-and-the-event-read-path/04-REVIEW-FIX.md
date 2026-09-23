---
phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path
fixed_at: 2026-09-23T23:47:23Z
review_path: .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/04-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-09-23T23:47:23Z
**Source review:** .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (fix_scope `critical_and_warning`: CR-01, WR-01, WR-02, WR-03)
- Fixed: 4
- Skipped: 0
- Not in scope (Info, left as listed in REVIEW.md): IN-01 to IN-12

All work was done on the main working tree, branch `main`, staging explicit paths only. The three
pre-existing untracked paths (`.agents/`, `docs/product-master-plan.md`, `skills-lock.json`) were
not touched. No file under `supabase/migrations/` changed. No `--no-verify`.

## Floor after all fixes

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 (test files included) |
| `npm run lint` | 0 errors, 19 warnings — all pre-existing, none in a touched file |
| `npx jest --ci` | 50 suites / 744 passed / 0 skipped (was 721 passed / 0 skipped; +23 new tests) |
| `node scripts/check-characterization-tags.mjs --all` | `ok 18 files` |
| `node scripts/check-elevated-ratchet.mjs` | `committed=25 live=25 delta=0 PASS` |

No PRESERVE assertion was weakened or moved. Every new pin is additive. No intentional visual change on
seeded data: the only mapped-tag outputs that changed are the three `Object.prototype` keys, which no
seeded event carries.

## Fixed Issues

### CR-01: `TAG_ALIASES` plain-object lookup resolves prototype keys, injecting a function or object into `event.tags`

**Files modified:** `src/lib/eventTags.ts`, `src/lib/eventTags.test.ts`
**Commit:** `e45552a` `fix(04): CR-01 look up TAG_ALIASES by own property only (DI-37)`
**Applied fix:** `partitionTags` now resolves the alias with
`Object.prototype.hasOwnProperty.call(TAG_ALIASES, lowerTag) ? TAG_ALIASES[lowerTag] : undefined`, so
`constructor`, `__proto__` and `hasOwnProperty` are unknown tags: they fall to `EventTag.SOCIAL` and are
reported in `unmapped`. Every real tag maps exactly as before — the golden table (22 aliases, 12 members,
edges), the re-export test, the completeness test and the F-081 DEFECT suite
(`src/__tests__/lib/tag-coercion-defect.test.ts`) all pass unedited. A new describe in `eventTags.test.ts`
pins the three prototype keys (mapped `[social]`, unmapped lower-cased key), that the serialised `tags`
array holds only `EventTag` strings, and that the `[tags]` warning names the offending tag.
**Register:** DI-37 closed in `evidence/deferred-items.md` (entry, DI-40's travels-with note, Part 5 row)
citing `e45552a`; ledger row added in `evidence/defect-ledger.md` (docs commit `49c54d8`). DI-40 (the six
F-081 identity mappings) stays deferred and now travels alone. The reviewer's "separately, Phase 5 scope"
note — validating tag values in `create` and `PATCH` against `EVENT_TAGS` — was not attempted here.

### WR-01: `page` and `limit` are unvalidated and now feed cursor mode, the fuzzy RPC and `totalPages`

**Files modified:** `src/app/api/events/route.ts`, `src/__tests__/api/events/events-list-characterization.test.ts`
**Commit:** `c201ca5` `fix(04): WR-01 validate page and limit before any query in GET /api/events`
**Applied fix:** Both values are parsed with radix 10 and validated before the `timeOfDay`/`dayType`
checks and before any query: `limit` must be an integer from 1 to 100, `page` a positive integer. A
violation returns 400 `{ error, field }` in the house convention. The default (50) and the largest caller
value (`src/app/page.tsx` sends 100) are inside the bound. Swagger parameter docs (`minimum`/`maximum`,
descriptions) and the 400 description were updated. Previously `limit=abc`, `limit=0`, `page=0` reached
PostgREST and came back as a 500 echoing its message.
**Pinned behaviour change:** No existing assertion moved (no suite sent a malformed value). Eleven new
PRESERVE rows pin the two 400 bodies for `limit=abc|0|-5|101` and `page=abc|0|-1`, that nothing is queried,
that `limit=1` and `limit=100` are accepted, and that the limit check precedes the timeOfDay check.
Ledger row added (`49c54d8`). Marked **fixed: requires human verification** only in the sense that the
1–100 cap is a policy choice taken from the review's suggestion; every current caller is inside it.

### WR-02: The friends fallback swallows the RPC error and three query errors with no log line

**Files modified:** `src/app/api/events/[id]/friends/route.ts`, `src/__tests__/api/events/friends-defect.test.ts`
**Commit:** `8f3accb` `fix(04): WR-02 log the errors the friends fallback degrades over`
**Applied fix:** Five `console.error("Context:", error)` lines in the project style: the RPC error
("get_friends_going_to_event RPC error, using fallback:"), the `user_follows` read, the `saved_events`
read, the reverse `user_follows` read (each now destructures `error` alongside `data`), and the outer
catch ("Error fetching friends going to event:"). No response body, status, or query changed; the F-071
DEFECT suite passes with its assertions unedited. The suite gained a scoped `console.error` spy
(`jest.spyOn` in `beforeEach`, `mockRestore` in `afterEach`) so the expected log lines from its
RPC-error tests do not print; no assertion was added or changed. The reviewer's aside about typing the
three `(r: any)` / `(f: any)` casts is IN-03 and was left alone.

### WR-03: The cursor decoder accepts calendar-impossible timestamps that V8 rolls over and Postgres rejects

**Files modified:** `src/lib/eventCursor.ts`, `src/lib/eventCursor.test.ts`
**Commit:** `ef49fc0` `fix(04): WR-03 reject cursors whose calendar date does not exist`
**Applied fix:** New private `isRealCalendarDate(isoValue)` re-reads year/month/day from a `Date` built
with `setUTCFullYear` (so years below 100 are not shifted to 19xx) and rejects any value whose fields
moved; `decodeEventCursor` adds it as a fourth condition after the metacharacter, regex and `Date.parse`
checks. The module header's `sortValue` bullet documents the roll-over. A cursor carrying `2026-02-30` is
now `400 Invalid cursor` before any query, instead of a 500 echoing Postgres `22008`.
**Pinned behaviour change:** No existing assertion moved. Six reject rows (`2026-02-30`,
`2026-04-31T10:00:00+00:00`, `2026-02-29`, `2026-00-10`, `2026-10-00`) and one explicit test
(`Date.parse` accepts `2026-02-30`, the decoder does not) were added; three accept rows (a leap day, the
last day of a 31-day month, the last day of a 30-day month) guard against over-rejection.
`route.test.ts` and `pagination-contract-defect.test.ts` pass unedited. Ledger row added (`49c54d8`).

## Skipped Issues

None — all four in-scope findings were fixed.

## Not in scope (Info)

IN-01 through IN-12 were not attempted, per the `critical_and_warning` fix scope. They remain as listed
in `04-REVIEW.md`. Two of them touch the same code as fixes above and are worth noting for whoever picks
them up: IN-01 (the 500 branch that echoes Postgres text) is where WR-01 and WR-03 used to terminate and
now no longer do for those inputs; IN-03 (the `any` casts in the friends route) sits beside the WR-02
log lines and was deliberately left untouched.

## Commits (oldest first)

| Hash | Subject |
|---|---|
| `e45552a` | `fix(04): CR-01 look up TAG_ALIASES by own property only (DI-37)` |
| `c201ca5` | `fix(04): WR-01 validate page and limit before any query in GET /api/events` |
| `ef49fc0` | `fix(04): WR-03 reject cursors whose calendar date does not exist` |
| `8f3accb` | `fix(04): WR-02 log the errors the friends fallback degrades over` |
| `49c54d8` | `docs(04): record the review-fix ledger rows and close DI-37` |

This report is not committed; the orchestrator commits it.

---

_Fixed: 2026-09-23T23:47:23Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
