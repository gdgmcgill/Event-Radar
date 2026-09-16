# Deferred Items — Phase 03

**Phase:** 03-refactor-foundations-schema-truth-and-the-seam-kit · **Opened:** 2026-09-15 by plan 03-06

Out-of-scope discoveries made while executing a plan. Each was found by a gate, recorded here, and
deliberately **not** fixed in the plan that found it. The scope rule this file enforces: a plan
fixes what its own change broke, and nothing else.

Numbering continues from Phase 2's `deferred-items.md`, which ended at D-18.

> **Two `D-` sequences exist and they collide.** This file's ids continue the *deferred-item*
> sequence; `STATE.md` and the plan summaries carry a separate *decision* sequence that has reached
> D-22. So `D-19` here is the ratchet false positive, while `D-19` in `STATE.md` is plan 03-05's
> stronger `WITH CHECK` clauses — and `D-20` here is a flaky test while `D-20` there is the
> automated pgTAP mutation check. Always cite the register along with the id. Disambiguating the
> two sequences is on plan 03-08.

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

**Recurrence, 2026-09-15 (plan 03-06 completion run).** Seen a second time, on the first full-suite
run of the session that wrote `03-06-SUMMARY.md`: `342 passed, 1 failed`, same test, same
`waitFor` on `loading`. Then green on two isolated runs of `src/hooks/useEvents.test.ts` (20/20
each) and green on the immediately following full run (`343 passed, 5 skipped`). Two independent
sightings across two sessions make this a real intermittent rather than a one-off, which is the
threshold at which it stops being worth ignoring — a phase that asserts its floor as an exact
number cannot afford a test that fails one run in eight for reasons unrelated to the change under
test. Reassigned from unassigned to **plan 03-08**.

---

## D-21 — The Content-Security-Policy has no local-development entry, so the browser client cannot reach the local stack

**Found by:** plan 03-07, the persona harness, on the first run of the cookie-equivalence spec.

**The measurement.** `next.config.js:41-52` sets, unconditionally and for every path:

```
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://raw.githubusercontent.com
```

The local Supabase stack is `http://127.0.0.1:54321`, which that list does not admit. Every
client-side Supabase call is therefore refused by the browser **before it leaves**:

```
Connecting to 'http://127.0.0.1:54321/auth/v1/token?grant_type=password' violates the following
Content Security Policy directive: "connect-src 'self' https://*.supabase.co …"
Fetch API cannot load http://127.0.0.1:54321/auth/v1/token?grant_type=password.
```

In the UI this surfaces as a bare **"Failed to fetch"** on `/admin-login`, with no mention of CSP.

**Why it is not an application bug.** The header is correct for production, where the app really
does talk to `https://<ref>.supabase.co`. What it lacks is a development branch.

**What it means beyond the harness.** This is not only a test-environment inconvenience. Any
developer running the app against a local Supabase stack has a **broken client-side sign-in and a
broken client-side query path**, and the only symptom is "Failed to fetch". The server side is
unaffected — the proxy and the route handlers talk to the stack from Node, where no CSP applies —
which is what makes the symptom so misleading: the session cookie works, the pages render, and
only the browser's own calls fail.

**How plan 03-07 worked around it.** Playwright's `bypassCSP: true`, set in the project `use` block
and in the setup project's hand-built contexts. That is a harness setting, not an application
change. **The cost is stated rather than hidden: the harness does not exercise the CSP.** Nothing
in `e2e/` would notice if that header were weakened or removed.

**Why not fixed here.** Editing `next.config.js` is an application source change, which plan 03-07
prohibits by name ("no application source change of any kind"), and a header change is a behaviour
change in the phase whose core value is behaviour preservation. It also wants a decision — whether
to branch on `NODE_ENV`, on an explicit flag, or to derive the allow-list from
`NEXT_PUBLIC_SUPABASE_URL` — and decisions of that shape belong in a plan that owns the file.

**Recommended fix.** Derive the `connect-src` entry from `NEXT_PUBLIC_SUPABASE_URL`'s origin rather
than hard-coding a wildcard, so the policy is correct in every environment by construction and the
production value is unchanged. Then drop `bypassCSP` from the harness and let the specs exercise
the real header.

**Owner:** unassigned, recommended for the Stage 3 slice that owns headers and routing. Raise it at
phase planning; it blocks nothing today.
