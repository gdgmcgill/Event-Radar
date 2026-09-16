---
phase: 03-refactor-foundations-schema-truth-and-the-seam-kit
fixed_at: 2026-09-16T04:40:00Z
review_path: .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/03-REVIEW.md
iteration: 1
findings_in_scope: 26
findings_fixed: 15
findings_registered: 8
findings_skipped: 3
status: partial
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-09-16T04:40:00Z
**Source review:** `03-REVIEW.md` — 5 Critical, 12 Warning, 9 Info, 26 total
**Iteration:** 1
**Base:** `ea417cf` on `main`

## Summary

| Disposition | Count | Findings |
|---|---|---|
| **Fixed** | 15 | CR-04, WR-01, WR-02, WR-03, WR-04, WR-07, WR-08, WR-09, WR-10, IN-01, IN-02, IN-03, IN-04, IN-07, IN-09 |
| **Registered, not fixed** | 8 | CR-01 → `F-074` · CR-05 → `F-075` · WR-05 → `F-076` · WR-11 → `F-077` · WR-06 → note on `F-034`/`F-024` · CR-02 → note on `F-072`/`F-073` · CR-03 → `DI-34` + a REGISTRY.md note · WR-12 → `DI-35` |
| **Skipped** | 3 | IN-05, IN-06, IN-08 — all three outside the requested scope. One *clause* of the otherwise-fixed WR-09 is also left open; see § Skipped |
| **Found here, registered** | 1 | `F-078` — `search_events_fuzzy` cannot execute. Not in `03-REVIEW.md` |

**Nothing was deferred silently.** Every registered item has an owner, a phase and a written reason.

Eleven commits, all on top of `ea417cf`, all carrying the required trailers. Every one was made in an
isolated `git worktree` so nothing raced the foreground session; the branch was fast-forwarded on exit.

---

## Verification, after the last commit

Every number below was taken from the tree at `bb4b77a`, not from an earlier point in the run.

| Gate | Required | Observed | |
|---|---|---|---|
| `supabase db reset --local` | exit 0, nothing skipped | exit 0, **4 migrations applied**, `20260915214553_baseline` → `20260915230000_fk_indexes…` → `20260915230100_cron…` → `20260916000000_invitation_policy_fixes`, none passed over | PASS |
| `supabase test db --local` | count must **rise** | **Files=6, Tests=86, Result: PASS** (was Files=5, Tests=68 — **+18**) | PASS |
| … with the seed loaded | same | Files=6, Tests=86, PASS — `040`'s 21 assertions run for real rather than skipping | PASS |
| `bash scripts/pgtap-mutation-check.sh` | green | `policies_checked=4  failures=0  migrations_dir_clean=true`, **exit 0**. All four: `RED_ASSERTION` when removed, `GREEN` when restored | PASS |
| `npx tsc --noEmit` | 0 | **0** | PASS |
| `npm run lint` | 0 errors | **0 errors**, 19 warnings (all pre-existing, none in a file this pass touched) | PASS |
| `npx jest --ci` | ≥ 348 passed / 5 skipped | **358 passed, 5 skipped, 363 total; 34 suites passed, 1 skipped** (+10 tests: 8 new in `env-override`, 2 new in `guard`) | PASS |
| `check-baseline.mjs` | 22 / 0 | **22 passed, 0 failed, 0 skipped** | PASS |
| `node scripts/check-elevated-ratchet.mjs` | green, census unchanged | `committed=24 live=24 delta=0` — **unchanged** | PASS |
| `node scripts/check-migration-filenames.mjs` | pass | PASS, 4 files | PASS |
| `npx playwright test --list` | 27+ | **27 tests in 8 files** | PASS |
| `npx playwright test` | — | **27 passed, exit 0** (25.2s) — ran, not skipped | PASS |
| `node .planning/audit/tools/validate.mjs --check findings` | pass | **8 passed, 0 failed** at 78 findings | PASS |
| Seed determinism | unchanged | `load.ts --dump \| shasum -a 256` = `964ac785…52f2bcb` — **byte-identical** to `evidence/seed-determinism.txt` | PASS |
| Credential sweep | clean | every new artifact swept for `eyJ…`, `sb_secret`, service-role values — **0 hits**; only variable *names* appear | PASS |

**`supabase db diff --linked` was not run.** It is a READ and was optional. The isolated worktree
reports `linked_project: null` — the CLI's link state lives in the gitignored `supabase/.temp/`, which
a worktree does not carry — so `--linked` could not have resolved a project without re-linking, and
re-linking is not a read. No keychain item was opened, nothing was pushed, repaired or pulled.

**Two pre-existing `validate.mjs --quick` failures are untouched and unrelated:**
`schema-snapshots :: dump-contains-create-table` for `schema/staging.schema.sql` and
`schema/local.schema.sql`. Neither file was modified by this pass. 118 passed / 2 failed / 1 skipped,
the same 2 as before.

---

## Fixed

| # | Finding | Commit | Files |
|---|---|---|---|
| 1 | **WR-09** | `20db8e3` | `src/app/profile/page.tsx` |
| 2 | **WR-08** + **WR-04** (loader half) | `a52cbe1` | `scripts/seed/load.ts` |
| 3 | **WR-04** + **IN-09** | `3e46382` | `scripts/seed/envOverride.ts` (new), `e2e/env.ts`, `src/__tests__/seed/env-override.test.ts` (new), `src/__tests__/seed/guard.test.ts` |
| 4 | **WR-03** + **IN-01** + **IN-02** | `d23f636` | `playwright.config.ts`, `e2e/specs/protected-route-redirect.spec.ts` |
| 5 | **WR-10** | `55fded6` | `supabase/tests/database/040-seed-coverage.test.sql` |
| 6 | **IN-03** + **IN-04** + **IN-07** | `80d8e33` | `scripts/seed/load.ts`, `scripts/seed/personas.ts`, `scripts/check-migration-filenames.mjs` |
| 7 | **WR-07** | `f1f4c37` | `.github/workflows/ci.yml` |
| 8 | **CR-04** + **WR-01** + **WR-02** | `10a4a5c` | `supabase/migrations/20260916000000_invitation_policy_fixes.sql` (new), `supabase/tests/database/025-invitation-acceptance.test.sql` (new), `scripts/pgtap-mutation-check.sh` |
| 9 | (the above, hardened) | `085c50a` | `supabase/tests/database/025-…`, two evidence files |

### CR-04 + WR-01 + WR-02 — one fix-forward migration

`supabase/migrations/20260916000000_invitation_policy_fixes.sql`. **The earlier migration is not
edited.** A migration that has been applied anywhere is a historical record; editing one makes two
environments that ran "the same" migration diverge with nothing in the history to say so. Every policy
is `DROP POLICY IF EXISTS` then `CREATE POLICY`, so the file supersedes the earlier definitions and is
idempotent on its own.

- **CR-04.** `USING` gains `expires_at > now()`, matching what `src/app/invites/[token]/page.tsx`
  already enforces. `WITH CHECK` constrains the mutable set to `status` alone through
  `public.club_invitation_unchanged_except_status(...)`.
- **The owner REVOKE policy gets the same clause**, which is not symmetry for its own sake: permissive
  policies on one command are **OR-ed**, `USING` with `USING` and `WITH CHECK` with `WITH CHECK`, so
  without it a user who owns club B and holds a pending invitation to club A could pass the invitee
  half of `USING` and the owner half of `WITH CHECK` in one statement and repoint the row. It grants
  no membership, so it is destructive rather than an escalation — and it is still a row crossing a
  tenant boundary, which is what `T-03-05-07` is about.
- **WR-01.** New `club_members` INSERT policy: self only, `role = 'organizer'` only, and only to a club
  holding a live invitation addressed to the caller's email.
- **WR-02.** Every email comparison is `lower()` on both sides, with
  `idx_club_invitations_email_lower` so the predicate stays indexable.

**Two deviations from the instructions, both deliberate, both stated rather than quietly taken:**

1. **The instruction said the invitee may insert a row "with role `member`". There is no `member` in
   this schema.** `club_members_role_check` permits only `'owner'` and `'organizer'` (baseline `:688`),
   a fact `scripts/seed/personas.ts:394-400` already documents — `'organizer'` **is** the non-owning
   member role here. The policy pins `role = 'organizer'`, which is also the exact value the accept
   path inserts. Pinning `'member'` would have produced a policy no statement can satisfy.

2. **The instruction offered "a subselect" as one way to pin `club_id`. A subselect cannot be used.**
   A policy on `club_invitations` that references `club_invitations` makes Postgres re-apply the
   table's own policies to that reference and raise `infinite recursion detected in policy for
   relation`. The baseline's own answer to this is `public.is_club_owner()`, a `SECURITY DEFINER`
   helper; the two helpers added here follow that precedent and are built to the rules CR-01/CR-05/
   WR-05 say the inherited five broke — **subject from the session and never from a parameter**,
   `SET search_path = ''` with fully qualified bodies, `EXECUTE` revoked from `PUBLIC` and `anon`,
   and boolean returns that disclose no column.

**`has_open_club_invitation` accepts `status IN ('pending','accepted')` on purpose.**
`src/app/invites/[token]/page.tsx` issues the membership INSERT and the status UPDATE inside one
`Promise.all`, so they race. A policy requiring `status = 'accepted'` would pass or fail depending on
which request PostgREST finished first — the worst possible property for an access-control rule. It
widens nothing that matters: the caller is the named recipient of a live invitation either way.

**The pgTAP file is organised around the transaction, not the policies.** `020`'s
policies-in-isolation shape is exactly what let WR-01 through — every one of its assertions can pass
while acceptance remains impossible, because it never performs the acceptance. `025` has 18
assertions: the case-insensitive read, four tampering denials aimed at a second invitation so the
accepted row cannot mask a failure, the expiry denial with its integrity check, six `club_members`
denials, and the two-statement accept performed for real. **Every deny runs before the one allow**, so
no deny can be satisfied by a `UNIQUE(user_id, club_id)` violation on a row an earlier allow inserted
— that would be a `23505` wearing a passing test's clothes.

**The mutation harness caught its own second failure mode, and that is worth recording.** On the first
run with the new `club_members` policy removed, the suite went red as
`Bad plan. You planned 18 tests but ran 16` rather than as a counted assertion: an RLS-denied INSERT
**raises**, which aborts the pgTAP transaction. `scripts/pgtap-mutation-check.sh` refused that red as
proof, correctly — a plan error and a broken fixture are indistinguishable to it. `pg_temp.try_join()`
now runs the insert inside a `plpgsql` `EXCEPTION` block, which is a subtransaction: the denial is
caught, the outer transaction survives, and the ALLOW becomes an assertion that fails and is counted.

**The harness itself needed widening, and the reason is structural.** It walked one file. That
silently stops working the moment a fix-forward migration re-creates a policy an earlier migration
created — which is the *correct* way to change a policy. Commenting out the earlier `CREATE` leaves
the later one standing, the policy exists anyway, the suite stays GREEN, and the harness reports
"this assertion is decorative" about an assertion that is fine. **A false red on the control that
exists to prevent false greens.** The unit of mutation is now the policy NAME across every
policy-bearing migration.

Evidence: `evidence/pgtap-mutation-check.review-fix.txt`, `evidence/pgtap-run.review-fix.txt`.

### WR-07 — the SHAs, and how they were resolved

Each resolved with `gh api repos/<owner>/<repo>/git/ref/tags/<tag>`, dereferencing the annotated-tag
object where the ref pointed at one. The **major line of every action is unchanged** — this pins, it
does not upgrade — and step order is byte-identical with no `continue-on-error` added.

| Action | SHA | Tag |
|---|---|---|
| `actions/checkout` | `11d5960a326750d5838078e36cf38b85af677262` | v4.4.0 |
| `actions/setup-node` | `49933ea5288caeca8642d1e84afbd3f7d6820020` | v4.4.0 |
| `actions/upload-artifact` | `ea165f8d65b6e75b540449e92b4886f43607fa02` | v4.6.2 |
| `supabase/setup-cli` | `46f7f98c7f948ad727d22c1e67fab04c223a0520` | v3.0.0 |

`actions: read` was **checked and is not needed**: `actions/upload-artifact` v4 authenticates to the
artifact service with the runner's `ACTIONS_RUNTIME_TOKEN`, not with `GITHUB_TOKEN`, and its README at
v4.6.2 documents no `permissions` requirement. `contents: read` alone.

### WR-03 — why `false` and not a probe

A `/api/health` probe was considered and rejected. The endpoint reports healthy/degraded per
subsystem and **does not disclose which Supabase project it is bound to**, so it cannot answer "is
this server local?", and widening it to answer would mean extending an endpoint that is already
`F-029` for disclosing too much. Reuse was never correct here anyway — the harness needs a production
build because pages do not hydrate under `next dev` in Playwright's Chromium. The cost is a rebuild
per local run.

### WR-04 — one rule, stated once

`scripts/seed/envOverride.ts` is new: none of the three names, or all three, and anything in between
throws naming the missing keys and **never the values**. Both call sites use it. The trio is treated
as one unit even by `scripts/seed/load.ts`, which consumes only two of the three — a loader that
tolerated a stray `SUPABASE_ANON_KEY` would re-open the same door one name narrower. Eight unit cases,
six of them refusals, including one asserting the message does not echo a value: an error that
printed the key would put a credential in a CI log.

### IN-03 / IN-04 — proven non-behavioural

`pick(next, items)` evaluates the identical expression the loader inlined, and the persona renames
move no uuid. The proof is the dump hash: `964ac785…52f2bcb`, byte-identical to
`evidence/seed-determinism.txt`.

---

## Registered, not fixed

Each is production-codified behaviour or a control-scope decision outside this phase's charter. The
baseline reproduces production exactly by design, and the two post-baseline migrations exist only
locally — production repair is `DI-23`, deferred to Phase 8.

| Finding | Registered as | Severity | Owner | Why not fixed here |
|---|---|---|---|---|
| **CR-01** — `get_friends` / `get_friends_going_to_event`: `SECURITY DEFINER`, subject as a **parameter**, `GRANT ALL TO anon` | **`F-074`** (new) | High | Phase 5 | Changing an RPC's signature and grants is production-codified behaviour with live callsites. **No characterization test was written**, deliberately: an assertion documenting that `anon` *can* call this would have to be deleted by the fix, and the one worth writing is the assertion that it cannot — which belongs with the fix |
| **CR-05** — `compute_user_scores` / `send_event_reminders` / `send_feedback_requests` anon-executable | **`F-075`** (new) | High | Phase 5 | Revoking `EXECUTE` changes who may invoke three live functions, and the cron HTTP routes that call them have not been traced to a role. Doing it blind is how a scheduled job stops running silently — the failure mode this program exists to end, not create |
| **WR-05** — mutable `search_path` on five `SECURITY DEFINER` functions | **`F-076`** (new) | Medium | Phase 5, same migration as `F-075` | Pinning the path **requires** rewriting five bodies to schema-qualify their relations; setting it without qualifying breaks them |
| **WR-11** — `next` reaches `NextResponse.redirect` unvalidated | **`F-077`** (new) | Medium | Phase 5 | Adding the guard is an application behaviour change on the auth path, and the PRESERVE suite pinning the current behaviour is itself a Phase 3 deliverable. Editing the safety net and the thing it measures in one commit is not a review fix |
| **WR-06** — storage `FOR SELECT TO authenticated USING (true)` | **note on `F-034`, and `F-024`** | Medium / Low, unchanged | Phase 5 | **Not filed as a new finding** — see below |
| **CR-02** — every moderation action unaudited | **notes on `F-072` and `F-073`** | unchanged | Phase 5 | `DEC-22` stands. See the honest note below |
| **CR-03** — the elevated boundary is `src/app/**`-only and already walked around | **`DI-34`** + a named section in `src/server/db/elevated/REGISTRY.md` | — | Phase 4 | Doc half applied, control half not. See below |
| **WR-12** — the seam reads ban state no guard consumes | **`DI-35`** | — | Phase 4 | Both answers are design decisions with behaviour consequences, not defect repairs |

### WR-06 is a note, not a new finding — and that is a deviation from the instruction

The instruction said "→ finding, Medium, Phase 5". **`F-034` already is exactly that**: *"A
bucket-agnostic `USING (true)` read policy on `storage.objects` becomes a cross-tenant read the day a
private bucket exists"*, Medium, Open, `closes_in_phase: 05`, with `F-024` as its consequence. Filing
a fifth finding would have put two records of one policy in a register whose value is that each row is
the one place a thing is written down.

What the reviewer added is not a new defect but a change in **reach**, and that is what was recorded:
when `F-034` was written the policy existed in production and in no declarative source (`F-035`), so
it was a production-only hazard a dashboard edit could fix. `supabase/migrations/20260915214553_baseline.sql:2772`
now carries it verbatim, so **every environment built from this repository is created with it**. Both
`F-034` and `F-024` carry that note with the migration line reference.

*(The review cited `:2770`. The verified line is `:2772`. Every line reference in the four new
findings was re-derived from the tree rather than copied from the review — the grants are at `:2442`,
`:2454`, `:2460`, `:2490`, `:2496`, and the two functions that *do* pin `search_path` are at `:311`
and `:325`.)*

### CR-02 — the honest note

`DEC-22` stands and no code changed, per the instruction. What was added to `F-072` and `F-073` is the
**mechanism**, which the register did not previously carry: supabase-js infers the insert generic
**from the object literal**, so `Row extends Insert` is satisfied by a superset and an excess key is
not an error — which is precisely what makes this phase's cast removal on that statement look
type-checked while it is not. And the discarded result hides the `PGRST204` the server actually
returns, so the fourteen callers' `try/catch` blocks observe success on every failure.

**The reviewer's judgement is recorded verbatim in `F-073` rather than softened:** deferring the
*column* decision is defensible; deferring the *error check* is not, because surfacing the rejected
write is a pure observability change with no wire-format impact and was available inside this phase's
type-only remit. It was not taken in Phase 3 and it is not taken here. A reader of `F-073` now learns
that the error check is the half to do first and that it is independent of the column question.

### CR-03 — the documentation half is applied, the control half is not

`src/server/db/elevated/REGISTRY.md` now carries a named section recording `src/lib/audit.ts` as a
known out-of-scope elevated caller: **ten** route files under `src/app/api/admin/**` import
`logAdminAction`, across **fourteen** callsites, and it is invisible to both controls because the
reach is *indirect* — the ESLint `files` glob is `src/app/**` and the census walks `src/app` and
nothing else. **"Empty" without that paragraph is a claim the file cannot support.** It is a note and
not a row, because a row would imply the operation goes through `getElevatedClient()`, which it does
not.

*(The review said "~17 files". Re-derived: `grep -rl 'from "@/lib/audit"' src/app | wc -l` → **10**
files, **14** callsites — the same fourteen `F-073` counts.)*

The control change — widening the glob to `src/**` and `APP_DIR` to `join(REPO_ROOT, "src")` — is
**`DI-34`, Phase 4**, because it requires a **one-time regeneration of `eslint.elevated-allowlist.mjs`**
to absorb `src/lib/audit.ts`. Regenerating the allow-list is the single operation the ratchet's own
header forbids, since the list may only shrink; doing it inside a review-fix pass, where it would be
one line in a diff of twelve other things, is exactly how a ratchet gets quietly reset. It needs its
own plan, its own before/after capture, and its own red/green fixture proving the widened rule bites
on an indirect import.

`node scripts/check-elevated-ratchet.mjs` still reports `committed=24 live=24 delta=0` — **the census
is unchanged by this pass**, as required.

---

## Found during this pass, registered: `F-078`

Not in `03-REVIEW.md`. It surfaced in the Playwright server log while verifying unrelated fixes.

`public.search_events_fuzzy` is `LANGUAGE plpgsql STABLE` and the first statement of its body is
`SET pg_trgm.similarity_threshold = 0.1`. Postgres refuses a bare `SET` inside a non-`VOLATILE`
function, so the RPC raises `0A000` on **every** invocation. `src/app/api/events/route.ts:222` catches
it, `console.error`s it and falls through to an `ILIKE` query. So:

- fuzzy search has never worked, in any environment, including production (`raw/prod/functions.json`
  carries the identical shape: `provolatile: "s"`, body contains the `SET`);
- the degradation is invisible — `e2e/specs/anonymous-browse.spec.ts` passes **on the fallback path**;
- the two trigram GIN indexes Phase 3 added in `20260915230000` serve a function that cannot execute,
  so they are permanently unreachable;
- the `ILIKE` fallback is not a fallback, it is the **only** path, and it interpolates the raw search
  term into a PostgREST `or()` filter — a comma or a closing parenthesis rewrites the filter.

Medium, Phase 5. Not fixed here: changing a function's volatility or body is production-codified
behaviour outside a review-fix remit, and the right fix is entangled with the fallback's error
handling and the `or()` interpolation on the same lines. Registered so it cannot go quiet.

---

## Skipped

| Finding | Reason |
|---|---|
| **IN-05** — `requireClubRole` tests use `"member"` and `"officer"`, which `club_members_role_check` forbids | Explicitly out of the requested scope ("skip IN-05/IN-06/IN-08 unless trivial"), and **not trivial**: the tests compile because the column is `text`, so changing the literals changes what three cases *mean* — one is a deliberate outside-the-set probe and deciding whether a synthetic third role is the point or the bug is a test-design call, not a typo fix |
| **IN-06** — `expect(getRequestContext).toBe(createRequestContext)` will fail as a mystery on the React upgrade | Out of scope, and not trivial: the suggested fix uses `require("react")` inside an ESM-transpiled suite and inverts a deliberate pin. Getting it wrong replaces a clear future failure with a silently-passing one |
| **IN-08** — documented-unreachable guard in `friends-activity` | Out of scope. The suggestion ("keep it and add intent, or replace with an assertion") is a style choice with no defect behind it |
| **WR-09, second clause** — `src/app/api/recommendations/route.ts:92`, `.from("user_event_scores" as any)` | The requested scope named `src/app/profile/page.tsx:69-75` only, and that file is done. The recommendations escape is a **double** cast — `as any` on the table name *and* on the whole awaited builder — wrapping a `breakdown` field the generated types give as `Json` and the code reads as `ScoreBreakdown`. Removing it is not the one-line deletion the review describes; it needs the row type worked out, in a file this phase never touched and this review never read. **Left open deliberately**, noted here rather than in the register because it is a single stale cast rather than a defect |

---

## What a reader should check that this report could not assert for itself

1. **The `permissions:` block and the pinned SHAs take effect only on a real runner.** `ci.yml` parses
   (`yaml.parse` → three jobs, step names and order byte-identical) and the SHAs resolve through the
   GitHub API, but no CI run has executed them. First push to `main` is the proof.
2. **`reuseExistingServer: false` was verified by a run in which port 3000 was confirmed unoccupied.**
   The harness built and started its own server and 27 specs passed. That is evidence the change does
   not break the happy path; the evidence that reuse would now be *refused* is the config value itself.
3. **The invitation fixes are not in production**, and are not meant to be by this pass. They are in
   `supabase/migrations/`, applied to local and to CI. Production carries neither this migration nor
   its predecessor (`DI-23`, `F-045`), so `F-016` remains `Open` for exactly the reason plan 03-08
   gave — its criterion is an integration test against a database that has the policies.
4. **`F-078` deserves a second opinion on severity.** It was filed Medium on the reasoning that a
   Validated capability has never worked and two indexes are unreachable. Someone who weighs the
   `or()` interpolation more heavily may want it higher.

---

_Fixed: 2026-09-16T04:40:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
_Base: `ea417cf` · Head: `bb4b77a` · 11 commits_
