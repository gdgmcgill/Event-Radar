# Deferred Items — Phase 03

**Phase:** 03-refactor-foundations-schema-truth-and-the-seam-kit · **Opened:** 2026-09-15 by plan 03-06

Out-of-scope discoveries made while executing a plan. Each was found by a gate, recorded here, and
deliberately **not** fixed in the plan that found it. The scope rule this file enforces: a plan
fixes what its own change broke, and nothing else.

Numbering continues from Phase 2's `deferred-items.md`, which ended at D-18.

---

## D-19 — The elevated-callsite ratchet has a pre-existing false positive

**Found by:** plan 03-06, `node scripts/check-elevated-ratchet.mjs`
**State at discovery:** `committed=24 live=25 delta=1`, exit 1 — and exit 1 at `HEAD` (`d3f6916`)
before plan 03-06 made its first edit. This is not something plan 03-06 caused.

**The extra entry:** `src/app/auth/callback/route.test.ts`.

**Why it is there.** The ratchet's census is `text.includes(marker)` over every file under
`src/app/`, with the markers `supabase/service` and `@supabase/supabase-js`. That test file
contains both strings — inside `jest.mock()` **calls**:

```ts
jest.mock("@supabase/supabase-js", () => ({ … }));
jest.mock("@/lib/supabase/service", () => ({ … }));
```

Those are function arguments, not `import` statements. The ESLint rule the ratchet exists to
support, core `no-restricted-imports`, only sees import and re-export declarations, so it does
**not** flag the file — which is why `npm run lint` is green at 0 errors while the ratchet is red.
The two controls disagree about what counts as a callsite.

**How it got in.** Commit order tells the story: `2bd955c` (plan 03-02) added the test file;
`f3322bc` and `444744b` (plan 03-03) shipped the rule and the generated 24-entry allow-list; then
`bbbe4d6` merged the executor worktree. Plan 03-03 took its census in a tree that did not yet
contain 03-02's test file. A parallel-wave artifact, not a regression.

**Why plan 03-06 did not fix it.** Two reasons. The script's own instruction is explicit —
*"The allow-list may only shrink, so do NOT regenerate it to make this pass"* — so the
one-command fix is the forbidden one. And the correct fix, teaching the census to skip `*.test.ts`
/ `*.test.tsx` so it agrees with the rule it ratchets, is a behaviour change to a control that plan
03-03 owns, landing inside a plan about generated types and casts. Plan 03-06 made no file under
`src/app/**` reach the service-role client and its live census is 25 before and after, so the
zero-routes constraint it had to re-assert is intact.

**No security consequence.** Nothing new reaches the RLS-bypassing credential. The failure is a
census that over-counts by one test file, which is the *safe* direction for a ratchet to be wrong
in — it cannot hide a real new callsite, only add noise.

**Recommended fix.** In `scripts/check-elevated-ratchet.mjs`'s `liveCensus()`, skip files matching
`/\.test\.tsx?$/` before applying the markers, and record the reason in the script's header so the
next reader does not "fix" it back. Keep the committed allow-list at 24 — it does not change.
Optionally tighten the markers from substring matching to an import-statement pattern, which would
make the census read the same thing ESLint reads.

**Owner:** plan 03-08, alongside the other written dispositions it carries. The ratchet is not
wired into CI yet, so nothing is blocked in the meantime.

---

## D-20 — `src/hooks/useEvents.test.ts` is intermittently flaky

**Found by:** plan 03-06, `npm test -- --ci`
**Symptom:** `useEvents Hook › Initial Fetch › should fetch events on mount` failed once with
`expect(result.current.loading).toBe(false)` receiving `true` inside a `waitFor`. Re-run three
times in isolation and four times as part of the full suite: **green every time**, 332 passed /
5 skipped.

**Why it is recorded rather than ignored.** A one-in-eight flake in a timing-sensitive `waitFor` is
cheap to dismiss and expensive to chase later, and this phase's floor is asserted as an exact
number. A reader who sees `331 passed, 1 failed` in a future transcript should be able to find out
whether it is this or something new.

**Why not fixed here.** It is in neither this plan's files nor its subject matter, and the failure
is in the test's synchronisation, not in `useEvents`. Chasing it would mean editing a hook test
inside a plan about generated types.

**Recommended fix.** Give the assertion an explicit `waitFor` timeout, or await the mocked fetch
resolution directly instead of polling `loading`.

**Owner:** unassigned. Raise it if it recurs; it is not blocking.
