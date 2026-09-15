# Skipped-Suite Disposition — STAB-08 / STAB-13 (batch 5)

**Plan:** 02-08 · **Phase:** 02-dependency-and-runtime-stabilization · **Recorded:** 2026-09-15
**Status:** Four of five suites revived and passing. The fifth is **decided, not fixed** — left
skipped on purpose, with the contract question handed to Phase 4. This file is the record of
why, so that nobody in a later phase has to re-derive it and nobody can re-argue it from memory.

> **Decision: leave `src/app/api/events/route.test.ts` skipped.** No install revives it; its
> problem is contract drift, not a missing package. It asserts a cursor-pagination contract and
> the handler has no cursor concept at all. Which of the two is wrong is genuinely unknown, so
> reviving it against the handler's current behaviour would freeze a possible defect as the
> specification. The suite is not rewritten, not deleted, and the route handler is not edited.
> The contract question belongs to **REFAC-10** (the event read path slice) in Phase 4.

Every number below was produced by the command printed next to it, in this working tree, on
2026-09-15. Nothing is transcribed from a planning document.

---

## 1. Per-suite record — all five

Counts in the "Skipped tests before" column are the Phase 1 figures from
`.planning/audit/baseline/test-runner-decision.md` § 5; they sum to 35, and with the single
`it.skip` inside `src/__tests__/api/events/get-events.test.ts` they make the AUDIT-13 baseline's
36.

| Suite | Skipped tests before | Install alone revives it? | Extra repair needed | Status after batch 5 |
|---|---|---|---|---|
| `src/components/ErrorBoundary.test.tsx` | 2 | yes | remove the stub; also remove the stray `"use client"` on line 1 — a Jest test module is not a client component | **executing, 2 passing** |
| `src/components/events/EventFilters.test.tsx` | 5 | yes | remove the stub, nothing else | **executing, 5 passing** |
| `src/components/events/FilterSidebar.test.tsx` | 4 | **no** | remove the stub **+** replace three `"academic"` string literals with `EventTag.ACADEMIC`; `@/types` had to be imported *before* the component under test, because `jest.mock` is hoisted above the imports and its factory reads the enum when `EventFilters` is first required | **executing, 4 passing** |
| `src/hooks/useEvents.test.ts` | 20 | **no** | remove the stub and the rework TODO; capitalised tag strings → enum members (and the two URL assertions that restated them now interpolate the enum); complete the `Club` fixture against its interface (8 missing fields) and the `Event` fixture against its own; type the destructured `renderHook` `filters` binding as `EventFilter`; delete the two non-existent day-and-clock columns per AUDIT-19 / F-050 | **executing, 20 passing** |
| `src/app/api/events/route.test.ts` | 4 | **no — the install is irrelevant** | contract drift, not a missing package. See § 2 | **still skipped, by decision** |

The four revived suites contribute exactly the 31 tests their Phase 1 counts predicted (2 + 5 +
4 + 20 = 31), and no cast was added to make any fixture fit: the `as any` count went 1 → 0 in
all four files.

```
npx jest --ci src/components/ErrorBoundary.test.tsx \
               src/components/events/EventFilters.test.tsx \
               src/components/events/FilterSidebar.test.tsx \
               src/hooks/useEvents.test.ts
# Test Suites: 4 passed, 4 total
# Tests:       31 passed, 31 total
```

---

## 2. The fifth suite: why it is decided rather than fixed

### 2.1 The handler has no cursor concept — re-runnable, with its result

```
$ command grep -c -i "cursor" src/app/api/events/route.ts
0

$ command grep -c -i "cursor" src/app/api/events/route.test.ts
27
```

Twenty-seven occurrences in the suite, zero in the handler it tests. The suite even carries its
own `encodeCursor` / `decodeCursor` base64 helpers. That is not a suite waiting on a package.

What the handler does instead is offset pagination:

```
$ command grep -n "page\|range(" src/app/api/events/route.ts | head -5
171:    const page = parseInt(searchParams.get('page') || '1');
172:    const limit = parseInt(searchParams.get('limit') || '50');
268:    const from = (page - 1) * limit;
269:    const to = from + limit - 1;
270:    eventsQuery = eventsQuery.range(from, to);
```

### 2.2 The divergence is live, not merely historical

This batch surfaced a fact Phase 1 did not state: **the production client still speaks cursor.**

```
$ command grep -n "cursor" src/hooks/useEvents.ts | head -3
  4: * Custom hook for fetching and managing events with cursor-based pagination
 68:  if (cursor) {
 69:    params.set("cursor", cursor);

$ command grep -c "nextCursor\|prevCursor" src/app/api/events/route.ts
0
```

`src/hooks/useEvents.ts` sends a `cursor=` query parameter and reads `nextCursor` / `prevCursor`
off the response. `src/app/api/events/route.ts` reads neither and returns neither — it returns
`page`, `limit` and `totalPages`. So the skipped suite is not obviously obsolete: it may be the
only surviving description of a contract the client is still written against.

That strengthens the case for deciding rather than fixing. It does **not** license repairing it
here. Reconciling a client/server contract is a behaviour change, and Phase 2 preserves
behaviour; see § 4.

### 2.3 Why not revive it against current behaviour

Phase 1 recorded the rule this batch is obeying: *`expected_status` records what a route
**should** return, never what it returns today — the divergence between the contract and current
behaviour is the finding, and recording broken behaviour as the contract would launder a defect
into a specification* (threat T-01-11-04). Rewriting these four tests to assert `page` / `limit`
would do exactly that, and would do it silently, because the rewritten suite would be green.

### 2.4 Why STAB-08 is still satisfiable without it

STAB-08 requires Jest to be the single runner and the **installable** skips to be cleared. It
does not name this suite. Four of the five skips were installable and all four are cleared; the
fifth was never an install problem.

### 2.5 Why not delete it

Deleting it would remove the only written statement of the cursor contract from the repository
at the moment we discovered the client still depends on one. The self-documenting `describe.skip`
title — *"tests written for cursor-based route that no longer exists"* — is left intact so the
suite explains itself to whoever opens it next.

---

## 3. Hand-off to REFAC-10 (Phase 4, event read path slice)

REFAC-10 owns `src/app/api/events/route.ts`. It has to decide, in this order:

1. **Which side is authoritative.** Did cursor pagination regress out of the route, or is the
   route correct and the hook plus this suite both obsolete? § 2.2 makes this a live question
   rather than a historical one — answer it against product intent, not against whichever file
   currently compiles.
2. **What the client does.** `src/hooks/useEvents.ts` sends `cursor=` and consumes
   `nextCursor` / `prevCursor` today. Whatever the route ends up returning, that hook and its
   now-executing 20-test suite have to move with it — those 20 tests assert cursor semantics
   against a mocked `fetch`, so they pass regardless of what the real route does. **They will not
   catch this divergence.** That is itself worth knowing.
3. **The fate of this suite.** Rewrite it against the decided contract, or delete it and file the
   loss of coverage explicitly. Its live sibling `src/__tests__/api/events/get-events.test.ts` is
   the analog to follow for the mock and structure.

Until REFAC-10 runs, the suite stays skipped and this file is the reason.

---

## 4. The `tsconfig.json` test-file exclusion was deliberately NOT removed

**F-066 is partially closed by Phase 2, not closed.** The installable skips are cleared; the
whole-program type-check hole remains, on purpose.

`tsconfig.json` still excludes `**/*.test.ts` and `**/*.test.tsx`. Removing those two entries
today produces **68 errors across 6 files** — measured on this tree after batch 5, via a throwaway
config that extends `tsconfig.json` with the two test globs dropped from `exclude`:

| Code | Count | Nature |
|---|---|---|
| TS2451 Cannot redeclare block-scoped variable | 26 | cross-file collision — the API test files share a global scope |
| TS2352 unsafe conversion | 15 | `NextRequest` handler cast to a `Request` handler |
| TS2554 wrong argument count | 14 | route handlers now take 2 args |
| TS2393 duplicate function implementation | 12 | the same cross-file collision |
| TS2353 unknown property in object literal | 1 | a genuine fixture drift in `date-validation.test.ts` |

All 68 sit in six files under `src/__tests__/api/`: `rsvp` (18), `reviews` (17), `events/analytics`
(9), `clubs/analytics` (9), `get-events` (8), `date-validation` (7). **None is in a suite this
batch touched, and none is in the fifth suite.**

For the record, batch 5 moved this number: Phase 2's research measured **86 errors across 10
files** before the install. The 14 `TS2339` diagnostics on `toBeInTheDocument` / `toHaveClass`
disappeared when `@testing-library/jest-dom` and `jest.setup.ts` landed, and 4 of the 5 genuine
fixture drifts were repaired by task 2. **86 → 68.**

Why it stays out of scope:

- The requirement text for STAB-08 does not mention `tsconfig`, and the remaining work is not
  test-harness work. 38 of the 68 are cross-file scope collisions fixed by adding `export {}` to
  the colliding files — mechanical, but unrelated to running tests.
- The 29 `TS2352` + `TS2554` errors are the dangerous ones. They are route-handler casts, and the
  obvious-looking fix is to widen the handler signatures under `src/app/api/**`. **That is a
  behaviour change disguised as a type fix, inside the phase whose entire purpose is behaviour
  preservation.** Leaving the exclusion in place removes the temptation rather than relying on
  restraint.
- `ts-jest` compiles each file in isolation, which is why all 22 executing suites pass today
  despite those whole-program errors. Nothing is being hidden from the test run.

**Natural home: Phase 3**, alongside REFAC-04's generated types and the type-drift CI step.
**Plan 02-11 must quote this section** and record F-066 as *partially closed — skips cleared,
type-check hole remaining*, never as closed.

---

## 5. STAB-13 position after this batch

| Measure | AUDIT-13 baseline | After batch 5 |
|---|---|---|
| Passing tests | 220 | **278** |
| Skipped tests | 36 | **5** |
| Executing suites | 16 of 21 | **22 of 23** |

Both numbers moved in the right direction, and both are quoted on purpose. "Tests pass" was
already true of a tree in which five suites never ran; that is precisely why the requirement
names two numbers. The residual 5 skipped tests are the 4 in the fifth suite plus the single
`it.skip` at `src/__tests__/api/events/get-events.test.ts:420`.

The machine-readable form of these six numbers lives in the provenance block of
`evidence/batch-05-jest.txt` as `stab13_*` `key=value` lines.

---

*Phase: 02-dependency-and-runtime-stabilization*
*Plan: 02-08*
