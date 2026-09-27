---
phase: 06-slices-6-7-async-edge-contracts-caching-observability
plan: 09
subsystem: api-contracts
status: complete
tags: [zod, contracts, parseBody, parseForm, readQuery, census-gate, clubs, users, profile, organizer-requests, F-094, DI-66, DEC-65, DEC-66, REFAC-15]
requires:
  - phase: 06-slices-6-7-async-edge-contracts-caching-observability
    provides: "06-04: parseWith/parseBody/parseQuery, common.ts, the census gate; 06-07: the slice-7 400 table (PRESERVE) and the F-094 malformed-input DEFECT suite; 06-08: parseForm, checkFile, readQuery and the adoption pattern"
provides:
  - "src/contracts/clubs.ts: ClubLinkFields + normalizeClubLink (DEC-66), ClubCreateBody, ClubUpdateBody, ClubDeleteBody, ClubInviteBody, ClubMemberBody, ClubMemberRoleBody, ClubTransferBody, ClubAppealBody, OrganizerRequestBody, ClubImageForm with CLUB_LOGO_UPLOAD/CLUB_BANNER_UPLOAD, TrendingQuery"
  - "src/contracts/users.ts: UserUpdateBody, InterestsBody, InferredTagBody, ProfileImageForm with AVATAR_UPLOAD/PROFILE_BANNER_UPLOAD, SavedEventsQuery, UserSearchQuery"
  - "src/server/body.ts: FormOptions.deferFileChecks (a route that checks size and type after a guard)"
  - "18 route files read input only through contracts; allow-list 39 entries/53 sites -> 20/33, none left under clubs, organizer-requests, users, user, profile, my-clubs or onboarding"
  - "20 F-094 rows moved in malformed-input-defect.test.ts, 2 DEC-66 pins moved to club-links-defect.test.ts; 22 ledger rows; evidence/contracts-clubs-users.txt"
affects: [06-10, 06-11, 06-13, 06-14, 06-18]
tech-stack:
  added: []
  patterns:
    - "A ladder that checks every key's type before any key's format is a pipe of stages (types -> trimmed payload -> ClubLinkFields -> email and no-fields), because a later stage runs only when the earlier one passed"
    - "An issue that must not carry `field` while its key is in fieldFor is raised from an object-level transform with no path; the per-key type issue keeps path [key] and so carries field"
    - "One rule shared by two orders: ClubLinkFields is a zod stage PATCH pipes through, and POST applies it one field at a time inside its own type loop (safeParse({ [field]: value })), keeping POST's interleaved order"
    - "A presence rule that feeds a lookup (memberId, newOwnerId, club_id) stays the handler's truthiness test, so a numeric id still reaches the 404 or membership rule it reached before"
key-files:
  created:
    - src/contracts/clubs.ts
    - src/contracts/users.ts
    - src/contracts/__tests__/clubs.test.ts
    - src/contracts/__tests__/users.test.ts
    - src/__tests__/api/review05/club-links-defect.test.ts
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/contracts-clubs-users.txt
  modified:
    - src/server/body.ts
    - src/server/__tests__/body.test.ts
    - src/app/api/clubs/route.ts
    - src/app/api/clubs/[id]/route.ts
    - src/app/api/clubs/[id]/invites/route.ts
    - src/app/api/clubs/[id]/members/route.ts
    - src/app/api/clubs/[id]/members/role/route.ts
    - src/app/api/clubs/[id]/transfer/route.ts
    - src/app/api/clubs/[id]/appeal/route.ts
    - src/app/api/clubs/banner/route.ts
    - src/app/api/clubs/logo/route.ts
    - src/app/api/clubs/trending/route.ts
    - src/app/api/organizer-requests/route.ts
    - src/app/api/users/[id]/route.ts
    - src/app/api/users/saved-events/route.ts
    - src/app/api/users/search/route.ts
    - src/app/api/profile/avatar/route.ts
    - src/app/api/profile/banner/route.ts
    - src/app/api/profile/inferred-tags/route.ts
    - src/app/api/profile/interests/route.ts
    - src/__tests__/contracts/malformed-input-defect.test.ts
    - src/__tests__/contracts/badRequestTable.ts
    - src/__tests__/api/review05/club-links.test.ts
    - scripts/contracts-allowlist.json
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/defect-ledger.md
decisions:
  - "DEC-66's 'scheme-less host path' is a value that is not an absolute URL and, with https:// in front, parses to a URL whose host contains a dot. 'club.ca' and 'instagram.com/club' are saved with https:// prefixed; 'x', 'not a link' and '/relative' are refused as `Invalid URL for <field>` on both POST and PATCH. This kept the PRESERVE order row 'bad URL beats bad email' ({ linkedin_url: 'x' }) green unedited, and means POST now refuses a non-URL, non-host value it used to store verbatim as a relative link."
  - "Each route keeps its own check order for links. PATCH checks every whitelisted type, then the links in its order (website, discord, twitter, linkedin, logo, banner). POST checks each optional field's type and then its link, field by field (logo, instagram_handle, website, discord, twitter, linkedin). Both use ClubLinkFields."
  - "A non-string club POST name, description or category answers 'Name, description, and category are required'. sanitizeText had coerced a number to '5'. This follows 06-08's events/create rule; the D3 row moved."
  - "parseForm gained deferFileChecks. clubs/logo and clubs/banner check type and size after the ownership gate, so a non-owner still gets the 403 first. parseForm checks presence and clubId, and the route calls checkFile after requireClubRole."
metrics:
  duration: "18min"
  completed: "2026-09-27"
  tasks: 2
  files: 31
---

# Phase 6 Plan 09: Clubs, Organizer-Requests, Users and Profile on Zod Contracts Summary

**The clubs, organizer-requests, users and profile families now read every body, query and upload through zod contracts (`src/contracts/clubs.ts`, `src/contracts/users.ts`), and club links follow one rule on create and edit:**
- An absolute http(s) URL is kept.
- A scheme-less host path is saved with `https://` prefixed.
- Anything else is refused as `Invalid URL for <field>`. This is DEC-66, which retires DI-66 into F-094.

Every 06-07 PRESERVE row passes except the one DEC-66 row, which moved under the ledger protocol. Every club and user PRESERVE suite passes unedited. The five club and profile Playwright specs pass from a fresh reset and seed.

## What was done

**Task 1: club and organizer-request contracts, one link rule** (`4f918ae`)
- RED came first: `clubs.test.ts` could not load (`@/contracts/clubs` missing). GREEN: 164 tests across `clubs.test.ts` and `body.test.ts`.
- **`ClubLinkFields`** is a zod stage over the six link keys, in PATCH's order. It replaces each present string link with the value to store, or refuses with `{ error: "Invalid URL for <field>" }` and no `field`.
  - Kept byte for byte: `https://x.org/a`.
  - Saved with https:// prefixed: `instagram.com/club` → `https://instagram.com/club`.
  - Refused: `javascript:alert(1)`, `data:…`, `ftp://x` and `x`.
- **`ClubCreateBody`** is a pipe of two stages:
  - First, the optional-field loop in the handler's order. For each field it checks the type (`Invalid value for <field>`, with `field`), then the link through `ClubLinkFields`.
  - Then name, description and category (sanitized), contact email, its format, and the lengths.
- **`ClubUpdateBody`** has four stages:
  1. the whitelist types (`Invalid value for <field>`, with `field`);
  2. the trimmed payload, where a blank or null clears to null;
  3. `ClubLinkFields`;
  4. `Invalid email format for contact_email`, then `No valid fields to update`.
  - Its output is the handler's `updates`, so the whitelist that replaces RLS on this elevated write is now the contract's `EDITABLE_CLUB_FIELDS`.
- Adopted at clubs POST, clubs/[id] PATCH and DELETE, invites, members DELETE, members/role, transfer, appeal and organizer-requests (`parseBody`). Each parse runs after the guards (`requireClubRole` where it applies).
  - Business rules stay in the handlers: the confirmation-name match, the transfer self and membership rules, and the member and role owner/self rules.
- clubs/logo and clubs/banner use `parseForm` with `deferFileChecks`, then `checkFile` after the ownership gate (type before size). clubs/trending uses `readQuery`.
- **Ledger protocol:**
  - Step 2: the DEFECT suite went red on 11 rows, plus the 2 DEC-66 pins.
  - The DEC-66 pins moved to `club-links-defect.test.ts` with their old assertions. They were red on the fix and green on the pre-fix sources, then flipped.
  - Step 3: green.
  - Step 4: pre-fix sources swapped in gave red on 14. `cmp` exit 0 for all 17 files after the restore.
- The allow-list lost 12 entries (12 sites), taking the census to 41/41.

**Task 2: user and profile contracts, and the Playwright re-run** (`a543979`)
- RED came first: `users.test.ts` could not load. GREEN: 58 tests.
- **`UserUpdateBody`** checks, in the handler's order: name (trimmed, 2 to 50 characters), avatar_url, banner_url (`new URL()`; stored trimmed; blank or null clears), interest_tags (`VALID_INTEREST_TAGS`), pronouns, year, faculty, visibility, onboarding_completed, then `No fields to update`.
  - It parses after the self-only 403, and its output is the payload without `updated_at`.
- **`InterestsBody`** and **`InferredTagBody`** carry their routes' texts. **`AVATAR_UPLOAD`** and **`PROFILE_BANNER_UPLOAD`** check type before size and keep each route's texts and its 500 for an unreadable form.
- **`SavedEventsQuery`** (sort defaults to recent; include_past is exactly "true") and **`UserSearchQuery`** (q is trimmed) are read through `readQuery`, with no new 400.
- users/me/*, users/[id]/follow, user/*, my-clubs and onboarding/complete read no body, query or form, so they need no contract. The census listed no site in them.
- **Ledger protocol:**
  - Step 2: red on 7.
  - Step 3: moved, green.
  - Step 4: pre-fix sources gave red on 8. `cmp` exit 0 for all 7 files.
- The allow-list lost 7 more entries (8 sites), taking the census to 33/33.
- Playwright: the five specs from a fresh `supabase db reset --local` and seed passed, **48 passed**, in one run. `next build` ran, and port 3000 was free before and after.

## Floor after this plan

| Check | Result |
|---|---|
| `npx jest --ci` | 115 suites passed + 1 skipped; 2743 tests passed + 1 skipped; exit 0 (+3 suites, +186 tests on 06-08) |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | 0 errors, 18 warnings (the pre-existing set, in the same 13 files; none in a touched file) |
| `node scripts/check-contracts.mjs` | `committed=33 live=33 delta=0`, exit 0 |
| `node scripts/check-elevated-ratchet.mjs` | `committed=0 live=0`, exit 0 |
| `node scripts/check-characterization-tags.mjs --all` | ok 54 files (+1: `club-links-defect.test.ts`) |
| PRESERVE diff against aa04365 | `bad-request-characterization.test.ts` and `src/__tests__/api/clubs` unedited; `badRequestTable.ts` has one row removed (the DEC-66 move) |
| Playwright (club-owner-surfaces, club-authorization, club-invitation-acceptance, public-profile-privacy, ban-and-onboarding-ring) | 48 passed, fresh reset and seed, one run |

Each task's `<verify>` command was run verbatim and exited 0 (evidence § 4 and § 10). Both allow-list acceptance scripts exit 0. `parseBody(request, UserUpdateBody` appears once in `users/[id]/route.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `deferFileChecks` added to `parseForm`**
- **Found during:** Task 1.
- **Issue:** `parseForm` always ran `checkFile`. clubs/logo and clubs/banner check type and size only after `requireClubRole`, so calling `parseForm` would have put a 400 ahead of a non-owner's 403 (lesson 3).
- **Fix:** `FormOptions.deferFileChecks`. `parseForm` then checks presence and fields only, and the route calls `checkFile` where the checks sat. The option has a `body.test.ts` row, and `clubs.test.ts` covers the deferred path.
- **Files modified:** `src/server/body.ts`, `src/server/__tests__/body.test.ts` (neither is in the plan's `files_modified`).
- **Commit:** `4f918ae`

**2. [Rule 2 - Correctness] `club-links.test.ts` docblock**
- The untagged regression suite's docblock said POST stores a scheme-less value "as before". It now points to DEC-66 and the defect file. No assertion besides the moved one was touched.

### Plan text against measurement
- **The pins DEC-66 moves:** two, not only club-links pins:
  - the PRESERVE table row `club PATCH: URL relative` in `badRequestTable.ts`;
  - the club-links row "still accepts a scheme-less website…".
  - Both moved to the new DEFECT file `src/__tests__/api/review05/club-links-defect.test.ts`, citing F-094, each with a "moved out of PRESERVE"-style ledger row. The plan did not name the file.
  - The PRESERVE order row `club PATCH order: bad URL beats bad email` (`linkedin_url: "x"`) stays green unedited, because of the dotted-host definition (decision 1).
- **F-094 moves:** 22 ledger rows.
  - Task 1 moved 12 rows in `malformed-input-defect.test.ts`: D0 ×3, D1 ×3, D2 ×3, D3 ×3. It also moved the 2 link pins.
  - Task 2 moved 8 rows: D0 ×2, D1 ×3, D2 ×3.
  - The D3 rows a ladder rule or lookup already answered keep their outcome: members 404, role, DELETE confirmation, transfer membership, organizer-requests 404, the PATCH type, the user name, the tag element and the inferred tag.
- **Allow-list:** 19 entries and 20 sites were retired: 12/12 in Task 1 and 7/8 in Task 2. The census went from 53 to 33, and 20 entries remain, all under `src/app/api/admin/`.
- **Adoption count:** 18 route files: 11 in Task 1 and 7 in Task 2.

### Intentional behaviour changes beyond the pinned rows (F-094 and DEC-66, documented in the contracts)
None of these is pinned by a PRESERVE suite:
- **clubs POST:**
  - A link that is neither an absolute URL nor a dotted host path (`x`, `my club`) now answers `Invalid URL for <field>`. It used to be stored verbatim as a relative link.
  - A non-string category or description now answers the required text, as the name does.
- **clubs/[id]/invites:** a non-string email answers `Email is required`. It used to be a 500 from `.trim()`.
- **clubs/logo and clubs/banner:** a string in the file field answers `File and clubId are required` before the gate. It used to be a type error after the gate.
- **profile/avatar and profile/banner:**
  - A string in the file field answers `No file provided`. It used to be the type text.
  - An unreadable form keeps its 500 body but no longer logs "Error uploading …".
- **null bodies:** they now answer 400 at profile/interests and profile/inferred-tags, where destructuring null used to give a 500.
- **users/[id] PATCH, invalid JSON:** it answers 400 and no longer logs "Error updating profile:".

## Issues

- **Task 1's commit body words the move count loosely.** It says "12 F-094 rows moved (red 11 + the 2 link pins …)". The exact numbers are above: 12 DEFECT rows plus 2 link pins make 14 Task 1 ledger rows. The commit was not amended.
- The pre-existing `[tags] Unmapped tags` and F-078 lines may appear in the Playwright server log, as in earlier plans; no spec failed.
- **DI-66:** the 06-01 register already records it as "RETIRED into F-094, executed by DEC-66's ClubLinkFields rule (06-09)", and `4f918ae` executes that. The register was not edited by this plan; the slice-7 close (06-18) may note the hash.

## Observations for later plans

- **06-10 (admin):**
  - `deferFileChecks` is available if an admin upload checks its file after a guard.
  - The 20 remaining allow-list entries are all admin. `malformed-input-defect.test.ts` now has `RAW_SITES` = 6 and `RJO_SITES` = 7, all admin, and 18 adopted files.
- **06-11 (client typing):**
  - `src/contracts/clubs.ts` imports `sanitize-html` (through `sanitizeText`) and `@/lib/utils`.
  - `src/contracts/users.ts` imports `@/lib/constants`.
  - Client code may prefer the `z.input` types: `ClubCreateBodyInput`, `ClubUpdateBodyInput`, `UserUpdateBodyInput`, `InterestsBodyInput`.
- **Not in scope, noticed:** users/[id] PATCH accepts any scheme `new URL()` parses for avatar_url and banner_url (for example `javascript:x`). These values render as image sources, not links. No finding covers this yet; it is recorded here for the slice-7 close.

## Requirements

REFAC-15 is **not** marked complete. It spans 06-04 to 06-11, and the allow-list still holds 20 admin entries for 06-10, with client typing to follow in 06-11.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register:
- **T-06-09-01:** `ClubLinkFields` refuses every non-http(s) scheme on POST and PATCH. `clubs.test.ts` has the `javascript:alert(1)` row, and the club-links suite's `javascript:` rows pass unedited.
- **T-06-09-02:** 20 F-094 rows moved to 400.
- **T-06-09-03:** only scheme-less values gain `https://`, and absolute URLs are kept byte for byte (behaviour rows in `clubs.test.ts`).
- **T-06-09-04:** the PRESERVE suites are unedited except the one ledger move, and the five specs pass.

## Self-Check: PASSED

- FOUND: `src/contracts/clubs.ts` (487 lines), `src/contracts/users.ts` (245), `src/contracts/__tests__/clubs.test.ts` (551), `src/contracts/__tests__/users.test.ts` (263), `src/__tests__/api/review05/club-links-defect.test.ts`, `evidence/contracts-clubs-users.txt` (315).
- FOUND: commits `4f918ae` and `a543979`. No commit in this plan deletes a file.
- Acceptance greps:
  - `ClubLinkFields` appears in both `clubs/route.ts` and `clubs/[id]/route.ts`.
  - `clubs.test.ts` has the `instagram.com/club` → `https://instagram.com/club` row and the `javascript:alert(1)` → `Invalid URL for` row.
  - `parseBody(request, UserUpdateBody` appears in `users/[id]/route.ts`.
- There are 22 ledger rows for 06-09, all citing F-094, with hashes `4f918ae` (14) and `a543979` (8).
