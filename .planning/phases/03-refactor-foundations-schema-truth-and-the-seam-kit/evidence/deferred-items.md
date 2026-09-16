# Deferred Items — Phase 03, consolidated

**Plan:** 03-08 · **Phase:** 03-refactor-foundations-schema-truth-and-the-seam-kit · **Recorded:** 2026-09-16

This is the **consolidated, authoritative** deferred-item register for Phase 3. It carries every
deferral the phase produced across plans 03-01 through 03-08, every item on the phase-state carried
list, and the five Phase 2 carry-forwards that were still open when Phase 3 began — each with what
was found, by which plan, why it was not fixed there, why it is not merely cosmetic, and **the phase
that owns it**.

Deferring silently is forbidden by this plan. There is no item below without an owner.

---

## The two `D-` sequences, disambiguated — read this before citing any id

Phase 3 accumulated **two independent `D-` sequences that collide**, and plan 03-06 registered the
collision as a hazard for this plan to resolve. It is resolved here by prefix:

| Prefix | Register | Where it lives | Example |
|---|---|---|---|
| **`DI-`** | **Deferred items** — this file. Continues the sequence Phase 2's `deferred-items.md` ended at (D-18). | `.planning/phases/*/evidence/deferred-items.md` | `DI-19` = the elevated-callsite ratchet false positive |
| **`DEC-`** | **Decisions** — design calls taken during execution. | `.planning/STATE.md` § Decisions, and each `03-0N-SUMMARY.md` | `DEC-19` = plan 03-05's stronger `WITH CHECK` clauses |

Before this file, both were written `D-`. So `D-19` meant *two different things* depending on which
document you were holding, and so did `D-20`:

| Bare id | As a **deferred item** (`DI-`) | As a **decision** (`DEC-`) |
|---|---|---|
| `D-19` | The ratchet false positive | Plan 03-05's stronger `WITH CHECK` clauses |
| `D-20` | The flaky `useEvents` hook test | The automated pgTAP mutation check |
| `D-21` | The CSP with no local-development entry | No pgTAP test writes into the `auth` schema |
| `D-22` | The `/moderation` deep-link ignored | The user decision accepting REFAC-04's cast clause at 45 of 47 |

**Mapping to the earlier file.** `DI-19` through `DI-22` are the same four items previously numbered
`D-19` through `D-22` in
`.planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/deferred-items.md`, which
this file consolidates. That file is left in place unmodified because five committed notes cite it by
its original ids; it carries a pointer to this one. **Cite `DI-` ids from here onward.**

**Prior-art citations are not rewritten.** `evidence/harness-note.md`, `evidence/type-fixes-note.md`
and the plan summaries say `D-21`, `D-19` and so on. Those are correct as written against the
register they were citing; the table above is how a later reader resolves them.

---

# Part 1 — Items this phase found and deferred

## DI-19 — The elevated-callsite ratchet had a pre-existing false positive — **CLOSED by plan 03-08**

**Found by:** plan 03-06, `node scripts/check-elevated-ratchet.mjs`
**State at discovery:** `committed=24 live=25 delta=1`, exit 1 — and exit 1 at `d3f6916`, before plan
03-06's first edit. Not something 03-06 caused.

**What it was.** `src/app/auth/callback/route.test.ts` (added by plan 03-02, in a worktree branched
before plan 03-03 took its census) contains the strings `@supabase/supabase-js` and
`@/lib/supabase/service` inside `jest.mock()` **calls** — function arguments, not import specifiers.
ESLint's core `no-restricted-imports`, the rule the ratchet exists to support, inspects
`ImportDeclaration` and `ExportNamedDeclaration` nodes only and correctly ignored the file. The
ratchet's `text.includes()` census could not tell the two apart. Two controls disagreeing about what
counts as a callsite is the defect.

**Why plan 03-06 did not fix it.** The one-command fix — regenerating the allow-list — is the one the
script's own header forbids, and the correct fix is a behaviour change to a control plan 03-03 owns,
landing inside a plan about generated types.

**How it closed.** Plan 03-08 applied the census-only fix: a `TEST_FILE` predicate in `liveCensus()`
that skips `*.test.*` files before the markers are applied, with a header block explaining why so the
next reader does not "fix" it back. Proof in `evidence/ratchet-d19-fix.txt`:

| Step | Result |
|---|---|
| RED, before | `committed=24 live=25 delta=1`, exit 1, naming `src/app/auth/callback/route.test.ts` |
| GREEN, after | `committed=24 live=24 delta=0`, exit 0 |
| Allow-list `sha256` | `3df51af2…` **before and after — byte-identical.** It was not regenerated |
| Regeneration still byte-identical | `--write` into a copy, then `diff` → zero bytes of output, same `sha256` |
| **The ratchet still bites** | a non-test fixture importing `@/lib/supabase/service` under `src/app/` → **exit 1**, naming it |
| Negative control | a `jest.mock`-only `.test.ts` fixture → exit 0, correctly ignored |
| Tree restored | `git status --porcelain src/ eslint.elevated-allowlist.mjs` empty |

**No security property was weakened.** A `.test.ts` file is not shipped and cannot reach the
service-role credential at runtime in production — it can only mock it. If a test file ever imports
the service client for real, ESLint's boundary rule catches it, and that is the control that fails a
build.

**Owner:** closed. **Was:** plan 03-08.

---

## DI-20 — `src/hooks/useEvents.test.ts` is intermittently flaky

**Found by:** plan 03-06, `npm test -- --ci`
**Symptom:** `useEvents Hook › Initial Fetch › should fetch events on mount` fails with
`expect(result.current.loading).toBe(false)` receiving `true` inside a `waitFor`.

**Two independent sightings across two sessions** — plan 03-06's first full run (`342 passed, 1
failed`) and again on the run that wrote `03-06-SUMMARY.md` (`331/1`) — with green on every isolated
re-run and on the immediately following full run. Plan 03-07 did **not** see it in four full runs, and
plan 03-08's completion run is green at **348 passed / 5 skipped / 33 of 34 suites**.

**Why it is not merely cosmetic.** This phase asserts its test floor as an exact number. A suite that
fails roughly one run in eight for reasons unrelated to the change under test makes that floor
unreadable, and a reader who meets `347 passed, 1 failed` in a future transcript needs to be able to
tell this from something new.

**Why not fixed in 03-06 or 03-08.** It is in neither plan's files nor subject matter, and the failure
is in the test's synchronisation rather than in `useEvents`. Plan 03-08 changes no test by its own
prohibition.

**Recommended fix.** Give the assertion an explicit `waitFor` timeout, or await the mocked fetch
resolution directly instead of polling `loading`.

**Owner:** **Phase 4** — the first phase to write tests against the seam, and the phase whose
regression net has to be trustworthy before the authorization core moves in Phase 5.

---

## DI-21 — The Content-Security-Policy has no local-development entry, so the browser client cannot reach the local stack

**Found by:** plan 03-07, the persona harness, on the first run of the cookie-equivalence spec.

**The measurement.** `next.config.js:41-52` sets, unconditionally and for every path:

```
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://raw.githubusercontent.com
```

The local stack is `http://127.0.0.1:54321`, which that list does not admit. Every client-side
Supabase call is refused by the browser **before it leaves**, surfacing in the UI as a bare
**"Failed to fetch"** with no mention of CSP.

**Why it is not merely cosmetic, and why it is bigger than a test concern.** Any developer running the
app against a local Supabase stack has a **broken client-side sign-in and a broken client-side query
path** today. The server side is unaffected — the proxy and route handlers talk to the stack from
Node, where no CSP applies — which is what makes the symptom so misleading: the session cookie works,
the pages render, and only the browser's own calls fail.

**How plan 03-07 worked around it, and what that cost.** `playwright.config.ts` sets
`bypassCSP: true`. The cost is stated rather than hidden in `evidence/harness-note.md` § 4c:
**nothing in `e2e/` would notice if that header were weakened or removed.**

**Why not fixed there.** Editing `next.config.js` is an application source change that plan 03-07
prohibits by name, and a header change is a behaviour change in the phase whose core value is
behaviour preservation. It also wants a decision — branch on `NODE_ENV`, on an explicit flag, or
derive the allow-list from `NEXT_PUBLIC_SUPABASE_URL`.

**Recommended fix.** Derive the `connect-src` entry from `NEXT_PUBLIC_SUPABASE_URL`'s origin rather
than hard-coding a wildcard, so the policy is correct in every environment by construction and the
production value is unchanged. Then drop `bypassCSP` and let the specs exercise the real header.

**Owner:** **Phase 6** — Async Edge, Contracts, Caching, Observability, which is the slice that owns
response headers and is already deleting the blanket cache directive from the same layer.

---

## DI-22 — `/moderation` deep-links to `?status=pending`, and the events queue ignores it

**Found by:** plan 03-07, writing `e2e/specs/admin-moderation-queue.spec.ts`.

`src/app/moderation/page.tsx:275` renders the queue link as `href="/moderation/events?status=pending"`
and `src/app/moderation/events/page.tsx:58` opens with `useState("all")`. Nothing reads
`searchParams`. An admin clicking "Pending Review" lands on a queue showing **every** event at all
five statuses, with the `<select>` reading "All Statuses". Confirmed against the seeded data.

**Severity: low.** Nothing is exposed that the admin may not see, and the `<select>` works — it is one
extra interaction and a dashboard link whose intent is silently dropped.

**Why not fixed there.** `src/app/moderation/events/page.tsx` is not in plan 03-07's `files_modified`
and its acceptance criteria assert `git status --porcelain src/` is empty. The fix is a one-line
`useState(searchParams.get("status") ?? "all")` and it belongs to a plan that owns the file.

**What the spec does instead**, and why that was the right call: it drives the control the user
actually has — selects "Pending" from the `<select>` and asserts the queue narrows — rather than
asserting the deep link, which would freeze the current behaviour in a test and make the eventual fix
look like a regression.

**Owner:** **Phase 5** — Auth, Club Authorization, Admin Containment, which owns the moderation
surfaces.

---

## DI-23 — The production migration-history repair is not performed

**Found by:** plan 03-04, and gated to plan 03-08 by decision D-02.
**Decided by:** plan 03-08's blocking checkpoint, resolved to **`defer-to-phase-8`**. Full record in
`evidence/repair-outcome.md`; the decision aid it was taken against is `evidence/repair-preflight.md`.

Production's `supabase_migrations.schema_migrations` holds 45 rows and has **no row** for baseline
version `20260915214553`. The single command that would add one is captured verbatim and unrun:

```
supabase migration repair --status applied 20260915214553 --linked
```

**Why it is not merely cosmetic.** Three live consequences, each measured rather than inferred:

1. **`supabase db push` MUST NOT be run against production** until this is done. A push would try to
   apply the baseline against a database that already contains every object in it — redundant at best
   and destructive at worst (`evidence/reconciliation-note.md` § 4).
2. **Club-invitation acceptance stays broken in production (F-016).** The three `club_invitations`
   policies are written, tested and committed in
   `supabase/migrations/20260915230000_fk_indexes_and_policy_gaps.sql` and **are not deployed**.
3. **The trigram and policy indexes stay absent in production.** `search_events_fuzzy` still computes
   trigram similarity per row, and the anonymous feed's single governing policy predicate
   (`events.status`) is still unindexed. All nine missing objects are enumerated in
   `evidence/db-diff.after-fixes.sql`.

**Under no option are the 45 historical versions marked `reverted`** — they are true statements about
what happened, eighteen are the only surviving record of the March 2026 out-of-band burst, and a push
ignores them anyway once the baseline is marked applied.

**Owner:** **Phase 8** — Operational Certification and Sign-Off, which examines the deploy path anyway
and is the only place the repair's sufficiency can be verified by an actual deploy rather than
assumed (03-RESEARCH.md § Assumptions Log **A2**, rated Medium).

---

## DI-24 — The tsconfig test-file exclusion, so the type-coverage hole stays open (F-066)

**Found by:** Phase 2, plan 02-11, and named **this phase** as its natural home. Re-measured and
re-deferred by plan 03-06 (`evidence/type-fixes-note.md` § 3.2).

`tsconfig.json` still excludes `**/*.test.ts` and `**/*.test.tsx` from the main program, so test files
are linted and run by `ts-jest` but never type-checked by `tsc --noEmit`.

**Measured cost: roughly 86 errors across 10 files**, almost all mechanical.

**Why not fixed in Phase 3.** 86 mechanical edits landing in the same commits as a regenerated
`src/lib/supabase/types.ts` would make the regeneration diff — the thing plan 03-06 asks a reviewer to
certify line by line — unreviewable. Task 1's six-hunk accounting only means something if the reviewer
can see all six.

**Why it is not merely cosmetic.** This exclusion is what made `F-050`'s excess-property error
invisible in the first place. A type system that is not looking at the tests is not looking at the
place where a fixture's shape drifts from the schema's.

**The other half of F-066.** Its first clause is "zero skipped suites", and one suite is still skipped
— `src/app/api/events/route.test.ts`, the contract-drift suite, which no install revives because it
asserts a cursor-pagination contract the handler has no cursor concept for. Reviving it against the
handler's current behaviour would freeze a possible defect as the specification
(`.../02-.../evidence/skipped-suite-disposition.md`).

**Owner:** **Phase 4**, for both clauses. The pagination contract is `REFAC-10`, the event read path
slice, and the tsconfig change is the natural companion to it. `F-066`'s `closes_in_phase` is moved
`03` → `04` by plan 03-08 for that reason.

---

## DI-25 — The `@supabase/supabase-js` minor and the `@supabase/ssr` major stay deferred

**Found by:** Phase 2, plan 02-07; deferred at `.../02-.../evidence/supabase-js-decision.md`.
**Partly retired by:** plan 03-06 — but the *question*, not the change.

The 2.81.1 → 2.116.0 minor (35 minors) was applied, reconciled, installed and gated in Phase 2, and
**failed the gate outright**: `npx tsc --noEmit` exited 2 with six `TS2345` errors across six
data-mutation API routes, every one silenceable only by a cast or by widening an update payload's
type. The sub-commit was reverted. **The bump closes no advisory**, so nothing security-relevant is
deferred.

**What Phase 3 retired.** Plan 03-06's fix #9 narrows `logAdminAction`'s `metadata` from
`Record<string, unknown>` to the generated `Json` type. **Five of the six blocking errors share
exactly that shape**, so the project now has a worked example of the correct resolution and one of the
six sites is fixed outright. The SDK version is where Phase 2 left it.

**Also outstanding and never in Phase 2's scope:** `@supabase/ssr` 0.7 → 0.12, a **major**.

**Why not done in Phase 3.** The six sites are data-mutation routes, and this phase's characterize-first
rule (L2) forbids changing a mutation route's behaviour before it has a characterization test. Those
tests are the next phase's work, not this one's.

**Owner:** **Phase 4** for the minor — the slice that characterizes the saved-events and RSVP mutation
paths is the first phase that can fix those call sites honestly. The `@supabase/ssr` major should be
re-scoped at Phase 4 planning rather than assumed to ride along.

---

## DI-26 — The blanket shared-cache directive is **still open at its original severity**

**Found by:** Phase 1 (`F-025`, `F-026`, `F-027`, `F-028`), carried forward by Phase 2 plan 02-11, and
**not touched by Phase 3.**

This item is recorded explicitly because Phase 2's own completion note warned that silence about it
would be read as closure.

> **`F-025` remains `Open` at `Critical`.** Phase 2 closed the `next` cache-poisoning **advisories**
> by version. It did not touch the **precondition** those advisories need, and Phase 1 proved that
> precondition is live on this deployment by measurement rather than inference: eight personalized
> routes returned `x-vercel-cache` HIT or STALE with non-zero age under the blanket `s-maxage=60`
> directive, and **not one response in the entire run varied on `Cookie` or `Authorization`** — every
> `vary` read `accept-encoding` and nothing else. A cache entry is keyed by URL alone.

**A closed advisory is not a removed precondition.** Nothing in Phase 3 changed `vercel.json`, and
nothing in Phase 3 was expected to.

Three sibling findings carry a `closes_in_phase` disagreement Phase 2 deliberately left alone:
`F-026` (thirty-seven auth-gated routes including all fifteen admin handlers under the blanket
directive), `F-027` (`/api/auth-debug` echoes the caller's own id and email with no gate) and `F-028`
(eight personalized routes answer anonymous callers with 200 and a degraded body). All three still
read `05` while `F-025` reads `06`. **Plan 03-08 deliberately left them alone too** — `F-027` in
particular is an authorization defect that the cache rule makes worse, so `05` may well be correct for
it, and deciding is a judgment for whoever plans Phase 5, not a bookkeeping edit for a close-out plan.

**Owner:** **Phase 6** (`REFAC-19`) for `F-025` and the deletion of the blanket rule. **Whoever plans
Phase 5** for the three `closes_in_phase` reads — one per finding.

---

## DI-27 — The five signed-in Tier 3 manual acceptance steps

**Found by:** Phase 2, plan 02-06; recorded at `.../02-.../evidence/STAGE-2-COMPLETION.md` § 13 row
`STAB-06` and as `02-UAT.md` test 1. **Re-confirmed still open** by plan 03-02
(`evidence/callback-characterization-note.md` § 4.3) and plan 03-07
(`evidence/harness-note.md` § 4b).

The five: real McGill sign-in, non-McGill rejection, mid-onboarding redirect, non-banned user,
save/RSVP.

**They remain manual, and Phase 3 did not discharge them.** They need a real McGill Google account,
which no automation in this repository can supply. The persona harness deliberately does not attempt
to fake one — the whole point of the cookie shim is that it signs in *seeded local personas*, not real
people through a real identity provider, and **no persona ever traverses `/auth/callback`**.

**What Phase 3 did contribute, so the overlap is not overstated.** Plan 03-02's unit characterization
pins the *handler's* response to a non-McGill address with every collaborator mocked. It says nothing
about whether Azure returns the address in the shape the handler expects, whether the real
`auth.admin.deleteUser` succeeds against a real orphaned row, or whether the session cookies Supabase
chunks across several `Set-Cookie` headers survive the accumulator at `route.ts:56-80` — which is
deliberately **not** characterized, because the `createServerClient` mock never invokes the cookies
adapter.

**Owner:** the **phase owner** for the manual run (`02-UAT.md` test 1); **`CERT-05`, Phase 7** for the
per-persona assertions that can be automated against the seed.

---

## DI-28 — The `.claude/CLAUDE.md` correction is gitignored, so a fresh clone does not carry it

**Found by:** Phase 2, plan 02-11, self-disclosed at `.../02-.../evidence/STAGE-2-COMPLETION.md` § 12.
**Assigned to Phase 3. Phase 3 did not resolve it, and says so here rather than letting it lapse.**

`.claude/CLAUDE.md` — the agent-facing instruction file — was corrected on disk by plan 02-11 (Vitest
→ the real two-project Jest harness, Node 20 → 24, the removed swagger and Radix packages delisted,
the "no test step in CI" claim replaced). **It is not in git history:** `.claude/` is gitignored at
`.gitignore:43` and the file has never been tracked.

**Why it was not force-added, in Phase 2 or in Phase 3.** Overriding a deliberate `.gitignore` is a
project-governance call belonging to the repository's owner, not to an executor. Plan 03-08 holds the
same line for the same reason.

**Why it is not merely cosmetic.** The correction is live for every agent that reads the file on this
machine and **absent from any commit**, so a fresh clone — or any other contributor's machine — gets
the uncorrected version. That is a real gap in `F-063`'s closure, and it has now been carried across
two phases without being decided.

**Additionally, and still unfixed:** `.claude/CLAUDE.md` § Key Dependencies claims `zustand` has "no
stores directory found; may be used inline". `src/store/useAuthStore.ts` exists and is the single
source of truth for auth state. The parenthetical is false and was false at the Phase 1 baseline.

**Owner:** the **phase owner**. It is a one-line decision — track the file, or accept that it is
machine-local — and it needs a human to take it.

---

## DI-29 — REFAC-07's staging clause: there is no staging Supabase project

**Found by:** Phase 1 (the environment capture), re-confirmed by plan 03-07
(`evidence/harness-note.md` § 3).

REFAC-07 requires the seed be "loadable into local **and staging** only". Everything except the word
"staging" is met and evidenced. The staging clause cannot be discharged because **no staging project
exists to load into** — `.planning/audit/schema/staging.schema.sql` and
`.planning/audit/schema/migration-list.staging.txt` are deferred stubs, and an absent staging
environment is itself a Phase 1 audit finding.

**What exists instead.** `scripts/seed/guard.ts` **implements** the staging branch, guards it behind
two independent signals (`SEED_STAGING_PROJECT_REF` naming the ref, `SEED_I_UNDERSTAND_TARGET=staging`
acknowledging it), and **unit-tests its refusals** — a named staging ref without the acknowledgement
throws, and so does a staging target the guard cannot check against production, even with both signals
set. Refusals watched refusing in `evidence/seed-guard-refusals.txt`.

**What was deliberately NOT done:** the guard was not widened to make an untestable path look tested.
Enabling it, the day a staging project exists, is exporting two variables. Nothing in the code needs
editing.

**Owner:** the **phase owner** for provisioning the project; **`CERT-01`, Phase 7** for the load, since
that is the requirement that grows this seed into the full certification dataset.

---

## DI-30 — REFAC-04's cast clause stands at 45 of 47, on two registered defects

**Found by:** plan 03-06. **Decided by** the phase owner (Adyan Ullah, 2026-09-15) as decision
`DEC-22`, recorded in `03-06-SUMMARY.md` and `evidence/type-fixes-note.md` § 1.1.

Two `(supabase as any)` casts survive, one per defect site, and nowhere else. At both sites the cast is
the only thing making the file compile, so a zero cast count and a clean `tsc --noEmit` are
**incompatible on this tree** — every route to the zero runs through a behaviour change, which the
phase's characterize-first rule (L2) and the plan's own prohibition forbid.

| Site | Finding | What it actually is |
|---|---|---|
| `src/app/api/events/[id]/friends/route.ts:38` | **F-071** (Medium, Phase 4) | A `PostgrestFilterBuilder` is passed where `readonly (string \| null)[]` is required. `in()` runs `Array.from(new Set(values))` and a builder is not iterable, so the call throws and the handler's outer catch answers **200 with an empty list**. |
| `src/app/moderation/page.tsx:67` | **F-072** (Medium, Phase 5) read / **F-073** (High, Phase 5) write | `admin_audit_log.admin_email` **does not exist in the live schema**. The Recent Activity panel has always rendered "No recent activity yet", and **every moderation action's audit row has always been rejected** with `PGRST204` and silently discarded, because `logAdminAction` never reads its result and all fourteen callsites catch only throws. |

**Both retained casts are annotated in source** with their finding id, the mechanism, why they are
still there and which test pins them. A bare `(supabase as any)` is a hiding place; one that names a
registered finding and a characterization test is a tripwire.

**F-073 is the one to carry loudest.** `admin_audit_log` is the platform's only accountability record
for every moderation action ever taken, and it has never recorded one. This is the mechanism behind
`F-007`'s observation that the table holds zero rows in production despite moderation having happened.
**Nothing in Phase 3 changes it.**

**Owner:** **Phase 4** for `F-071`; **Phase 5** for `F-072` and `F-073`, where restoring or dropping
the `admin_email` column is a deliberate schema change that must pass through the D-02 production gate.

---

## DI-31 — The `no-restricted-properties` companion rule, and the ratchet's CI wiring

**Found by:** plan 03-03 (`evidence/seam-kit-note.md` §§ 2 and 3).

**Two related gaps in the import boundary, both deliberate.**

**The companion rule.** The boundary is core `no-restricted-imports`, which sees a static import
specifier and nothing else. Two evasions follow: a dynamic `await import("@/lib/supabase/service")`
(no file does this today), and a bare read of `SUPABASE_SERVICE_ROLE_KEY` with no top-level SDK import.
`src/app/api/admin/calculate-popularity/route.ts` already builds a service-role client inline and **is
caught today only incidentally**, by the `@supabase/supabase-js` pattern on line 11, not by anything
that understands line 17. The belt-and-braces `no-restricted-properties` rule was **not shipped**
because, scoped as written, it bans `process.env` outright in the app layer — and **12 legitimate
`NEXT_PUBLIC_*` reads across 5 files under `src/app/**`** would all become errors. Closing the evasion
needs a rule narrow enough to name the service-role key while leaving public configuration alone, and
that design is better made alongside the first real shrink than guessed at against zero migrated
routes.

**The CI wiring.** `scripts/check-elevated-ratchet.mjs` is invoked by path and is in neither
`package.json` nor `.github/workflows/ci.yml`. Plan 03-03 deferred it because three plans in the phase
touched the workflow file and putting two plans in one file is how a merge conflict becomes a silent
loss. **It is still unwired** after plan 03-08's DI-19 fix — which means the fix has made the check
*correct* but has not made it *enforced*.

**Owner:** **Phase 4**, for both, together with the first actual shrink — the moment the check has
something to shrink toward and the replacement's shape is known.

---

## DI-32 — The CI `e2e` job is RED on a real runner; the harness has never been observed outside a laptop

**Found by:** plan 03-08, while reconciling the readiness note's claims against observed runs.
**Full diagnosis and reproduction:** `evidence/ci-e2e-red.txt`.

GitHub Actions run `35049602081` on `7c1ca29` (the 03-07 completion commit):

| Job | Conclusion |
|---|---|
| `ci` — lint, tsc, filename check, tests, audit gate, build | **success** |
| `types` — Schema truth: db reset, type-drift diff, `supabase test db` | **success** |
| `e2e` — Persona harness | **failure**, at the `Run the persona harness` step |

**The mechanism, pinned to lines and reproduced locally.** `.github/workflows/ci.yml:9-11` sets a
**workflow-level** `env:` block exporting `NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co"`,
inherited by every job including `e2e`. `e2e/env.ts:29-32` reads
`process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL`, and `e2e/env.ts:61-65` resolves
`url: fromEnv.url ?? read("API_URL")` — and `??` only falls through on `null`/`undefined`. The
placeholder is truthy, so the real local stack URL from `supabase status -o env` is **never consulted**.
`playwright.config.ts:89` then hands the placeholder to `assertSeedTargetAllowed`, which refuses it.

**The guard is correct.** It is doing exactly what it was built to do. The defect is the job's
environment, not the control that caught it. It passes locally because a developer's shell does not
export `NEXT_PUBLIC_SUPABASE_URL` — `.env.local` is a file, not an export — so the `API_URL` branch is
taken. **That asymmetry is the whole bug**, and it is the reason a green laptop run did not predict a
red runner.

**Why it is not merely cosmetic.** The job never reaches a single spec; it dies loading the config. So
27 passing end-to-end tests have been observed **only on one machine**. The harness is a local-only
control until this is fixed, and the readiness note says so in those words.

**What is NOT affected.** The harness itself — 27/27 from a clean local database
(`evidence/playwright-run.txt`). No spec is wrong. REFAC-06's text says "runnable against local
Supabase", and that clause is met and evidenced.

**Recommended fix**, worked out in full at `evidence/ci-e2e-red.txt` § 6: invert the precedence in
`e2e/env.ts` so the running stack outranks an ambient variable, rather than the reverse. The
alternative — exporting the stack's real values into `$GITHUB_ENV` after `supabase start` — also works
but writes a service-role key (the local throwaway one) into the job environment.

**Why plan 03-08 did not apply it.** Neither `.github/workflows/ci.yml` nor `e2e/env.ts` is in this
plan's `files_modified`, and this plan changes no source by its own prohibition. More to the point: **a
CI fix cannot be verified from this laptop.** It needs a push and an observed run, and an unverified fix
shipped inside the note whose entire standard is "every claim cites a committed artifact" would be the
one kind of change this document must not contain.

**Owner:** **Phase 4** — the first phase to use the harness as a regression net for a real refactor, and
therefore the phase that actually needs it green.

---

## DI-33 — Three storage buckets and three pg_cron jobs exist in production and are governed by no migration

**Found by:** plan 03-04 (`evidence/reconciliation-note.md`, and `03-04-SUMMARY.md` § "What production
still holds that this did not change").

> **A photograph of a door does not lock it.**

| Object | State after Phase 3 |
|---|---|
| 41 previously-undeclared RLS policies | **Now controlled** — captured in the baseline, verified by set difference (live 101, baseline 101, symmetric difference 0). The one item that genuinely moved from uncontrolled to controlled. |
| 3 dashboard-created storage **buckets** | **Not captured.** A `db reset` produces a database with no buckets in it. The baseline carries storage **policies** only — `CREATE TYPE storage.…` is denied to the migration role while `CREATE POLICY … ON storage.objects` is permitted (decision `DEC-16`). |
| 3 pg_cron **jobs** | **Not captured.** `cron.schedule` appears 0 times in the baseline and in 0 of the 45 production history rows. Phase 3 codified **one** of them — `compute_user_scores`, idempotently, per REFAC-03 — and that codified form has never been applied *to* production. |

**Why it is not merely cosmetic.** A restore drill that rebuilds from migrations produces a database
with no buckets and one cron job, and `club-logos` is the highest-severity storage finding in the
register. An operator who believes the migrations folder is now the whole truth will discover the gap
during an incident rather than during a drill.

**Owner:** **Phase 8** for the buckets — a restore/rollback drill is exactly where an uncaptured bucket
surfaces. **Phase 6** for the two remaining cron jobs, the Async Edge slice that already owns the two
redundant `/api/cron/*` handlers.

---

# Part 2 — The five Phase 2 carry-forwards, each with its Phase 3 disposition

`.../02-.../evidence/STAGE-2-COMPLETION.md` § 12 named four items plus the gitignored instruction
file. **Every one gets a line here saying whether Phase 3 closed it.** None is closed silently.

| # | Phase 2 carry-forward | Phase 3 disposition | Now owned by |
|---|---|---|---|
| **12.1** | The tsconfig test-file exclusion — `F-066` partially closed, **"Phase 3 is its natural home"** | **NOT CLOSED.** Measured at ~86 errors across 10 files by plan 03-06 and deliberately kept out of the type-regeneration commits so that diff stayed reviewable. See **DI-24** | **Phase 4** — `F-066` `closes_in_phase` moved `03` → `04` |
| **12.2** | The contract-drift suite stays skipped; the cursor-pagination contract question | **NOT CLOSED, and not attempted.** Still 1 skipped suite in a 34-suite run. Phase 2 routed it to `REFAC-10` and Phase 3 did not touch it. See **DI-24** | **Phase 4** (`REFAC-10`) |
| **12.3** | The shared-cache exposure — `F-025` **Open at Critical**, precondition live | **NOT CLOSED, and not touched.** Recorded at its original severity rather than allowed to go quiet. See **DI-26** | **Phase 6** (`REFAC-19`) |
| **12.4** | The Supabase SDK bump deferred — 35 minors, six typed call sites, plus the `@supabase/ssr` major | **PARTIALLY RETIRED — the question, not the change.** Plan 03-06 fixed one of the six sites and produced the worked example for the other five. Version unmoved. See **DI-25** | **Phase 4** |
| **+** | `.claude/CLAUDE.md` correction is gitignored — assigned to **Phase 3** | **NOT CLOSED.** Phase 3 held the same line Phase 2 did: overriding a deliberate `.gitignore` is the repository owner's call. Carried across two phases now. See **DI-28** | **the phase owner** |

## And the four Phase 2 residuals Phase 3 DID close

Recorded so the register is symmetric — a note that only lists failures is as misleading as one that
only lists successes.

| Phase 2 residual | Closed by | Evidence |
|---|---|---|
| **The ban-check positive case** — "byte-identity proven; behavioural assertion needs a banned session from the Phase 3 seed" (`T-02-06-03`, routed to `CERT-05`) | plan 03-07, spec 1 | `e2e/specs/banned-redirect.spec.ts` — three cases: permanent ban diverted, unexpired suspension diverted, and **a user whose `banned_at` is set but whose expiry has passed reaches the protected path**. An implementation checking only `banned_at` passes the first two and fails the third. `evidence/playwright-run.txt` |
| **`02-REVIEW.md` WR-04** — `proxy.test.ts` asserts only `config.matcher`, so deleting the redirect block leaves the suite green | plan 03-07, spec 2 | `e2e/specs/protected-route-redirect.spec.ts`, over **every** path in `PROTECTED_ROUTES`, re-derived from `src/proxy.ts` at load time by `e2e/fixtures.ts` rather than transcribed |
| **The AR-12 / AR-13 obligation inherited from Phase 1** — Phase 2 never registered the MCP production transport in any threat model | plans 03-01, 03-04, 03-05, 03-08 | Three separate per-read envelopes — `evidence/transport-identity.03-01.json`, `.03-04.json`, `.03-05.json`, `.03-08.json` — each asserted to read `on`, plus the transport registered as a trust boundary in every Phase 3 plan's `<threat_model>` |
| **The deploy-path boundary** — "Phase 3 planning should register the deploy path (git link or explicit deploy) as a boundary" | plan 03-08 | Registered in `03-08-PLAN.md` § Trust Boundaries: *"repository tree → Vercel · Not git-linked; a push does not deploy; previews sit behind Deployment Protection"*, and dispositioned as threat `T-03-08-03` |

## Two Phase 2 residuals that remain open and belong to nobody in Stage 3

| Item | State | Owner |
|---|---|---|
| **Renovate GitHub App is NOT installed** | `renovate.json` is committed and strict-validated in both modes but **inert** — zero PRs or issues ever authored by `app/renovate`. Also unaddressed: CI checks are not marked **required** in branch protection on `main`, without which "checks passed" is vacuous and patch auto-merge merges on a green tick that guarantees nothing | the **phase owner** — install at `https://github.com/apps/renovate`, grant this repository, confirm the Dependency Dashboard issue appears |
| **Two Moderate production advisories** — `dompurify` via `redoc`, and `yaml` | Below the `--audit-level=high` CI gate; tracked, not blocking, per vulnerability-policy clause 4. `yaml` is **not** dead code — `redoc@2.5.4`'s prebuilt bundle `require()`s it while declaring it in neither `dependencies` nor `peerDependencies` | Renovate once the app is installed; reviewed again at `REFAC-19` |

---

# Part 3 — Register corrections plan 03-08 made, and the ones it deliberately did not

**Made** — each because the roadmap is the phase contract and a `closes_in_phase` that disagrees with
it sends a reader to the wrong phase:

| Finding | Change | Why |
|---|---|---|
| `F-043`, `F-044`, `F-047`, `F-048`, `F-049` | `Open` → **`Fixed`** | Each validation criterion is met in full by a committed artifact. See `evidence/FOUNDATION-READINESS.md` § 10 |
| `F-045` | `closes_in_phase` `03` → **`08`** | Its criterion is "the applied version set and the repository file version set are identical". The repair was deferred to Phase 8 (**DI-23**), so that is where it can close |
| `F-066` | `closes_in_phase` `03` → **`04`** | Both its clauses — zero skipped suites, and test files type-checked — land in Phase 4 (**DI-24**) |

**Deliberately not made:**

- **`F-026`, `F-027`, `F-028`** keep `closes_in_phase: 05` while `F-025` reads `06`. Phase 2 filed the
  disagreement and left it; `F-027` is an authorization defect the cache rule makes worse, so `05` may
  be right for it. **One `closes_in_phase` read per finding, by whoever plans Phase 5.** See **DI-26**.
- **`F-015`** stays `Open` at `closes_in_phase: 05` even though `idx_events_status_start_date` now
  exists in the repository and is asserted by `supabase/tests/database/010-fk-indexes.test.sql`. Its
  criterion also requires an **`EXPLAIN` assertion that the anonymous feed query uses it**, which was
  not written — and the index is not in production anyway (**DI-23**).
- **`F-016`** stays `Open`. The three `club_invitations` policies exist in the repository and are
  proven by pgTAP allow/deny pairs with a mutation check, but its criterion is an integration test
  where user B actually accepts, and **the policies are not in production** (**DI-23**).
- **`F-020`** stays `Open`. Both named indexes were added, but its criterion is a general query
  asserting *every* policy-referenced column in the `public` schema is covered, and that query was not
  written.

Each of those four is a case where the fix shipped and the **criterion** did not close. Flipping the
status anyway is exactly the move `T-03-08-05` prohibits.

---

*Phase: 03-refactor-foundations-schema-truth-and-the-seam-kit*
*Plans: 03-03, 03-04, 03-06, 03-07, 03-08 — consolidated by 03-08*
