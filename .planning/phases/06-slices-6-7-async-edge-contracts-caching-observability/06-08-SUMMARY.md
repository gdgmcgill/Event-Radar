---
phase: 06-slices-6-7-async-edge-contracts-caching-observability
plan: 08
subsystem: api-contracts
status: complete
tags: [zod, contracts, parseBody, parseQuery, parseForm, readQuery, census-gate, events, calendar, multipart, F-094, DEC-65, REFAC-15]
requires:
  - phase: 06-slices-6-7-async-edge-contracts-caching-observability
    provides: "06-04: parseWith/parseBody/parseQuery, common.ts, the census gate and allow-list; 06-07: the slice-7 400 table (PRESERVE), the F-094 malformed-input DEFECT suite and the field-site correction"
provides:
  - "src/server/body.ts: parseForm (the multipart door), checkFile (a route's size/type checks, reusable after a guard), readQuery (a query contract with no 400)"
  - "src/contracts/events.ts: CreateEventBody, EventUpdateBody, RsvpBody, RsvpStatus, RsvpDeleteBody, EventInviteBody, ReviewBody, EventReportBody, EventAppealBody, UploadImageForm + EVENT_IMAGE_UPLOAD, EventsListQuery, ExportQuery, PopularQuery, CalendarQuery, each with z.input/z.infer types"
  - "src/contracts/__tests__/events.test.ts: 116 rows, expected bodies copied from the 06-07 table and the events PRESERVE suites"
  - "Twelve events-family and calendar route files read input only through contracts; allow-list 51 entries/86 sites -> 39/53, no events or calendar entry left"
  - "15 F-094 rows moved in malformed-input-defect.test.ts with 15 ledger rows; evidence/contracts-events.txt"
affects: [06-09, 06-10, 06-11, 06-13, 06-14, 06-15, 06-18]
tech-stack:
  added: []
  patterns:
    - "A pass-through body key the handler read with no rule is z.any().optional(): same type request.json() gave it, no new 400, absent stays absent (zod 4.6.5 makes a bare z.any() key required)"
    - "An object-level superRefine carries the date rules: zod runs it only when every key passed, which is exactly where the handlers checked dates"
    - "A ladder split by a business rule (RSVP POST: user_id, then the 403 mismatch, then status) is two contracts: parseBody for the part before the rule, parseWith for the part after it"
    - "A query contract that cannot refuse is read through readQuery, so the route carries no 400 branch (and the PRESERVE P0 detector, which counts parseQuery( as 'can answer 400', stays true)"
    - "parseForm: unreadable form -> the route's own status/body; missing file (or a string in the file field) -> the route's missing text; schema over the non-file fields; then size/type in the route's order"
key-files:
  created:
    - src/contracts/events.ts
    - src/contracts/__tests__/events.test.ts
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/contracts-events.txt
  modified:
    - src/server/body.ts
    - src/server/__tests__/body.test.ts
    - src/app/api/events/route.ts
    - src/app/api/events/create/route.ts
    - src/app/api/events/[id]/route.ts
    - src/app/api/events/[id]/rsvp/route.ts
    - src/app/api/events/[id]/invite/route.ts
    - src/app/api/events/[id]/reviews/route.ts
    - src/app/api/events/[id]/report/route.ts
    - src/app/api/events/[id]/appeal/route.ts
    - src/app/api/events/upload-image/route.ts
    - src/app/api/events/export/route.ts
    - src/app/api/events/popular/route.ts
    - src/app/api/calendar/events/route.ts
    - src/__tests__/contracts/malformed-input-defect.test.ts
    - scripts/contracts-allowlist.json
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/defect-ledger.md
decisions:
  - "Non-string text answers a 400 (F-094). On create, it answers the field's own required text: a number used to be coerced to '5' and an object threw inside sanitizeText. On edit, title, description and location answer a new text, '<Field> must be a string', because none existed to keep (null stays allowed for the two nullable columns). The appeal message answers its required text. The report message answers a new 'Message must be a string'. Rows a ladder rule already refused keep their outcome; for example, a numeric RSVP DELETE user_id still gets the 403 mismatch."
  - "RSVP POST parses user_id through RsvpBody, then the handler's 403 mismatch runs, then RsvpStatus through parseWith. This keeps today's order: a mismatched caller with a bad status still gets the 403."
  - "readQuery was added for query contracts with no 400. calendar/events reads through it, because parseQuery( made the unedited PRESERVE P0 coverage check count the route as able to answer a 400. 06-09 and 06-10 should use it for their no-400 query routes (clubs/trending, users/saved-events and others)."
  - "parseForm keeps each route's own texts and order, and its answer to an unreadable form (events/upload-image: 500 'Internal server error'). checkFile is exported so 06-09's clubs/logo and clubs/banner can keep their type/size checks after the ownership gate."
metrics:
  duration: "21min"
  completed: "2026-09-27"
  tasks: 2
  files: 20
---

# Phase 6 Plan 08: Events Family and Calendar on Zod Contracts Summary

**The events family and the calendar now read every body, query string and upload through zod contracts in `src/contracts/events.ts`, using `parseBody`, `parseQuery`, `readQuery` or the new `parseForm`:**
- Every 06-07 PRESERVE row and every events PRESERVE suite passes byte for byte and unedited.
- Malformed events bodies answer 400 instead of 500: 15 F-094 rows moved under the ledger protocol.
- The contracts allow-list lost all 12 of its events and calendar entries (33 sites).

## What was done

**Task 1: `parseForm`, and the body contracts at eight routes** (`4caf196`)
- RED came first: `events.test.ts` could not load, and 9 `parseForm` rows failed. GREEN: 117 tests across the two unit suites.
- **`parseForm(request, schema, { file, unreadable })`** works in this order:
  - it reads the form inside a try; an unreadable form gets the route's own status and body;
  - a missing file, or a string in the file field, gets the route's missing text;
  - the non-file fields go through the schema, first value per key;
  - `checkFile` then checks size and type in the route's order, with the route's texts.
- **`CreateEventBody`** declares its keys in the handler's order (title, description, start_date, location, tags, price, rsvp_link).
  - title, description and location are sanitized in the schema, so the "only markup" row still answers "Title is required".
  - The dates are an object-level refinement through `validateEventDates`, so they are still checked last.
  - `fieldFor: ["start_date", "end_date"]`.
- **`EventUpdateBody`** keeps only whitelisted keys, as sent and only when present, so `field in body` reads as before.
  - A body with no whitelisted key answers "No valid fields to update" first.
  - The date rules follow, including the end_date-only branch with `field: "end_date"` (the 06-07 correction).
- **RSVP, invite, reviews, report, appeal and upload-image** each parse at the point where the raw read sat. Guards and business rules stay in the handlers: the RSVP 403, the reviews "after the event has ended" rule and the invite friend filter.
- **Ledger protocol**, run on the DEFECT suite:
  - Step 2 (the fix applied, the suite unedited): red, 15 rows (D0 ×2, D1 ×4, D2 ×6, D3 ×3).
  - Step 3 (rows moved): green, 73/73, including one new D0 check that the 7 adopted files call `parseBody(request, ` with no raw read.
  - Step 4 (pre-fix sources swapped in): red, 16. `cmp` exit 0 for all 8 files after the restore.
- 8 allow-list entries (9 sites) were retired, taking the census to 77/77.

**Task 2: the query contracts, and the harness re-run** (`c8645cf`)
- RED came first: 31 query rows failed. GREEN: 114 in the suite.
- **`EventsListQuery`** checks limit, page, timeOfDay, dayType and cursor in that order.
  - The limit and page 400s carry `field`.
  - parseInt defaults and truncation are kept (`limit=5.9` → 5, `limit=` → 50).
  - An empty timeOfDay or dayType stays `""`; an empty cursor is absent.
- **`ExportQuery`** checks format, eventId, eventIds (split, trimmed, blanks dropped; ids keep their case), then "not both".
- **`PopularQuery`** refuses only an unknown sort. limit is capped at 50, and offset and min_score parse silently, NaN included.
- **`CalendarQuery`** passes from and to through as sent, garbage included.
- Every route read `searchParams.get` directly; now none does.
- 4 more allow-list entries (24 sites) were retired, leaving the census at 53/53. The acceptance check for `api/(events|calendar)/` exits 0.
- Playwright, all four specs, each run starting from a fresh `supabase db reset --local` and seed:
  - Run 1: 33 passed and 1 failed. See Issues.
  - Run 2: **34/34 passed**.

## Floor after this plan

| Check | Result |
|---|---|
| `npx jest --ci` | 112 suites passed + 1 skipped; 2557 tests passed + 1 skipped; exit 0 (+1 suite, +127 tests on 06-07) |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | 0 errors, 18 warnings (the pre-existing set; none in a touched file) |
| `node scripts/check-contracts.mjs` | `committed=53 live=53 delta=0`, exit 0 |
| `node scripts/check-elevated-ratchet.mjs` | `committed=0 live=0`, exit 0 |
| `node scripts/check-characterization-tags.mjs --all` | ok 53 files |
| PRESERVE diff (`bad-request-characterization`, `badRequestTable.ts`, `src/__tests__/api/events`, export route test) | empty against aa04365 |
| Playwright (event-read-path, save-and-rsvp, event-moderation-notifications, anonymous-browse) | 34 passed (run 2, fresh reset and seed); `next build` compiled in both runs |

Each task's `<verify>` command was run verbatim and exited 0 (evidence § 4 and § 9).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `readQuery` added, and calendar/events reads through it**
- **Found during:** Task 2.
- **Issue:** Once calendar/events called `parseQuery(`, the unedited PRESERVE check P0 in `bad-request-characterization.test.ts` counted it as a route that can answer a 400. That route has no 400 row, and `CalendarQuery` cannot refuse.
- **Fix:** Added `readQuery(params, schema)` to `body.ts`. It builds the same input as `parseQuery` and throws if the schema refuses, which would be a bug in the schema. The route no longer carries a 400 branch it could never take, and P0 is true again without editing the PRESERVE file.
- **Tests:** 2 rows in `body.test.ts` and 1 in `events.test.ts`.
- **Files modified:** `src/server/body.ts`, `src/server/__tests__/body.test.ts`, `src/app/api/calendar/events/route.ts`
- **Commit:** `c8645cf`

**2. [Rule 1 - Bug] A variable in calendar/events shadowed another**
- **Found during:** Task 2. The first adoption's `const query` collided with the handler's `let query` builder (the 06-04 precedent). The variable was renamed, then replaced by the `readQuery` destructure.

### Plan text against measurement
- **Allow-list:** 12 entries and 33 sites were retired (Task 1: 8 entries, 9 sites; Task 2: 4 entries, 24 sites). The census went from 86 to 53, with no events or calendar entry left.
- **F-094 moves:** 15 rows moved, each with a ledger row: D0 ×2, D1 ×4, D2 ×6, D3 ×3. Five D3 rows already answered a ladder refusal and stay as they were, now answered by the contract: invite, RSVP status, RSVP DELETE's 403, reviews and report.
- **The keys the plan named were not all the real ones:**
  - The plan named `registration_url`; the body key is `rsvp_link`.
  - `RsvpBody` alone could not keep today's order, because the 403 sits between user_id and status. It is `RsvpBody` + `RsvpStatus`.
- **`field` scope:** besides start_date, end_date and the end_date-only branch, the events list's limit and page 400s carry `field`. They did so already, and they are pinned by the list suites.
- **Adoption count:** 12 route files as planned; `readQuery` counts as adoption for calendar.

### Intentional behaviour changes beyond the pinned rows (F-094, documented in `src/contracts/events.ts`)
None of these is pinned by a PRESERVE suite. Each is a malformed or mistyped input:
- **events/create:** a non-string description or location now answers its required text.
- **events/[id] PATCH:** a non-string description or location, or a null title, now answers `<Field> must be a string`. A null title used to reach the NOT NULL column as a 500.
- **events/[id]/report:**
  - A non-string message answers `Message must be a string`; an object used to throw with no try.
  - A category that is an inherited key such as `toString` is now "Invalid category".
- **null or array bodies:** they now answer 400 at reviews and RSVP POST, where they used to reach a 500 from destructuring.
- **events/upload-image:** a string in the file field answers "No file provided". It used to answer `Invalid file type "undefined"…`.
- **upload-image, unreadable form:** it keeps its 500 body but no longer logs "Error uploading image:" for it.

## Issues

- **Playwright run 1: `save-and-rsvp.spec.ts:53` failed once, then passed from a second fresh reset (34/34).**
  - What happened: the awaited `POST /api/events/<e1>/save` had answered, and a psql probe right after the run shows the `saved_events` row. The write landed with saved=true, but the control still read "Save".
  - The cause is most likely `EventDetailClient`'s mount-time `checkSaved` GET resolving after the toggle and setting saved back to false.
  - This plan touches neither route nor that component (the save route was last changed in 05-06, `aa50ff6`). It passed in every floor run through 06-06.
  - It is recorded here for the slice-7 close (06-18) to register as a deferred item, the way 06-06 registered slice 6's. The register was not edited by this plan.
- The pre-existing F-078 fuzzy-search `0A000` and the `[tags] Unmapped tags` lines appear in the Playwright server log, as in earlier plans.

## Observations for later plans

- **06-09 (clubs, users, profile):**
  - Use `readQuery` for query routes with no 400 (clubs/trending, users/saved-events, users/search if it has none).
  - Use `parseForm` + `checkFile` for clubs/logo and clubs/banner: their type check comes before size, and both come after the ownership gate. Call `parseForm` with the missing text "File and clubId are required", then call `checkFile` where the checks sit today.
  - profile/avatar and profile/banner check type before size (`order: ["type", "size"]`).
- **06-10 (admin):** the same `readQuery` pattern applies to the admin list routes whose query values are only coerced.
- **06-11 (client typing):** `src/contracts/events.ts` imports `sanitize-html` (through `sanitizeText`) and `@/lib/eventCursor`. A client import of the create schema would bundle sanitize-html, so client typing may prefer the `z.input` types.
- **Not in scope, noticed:** events/[id] PATCH writes `rsvp_link` and `price` as sent, with none of the create route's length or URL-scheme checks. A PATCH can store a `javascript:` link that create would refuse. No finding covers this yet; it is recorded here only, for the slice-7 close to register.

## Requirements

REFAC-15 is **not** marked complete. It spans 06-04 to 06-11, and the allow-list still holds 39 entries for 06-09 and 06-10.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register:
- **T-06-08-01:** handled by the schemas at the boundary; 15 F-094 rows moved.
- **T-06-08-02:** `parseForm` keeps each route's file checks and texts. `body.test.ts` has rows for type, size, order, the size boundary and a string in the file field, and `events.test.ts` has the upload rows.
- **T-06-08-03:** every PRESERVE suite is unedited.
- **T-06-08-04:** no query parameter gained a 400, and the four event specs pass.

## Self-Check: PASSED

- FOUND: `src/contracts/events.ts` (559 lines), `src/contracts/__tests__/events.test.ts` (576 lines), `evidence/contracts-events.txt` (294 lines), `src/server/body.ts` (312 lines).
- FOUND: commits `4caf196` and `c8645cf`. Neither deletes a file.
- The acceptance greps each return 1: `parseBody(request, CreateEventBody` and `fieldFor` in the create route, `parseForm(` in upload-image.
- Both allow-list acceptance scripts exit 0.
- There are 15 ledger rows for 06-08, all citing F-094 with hash `4caf196`.
