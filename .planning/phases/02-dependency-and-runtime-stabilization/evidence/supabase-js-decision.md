# Supabase SDK minor (batch 4b) — shipped-or-deferred decision

**Plan:** 02-07 · **Phase:** 02-dependency-and-runtime-stabilization · **Recorded:** 2026-09-15

> **Decision: DEFER the `@supabase/supabase-js` bump to Phase 3.** The bump was applied,
> reconciled, installed and gated. It failed the second gate command outright: `npx tsc
> --noEmit` exited 2 with six `TS2345` errors across six data-mutation API routes. Every one
> of them is silenceable only by a cast or by widening an update payload's type — which is
> the exact warning sign the plan named in advance as disqualifying. The sub-commit was
> reverted. `package.json` and `package-lock.json` are byte-identical to the batch-4a commit.

---

## 1. Versions

| | Declared range | Resolved in lockfile |
|---|---|---|
| Before (and now, after the revert) | `^2.49.0` | **2.81.1** |
| Attempted | `^2.116.0` | **2.116.0** |
| Registry `latest` at decision time | — | 2.116.0 |

`2.81.1 → 2.116.0` is **35 minors**. That figure is the whole reason this sub-commit existed;
see § 3.

`@supabase/ssr` was **not touched** and remains `^0.7.0`. Its 0.7 → 0.12 move is a major and
is out of scope for Phase 2 (`02-RESEARCH.md` § majors explicitly excluded).

## 2. This bump is not security-driven

It closes **no advisory**. The production census before it
(`evidence/audit.b4a.after.json`) carries 0 critical and 1 high, and the surviving high is
`postcss` reached through `redoc → styled-components`, nothing in the Supabase subtree. The
`ws` high that *was* in the Supabase subtree (`@supabase/realtime-js → ws`) was already closed
in batch 4a by an in-range lift to 8.21.3.

Deferring therefore costs **nothing at the phase exit gate**. That asymmetry is what makes the
defer rule a real option rather than a face-saving escape hatch: there is no advisory count
that gets worse by waiting.

## 3. Why it was attempted at all, and why that reason is weak

Carrying 35 minors of drift into Stage 3's refactor would mean every unexplained behaviour
change during the refactor has two candidate causes instead of one — the refactor, or the
SDK. Eliminating one of those causes ahead of time is a genuine benefit.

It is also a weak one. It buys clarity during a future phase; it buys nothing today. Weighed
against shipping an un-type-checkable data-layer change into the phase whose entire purpose is
provable behaviour preservation, it loses.

## 4. Gate results, item by item

| # | Gate command | Result |
|---|---|---|
| 1 | `npm install --package-lock-only` | exit 0. Lockfile diff **contained and reviewable**: 128 changed lines, 984 → 983 entries, 3 removed (`ws`, `@types/ws`, `@types/phoenix`), 2 added (`@supabase/phoenix`, `iceberg-js` — both `github.com/supabase`, provenance-checked), 6 version-changed and all 6 inside `@supabase/*`. `lockfileVersion` 3 unchanged. |
| 2 | `npm ci` | exit 0 |
| 3 | `npm run lint` | exit 0 — 0 errors, 19 warnings, rule-for-rule identical to batch 4a |
| 4 | **`npx tsc --noEmit`** | **exit 2 — six `TS2345` errors. GATE FAILED.** |
| 5 | `npm test -- --ci` | **not reached** |
| 6 | `npm run build` | **not reached** |
| 7 | `scripts/smoke.sh` | **not reached** |

Gates 5–7 were not run and that is deliberate, not an omission. A tree that does not
type-check is not a tree whose runtime behaviour is worth measuring; running the data rows
against it would produce numbers that could later be mistaken for evidence the bump was safe.

**Which smoke rows would have exercised real data, for whoever picks this up in Phase 3:**
row 2 (`GET /api/events?limit=5`, asserts 200 and ≥ 1 event) and row 9 (`GET /api/health`) are
the two that touch Supabase through the client factories. Row 2 already fails on this local
tree against an empty dataset — identically to `smoke.b0.txt`, captured before any dependency
changed — so **row 2 cannot distinguish an SDK regression from an empty database here.** Phase
3's deterministic seed is what makes that row a usable instrument. That limitation is a second,
independent reason this bump should not have been certified in Phase 2.

## 5. The specific ambiguity — stated precisely, because the defer rule requires it

`@supabase/postgrest-js` 2.116.0 wraps `.update()` / `.insert()` payload parameters in a new
`RejectExcessProperties<Row, T>` conditional type. Any argument typed as an open index
signature — `Record<string, unknown>` or `Record<string, string | null>` — collapses that
conditional to `{ [x: string]: never }` and fails to assign. Six call sites:

```text
src/app/api/admin/events/[id]/edits/route.ts(67,15)    TS2345  Record<string, unknown>
src/app/api/admin/events/[id]/route.ts(41,13)          TS2345  Record<string, unknown>
src/app/api/admin/experiments/[id]/route.ts(103,13)    TS2345  Record<string, unknown>
src/app/api/admin/users/[id]/route.ts(33,13)           TS2345  Record<string, unknown>
src/app/api/clubs/[id]/route.ts(129,15)                TS2345  Record<string, string | null>
src/app/api/events/[id]/route.ts(318,15)               TS2345  Record<string, unknown>
```

Every one is a **write path**: admin event edit, admin event update, experiment update, admin
user update (the ban/role surface), club update, event update. The two ways to silence them
are a cast (`as never`, `as Database["public"]["Tables"][...]["Update"]`) or restructuring the
payload builders to emit closed object literals. The first hides whatever the new type is
actually objecting to; the second is a refactor of six mutation handlers, which is Stage 3
work under an explicit slice, not a line item inside a dependency batch.

**No source file was edited.** `git diff --name-only -- src/` is empty, and stayed empty for
the whole attempt.

## 6. What Phase 3 needs in order to resolve it

1. The deterministic seed (REFAC-05), so smoke row 2 can tell an SDK regression from an empty
   database.
2. The characterization harness over the six mutation routes listed in § 5, so the payload
   restructuring is provably behaviour-preserving rather than merely type-clean.
3. Then the bump, with the payload builders emitting typed object literals — **not casts.**

## 7. Residual risk

**No changelog was read across the 35-minor span between 2.81.1 and 2.116.0.** Not one release
note, migration guide, or diff was reviewed; the entire confidence basis for this attempt was
the gate, and the gate is what stopped it. Two consequences follow, and both are risks that
carry forward rather than being retired by the deferral:

- **The six type errors may not be the only behaviour change in that span — they are only the
  ones the compiler can see.** Runtime changes in retry behaviour, error shapes, auth token
  refresh timing, realtime transport (2.116 drops the `ws` dependency entirely in favour of a
  native WebSocket, which is a runtime transport change the type system says nothing about) or
  PostgREST query serialization would all pass `tsc` silently. Nothing here rules them out.
- **The drift keeps growing.** Every week this is deferred, the span widens and the Stage 3
  "two candidate causes" problem of § 3 gets worse, not better. Deferring is the right call
  today and it is not free; Phase 3 should treat this as scheduled work, not as a backlog item.

The tree as committed continues to resolve **2.81.1**, which is itself 35 minors behind
`latest` and was never explicitly chosen — it is whatever `^2.49.0` happened to resolve to at
the last install. That, too, is unreviewed.

---

*Phase: 02-dependency-and-runtime-stabilization*
*Plan: 02-07*
