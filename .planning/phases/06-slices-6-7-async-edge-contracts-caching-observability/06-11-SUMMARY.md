---
phase: 06-slices-6-7-async-edge-contracts-caching-observability
plan: 11
subsystem: api-contracts
status: complete
tags: [zod, contracts, client-reuse, swr, hooks, census-gate, bundle, REFAC-16, DEC-67]
requires:
  - phase: 06-slices-6-7-async-edge-contracts-caching-observability
    provides: "06-04: common.ts, the census script; 06-08/06-09/06-10: the events, clubs, users and admin request contracts every client body is now typed from"
provides:
  - "src/lib/contractCheck.ts: checkResponseInDev(label, loadSchema, json) and the ZodTypeLike structural type (no zod import)"
  - "Loose response schemas: EventsListResponse, FeaturedEventsResponse, EventAnalyticsResponse, EventReviewsResponse (events); ClubResponse, ClubEventsResponse, ClubMembersResponse, ClubInvitesResponse, ClubFollowStatusResponse, FeaturedClubsResponse, ClubAnalyticsResponse (clubs); MyClubsResponse, FollowedClubsResponse, AvatarUploadResponse (users); NotificationCountResponse; ThumbsFeedbackResponse; each with a z.infer *ResponseBody type"
  - "BodilessRequestInit (common.ts) and per-route aliases: EventSaveRequestInit, EventDeleteRequestInit, ClubFollowRequestInit, UserFollowRequestInit, OnboardingCompleteRequestInit, NotificationReadRequestInit, NotificationsActionRequestInit, UnbanRequestInit, AdminEventDeleteRequestInit, FeaturedDeleteRequestInit, ExperimentDeleteRequestInit"
  - "Form field-name types: ProfileImageFileField, ClubImageFormField, EventImageFileField (the route contracts now read their `field` from the same constant)"
  - "New Input types: ThumbsFeedbackBodyInput, AnalyticsFeedbackBodyInput, RsvpDeleteBodyInput, EventInviteBodyInput, ReviewBodyInput, EventReportBodyInput, EventAppealBodyInput, ClubDeleteBodyInput, ClubMemberBodyInput, ClubMemberRoleBodyInput, ClubTransferBodyInput, ClubAppealBodyInput, InferredTagBodyInput, NotificationsQueryInput"
  - "The 8 hooks typed from contracts with development-only response checks; 36 client files with every mutation typed from its handler's contract"
  - "node scripts/check-contracts.mjs --client (client files=38 violations=0) and its CI step"
affects: [06-12, 06-13, 06-14, 06-15, 06-18]
tech-stack:
  added: []
  patterns:
    - "A development-only check lives in a module-level function: `if (process.env.NODE_ENV !== \"production\") { void checkResponseInDev(label, () => import(\"@/contracts/x\").then((m) => m.Schema), json); }`. Next inlines NODE_ENV, so the branch and its import() leave production chunks; keeping import() out of hook bodies keeps the React-Compiler lint rules analysing the hook"
    - "A client body is typed in place: `JSON.stringify({ ... } satisfies XBodyInput)` with `import type { XBodyInput } from \"@/contracts/x\"`; the emitted JavaScript is identical to the untyped call"
    - "A bodiless mutation's init is `{ method } satisfies XRequestInit` (a BodilessRequestInit alias), so the file names its route's contract and an added body fails tsc"
    - "A FormData field name is `\"file\" satisfies ProfileImageFileField`: a type-only coupling, since a value import from a contract module would ship zod"
key-files:
  created:
    - src/lib/contractCheck.ts
    - src/hooks/contract-dev-check.test.ts
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/client-contracts.txt
  modified:
    - src/contracts/common.ts
    - src/contracts/events.ts
    - src/contracts/clubs.ts
    - src/contracts/users.ts
    - src/contracts/notifications.ts
    - src/contracts/recommendations.ts
    - src/contracts/admin.ts
    - src/hooks/useEvents.ts
    - src/hooks/useClubs.ts
    - src/hooks/useAnalytics.ts
    - src/hooks/useFeaturedClubs.ts
    - src/hooks/useFeaturedEvents.ts
    - src/hooks/useNotificationCount.ts
    - src/hooks/useTracking.ts
    - src/hooks/useAvatarUpload.ts
    - scripts/check-contracts.mjs
    - src/__tests__/scripts/check-contracts.test.ts
    - .github/workflows/ci.yml
    - "36 client files (11 admin/moderation pages, 5 other pages, 19 components, src/lib/upload-utils.ts): see the Task 2 commit"
decisions:
  - "Each hook's development-only check is a module-level function whose import() sits inside the NODE_ENV branch. That is what removes the contract chunk from production (measured 0; a forced-live build finds it). It also keeps the React-Compiler lint rules analysing the hook: an import() in a hook body made them skip it."
  - "Clients reach contracts through `import type` only. The plan's 'field-name constant' is exported (the route contracts read it) and consumed as a type (`\"file\" satisfies ProfileImageFileField`), because a value import from a contract module pulls zod and sanitize-html into the client bundle."
  - "Bodiless mutations had no contract to name. BodilessRequestInit (`Omit<RequestInit, \"body\"> & { body?: never }`) with one alias per route states 'this handler reads no body', and a body added at a call site becomes a type error."
  - "Response schemas are loose and list what the handler sends on success. The hooks keep their public data types (the domain types in @/types). Typing SWR data with the looser contract types would ripple into every consumer component, a rendered-code change the plan forbids. Compile-time coupling is carried by the request bodies, query keys and typed loaders."
metrics:
  duration: 23min
  completed: 2026-09-27
  tasks: 2
  files: 57
---

# Phase 6 Plan 11: Client contract reuse Summary

The zod contracts are now shared with the client, with no production cost. Every client-built mutation body, bodiless init and upload field name is typed from its handler's contract through `import type`, so renaming a contract key fails `tsc` at the caller. A development-only `checkResponseInDev` warns when a hook's response drifts from the contract. The new `--client` census gate, now in CI, keeps any new sender honest, and the production client chunks hold no zod.

## What was done

**Task 1 (e2771b7), hooks typed from contracts, development-only response checks.**

- **The helper.** `src/lib/contractCheck.ts` holds `checkResponseInDev`. In production it returns before the loader runs. Otherwise it loads the schema and `safeParse`s the JSON. On a mismatch it prints one `console.warn("[contract]", label, path, message)`: the path is dotted, or `(root)`, and the body is never printed. It never throws, and a loader or `safeParse` failure is swallowed. It declares a structural `ZodTypeLike`, so it imports nothing from zod.
- **Response schemas.** 16 loose response schemas sit next to the request schemas (see `provides`). Each lists what its handler really sends on success.
- **The eight hooks.** Each imports its contract with `import type` and checks from a module-level function (Decisions).
  - `useEvents` types its query keys against `keyof EventsListQueryInput`. It does this through a narrowed `URLSearchParams` interface. `sort`, `direction` and `clubId` are named explicitly as sent-but-unread (DEC-25).
  - `useTracking` types its three bodies. The analytics body is `AnalyticsFeedbackBodyInput & { user_id: string }`, because it still sends `user_id: ""`, which the contract drops (DI-44).
  - `useAvatarUpload` types its form field.
- **The test.** `src/hooks/contract-dev-check.test.ts` is 270 lines and runs in jsdom. It was recorded red first (module missing) and now passes 14 tests: directly, and through `useNotificationCount` and `useFeaturedEvents`, under NODE_ENV test and production. `src/hooks/useEvents.test.ts` is unedited and green.

**Task 2 (54da7b5), client mutation bodies, the `--client` census, the bundle proof.**

- **The census rule.** `scripts/check-contracts.mjs --client` treats a non-route, non-test file as a sender when it holds three things: a `fetch(`, a string literal starting `/api/`, and a quoted POST, PUT, PATCH or DELETE. Every sender must import from `@/contracts/`. The test is per file and deliberately broad, so `{ method }` and ternary methods count. There is no allow-list.
- **Before and after.** Red on the real tree: 38 senders, 36 violators, 74 mutation-method lines. Now `client files=38 violations=0`.
- **The 36 files.** Every body is `satisfies X…Input` (or an annotated variable). Every bodiless init is `satisfies …RequestInit`. Every FormData field is `"…" satisfies …Field`.
- **Bytes unchanged.** The emitted JavaScript is identical for 35 of the 36 files; the method is described in the evidence, § 2.6. The notifications page builds the same `?action=mark-all-read` URL from a typed const.
- **The coupling bites.** A mutation probe renamed `ClubTransferBody.newOwnerId` and `EventsListQuery.search`. `tsc` then failed at the handlers and at `ClubSettingsTab.tsx:232` and `useEvents.ts:100`, and both files were restored.
- **Fixtures and CI.** `check-contracts.test.ts` gains 5 `--client` cases, including a red one (exit 1) and a green one (exit 0). The CI "Contracts census" step also runs `--client`.
- **Bundle proof (A4).** After a production build, `command grep -rlE 'ZodError|\$ZodType' .next/static/chunks | wc -l` returns `0`. Four other zod and contract markers also count 0 (evidence § 2.7). There are two positive controls:
  - The same build's `.next/server` finds all four markers (2 to 8 files each).
  - A build with the development branch forced live in the eight hooks, reverted afterwards, finds zod in a client chunk. That build also compiled, which proves the contract modules (sanitize-html included) bundle for the browser in development.
  - The final build of the committed tree is back to 0.
- **Persona specs.** After `supabase db reset --local` and the seed, the four specs passed 31/31.

## Floor after this plan

| Gate | Result |
|---|---|
| `npx jest --ci` | exit 0: 117 suites passed plus 1 skipped; 2896 tests passed plus 1 skipped (floor 2877 + 14 + 5) |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0: 0 errors, 17 warnings (floor 18; one unused directive went with the `Record<string, any>` it excused) |
| `node scripts/check-contracts.mjs` | exit 0: committed=0 live=0 delta=0 |
| `node scripts/check-contracts.mjs --client` | exit 0: client files=38 violations=0 |
| `node scripts/check-elevated-ratchet.mjs` | exit 0: committed=0 live=0 delta=0 |
| `node scripts/check-characterization-tags.mjs --all` | exit 0: ok 54 files |
| `npm run build` | exit 0; zod markers in `.next/static/chunks` = 0 |
| Playwright (4 specs, fresh reset) | exit 0: 31 passed |

Every command, with its output, is in `evidence/client-contracts.txt`.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1: lint coverage] The checks moved out of the hook bodies.**
- **Found during:** Task 1.
- **Issue:** Written inline, as the plan's action sketches, the checks put an `import()` in each hook body. Lint went from 18 to 19 warnings: the `react-hooks/set-state-in-effect` directive in `useNotificationCount` became unused, because the React-Compiler-based rules stop analysing a hook that contains an `import()`. That is a silent loss of lint coverage on every hook.
- **Fix:** Each check now lives in a module-level function. Lint is back to 18 and the directive is used again.
- **Files:** the 8 hooks.
- **Commit:** e2771b7.

**2. [Rule 3: bundle constraint] The field-name constant is consumed as a type.**
- **Found during:** Task 1 (`useAvatarUpload`) and Task 2 (upload senders).
- **Issue:** The plan says "append fields using the form contract's exported field-name constant". A value import from `@/contracts/*` would pull zod and sanitize-html into the client bundle.
- **Fix:** The constants are exported (`PROFILE_IMAGE_FILE_FIELD`, `CLUB_IMAGE_FILE_FIELD`, `EVENT_IMAGE_FILE_FIELD`), and the route contracts' `field` now reads them. Clients use `"file" satisfies ProfileImageFileField`, which is the same coupling with no runtime import.
- **Commits:** e2771b7, 54da7b5.

**3. [Rule 3: missing contract] Bodiless mutations had nothing to import.**
- **Found during:** Task 2.
- **Issue:** The plan says to "import the route's params or query type". Only `ReviewTargetParams` exists, and the bodiless routes (follow, save, unban, the admin deletes, the notification reads, onboarding/complete) have no contract.
- **Fix:** `BodilessRequestInit` in `common.ts`, plus one named alias per route in its family's contract file. The notifications mark-all call types its query value through `NotificationsQueryInput`.
- **Commit:** 54da7b5.

**4. [Rule 2: correctness] A call-site NODE_ENV guard as well as the in-function one.**
- **Issue:** The plan puts the production return inside `checkResponseInDev`. On its own, that leaves the loader's `import()` live code, so the contract chunk (and zod) would still be emitted as a lazy chunk.
- **Fix:** Each call site wraps the check in `if (process.env.NODE_ENV !== "production")`, which is research A4's "import schemas only inside the dev branch". The in-function guard stays as a second line of defence and is tested.
- **Commit:** e2771b7.

### Measured counts that differ from the plan and research

- **Senders.** Research Inventory D said "~30 mutation call sites"; the plan inherited that. Measured: 38 sender files (36 violators plus the 2 hooks) and 74 mutation-method lines, 29 of them in the admin and moderation pages. The census is broader than a literal-URL scan because it also catches variable methods (`FollowUserButton`, `FeatureEventModal`, the friends page).
- **Contract files.** `src/contracts/interactions.ts` is in the plan's `files_modified` but did not change. `InteractionBodyInput` already existed, and `useTracking` reads no interactions response. `src/contracts/common.ts` and `src/contracts/admin.ts` are not in the list but gained `BodilessRequestInit` and its admin aliases.
- **One cast.** `src/app/profile/ProfileClient.tsx` holds the plan's only type assertion (see Issues).
- **Lint.** 17 warnings, one fewer than the floor.
- **A local type replaced.** `src/app/feedback/page.tsx` had its own `FeedbackType` union; it now uses the contract's `FeedbackType`. Both are the same three values, and the change is type-only.

## Issues

- **The visibility column can hold values the contract refuses.** `users.visibility` is `text DEFAULT 'public'` with no CHECK constraint (`baseline.sql:1137`), but the PATCH contract accepts only `"public" | "private"`. `ProfileClient` initialises its state from the stored value, so typing the body surfaced the gap. It is resolved with the plan's one type assertion (commented), which changes nothing at runtime. A stored value outside the two is still sent and answered 400, as before. This is for the slice-7 close to register (next id DI-87): either a CHECK constraint (Phase 7 schema) or a client default.
- **An analytics type the route does not match.** `EventAnalytics` in `src/types` declares `rsvp_cancelled`, but `GET /api/events/[id]/analytics` never sends it (the club analytics route does). `EventAnalyticsResponse` lists what is sent, so the development check stays quiet. `useEventAnalytics` has no consumer today. It is recorded for the slice-7 close; nothing was changed.
- **Playwright residue.** The Playwright run leaves the local stack in its post-spec state (DI-85's wall-clock stamp). No gate in this plan reads pgTAP afterwards.

## Observations for later plans

- **06-12..06-14 (route adoption).** These plans must not change the success bodies listed in the response schemas without updating the schema. The development warning will flag it; nothing in CI will. The positive-control method in evidence § 2.8 is how to prove a future client import stays out of production chunks.
- **Adding a mutation to a client file.** It must import from `@/contracts/`, or CI's `--client` step fails. A new bodiless route should get a `BodilessRequestInit` alias.

## Requirements

REFAC-16 is marked complete. The contracts are exported and reused by the client:
- Every client-built body is typed from its handler's contract, and `tsc` fails at the caller on a breaking change (evidence § 2.5).
- The eight hooks check their responses in development.
- CI enforces the rule (`--client`).
- The production bundle pays nothing (§ 2.7 to 2.9).

## Known Stubs

None. No placeholder values, empty data sources or TODO markers were introduced.

## Threat Flags

None. No endpoint, auth path, file access or schema change at a trust boundary was added. T-06-11-01..04 are mitigated as planned:
- **T-06-11-01:** the warning prints the label, path and message only; the test asserts the body never reaches the console.
- **T-06-11-02:** the check never throws, and production returns before loading (tested).
- **T-06-11-03:** the `--client` red fixture and the CI step.
- **T-06-11-04:** production chunks hold 0 zod markers.

## Self-Check: PASSED

- FOUND: src/lib/contractCheck.ts
- FOUND: src/hooks/contract-dev-check.test.ts
- FOUND: scripts/check-contracts.mjs (with --client)
- FOUND: .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/client-contracts.txt
- FOUND: commit e2771b7
- FOUND: commit 54da7b5
