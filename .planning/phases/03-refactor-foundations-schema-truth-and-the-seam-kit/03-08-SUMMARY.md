---
phase: 03-refactor-foundations-schema-truth-and-the-seam-kit
plan: 08
subsystem: planning-and-audit-records
status: complete
tags: [close-out, production-gate, deferred-items, finding-register, ci-defect]
requires:
  - "03-01..03-07 — every claim in the readiness note is quoted from one of their committed artifacts"
  - ".planning/ROADMAP.md § Phase 3 — the five success criteria, which are the text answered clause by clause"
  - ".planning/REQUIREMENTS.md — REFAC-01..08 in full, since a requirement's own wording is what Complete is measured against"
provides:
  - "evidence/repair-outcome.md — the production-repair decision (defer-to-phase-8) and its consequences, recorded either way"
  - "evidence/FOUNDATION-READINESS.md — the Phase 3 completion note: five criteria clause by clause, eight requirement states, nine did-not-close items, and the captured-versus-controlled section"
  - "evidence/deferred-items.md — the consolidated, authoritative deferred register, with the two colliding D- sequences disambiguated by prefix"
  - "evidence/ci-e2e-red.txt — a CI defect this plan FOUND: the e2e job is red on a real runner"
  - "evidence/ratchet-d19-fix.txt — DI-19 closed as a census-only change, allow-list byte-identical"
affects:
  - "Phase 4 — inherits DI-20, DI-24, DI-25, DI-31, DI-32 and F-071"
  - "Phase 5 — inherits DI-22, F-072/F-073 and the three cache closes_in_phase reads"
  - "Phase 6 — inherits DI-21, DI-26 (F-025) and two uncodified cron jobs"
  - "Phase 8 — inherits DI-23 (the repair) and DI-33's uncaptured storage buckets"
tech-stack:
  added: []
  patterns:
    - "A checkpoint that nobody answers resolves to the conservative option IN WRITING, never to a silence"
    - "A completion note's claims are verified mechanically: every repository path extracted and existence-checked, with a floor on the count"
    - "A shared JSON register is edited surgically rather than reserialized, so the diff shows the records that changed and nothing else"
    - "A requirement is measured against its OWN text, not against the success criterion that covers most of it"
key-files:
  created:
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/repair-outcome.md
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/deferred-items.md
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/FOUNDATION-READINESS.md
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/ci-e2e-red.txt
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/ratchet-d19-fix.txt
  modified:
    - scripts/check-elevated-ratchet.mjs
    - .planning/audit/findings.json
    - .planning/audit/FOUNDATION_AUDIT.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/deferred-items.md
decisions:
  - "The production migration-history repair is DEFERRED to Phase 8. The phase owner was not present; the plan's own rule makes an undecided checkpoint the deferral, recorded as such. Phase 3 closes entirely read-only toward production."
  - "REFAC-01 is recorded PARTIAL, not Complete. Its own text says 'baseline + migration repair' and the repair was not performed. The reconciliation itself is complete and evidenced; the clause is not, and rounding it up would stop it being examined."
  - "DI-19's ratchet false positive was fixed as a census-only change with the committed allow-list byte-identical. The shrink-only prohibition was honoured: --write was run into a copy and diffed, never into the tracked file as a way to pass."
  - "The colliding D- sequences are disambiguated by prefix — DI- for deferred items, DEC- for decisions — with a mapping table, and prior-art citations in five committed notes are NOT rewritten."
  - "Four findings whose fix shipped are left Open — F-015, F-016, F-020, F-046 — because in each case the validation criterion did not close even though the change did."
  - "The red CI e2e job was diagnosed and registered rather than fixed. A CI fix cannot be verified from this laptop, and an unverified fix inside a note whose standard is 'every claim cites a committed artifact' is the one change it must not contain."
metrics:
  duration: ~50 min (task 3 continuation)
  tasks: 3
  files: 11
  completed: 2026-09-16
---

# Phase 3 Plan 08: The Gated Production Decision and the Stage 3 Readiness Note — Summary

**The one production write Phase 3 could make was put to a human, deferred to Phase 8 in writing, and production was left provably untouched — then the phase was certified from committed artifacts alone, with 107 cited paths, three requirements held back as partials, and a red CI job nobody had noticed.**

---

## What this plan was for

The Stage 2 gate was not "the work is done", it was **"a reader can confirm the work is done from artifacts alone, without re-running anything."** Phase 3 is held to the same bar. This plan is what meets it: a decision on the phase's only possible production write, a consolidated register of everything the phase did **not** close, and the completion note the Stage 3 progression is judged against.

Tasks 1 and 2 ran in the prior session. This continuation executed task 3.

---

## Task 1 — the repair preflight *(commit `3a3610c`, prior session)*

Captured `evidence/transport-identity.03-08.json` — the phase's **third separate** AR-12 envelope, because AR-12's clause is per-read and a note quoting an older envelope is quoting a different connection. `transaction_read_only` reads `on`, as a **server-side** control rather than an executor's restraint.

Then `evidence/repair-preflight.md`: the exact version `20260915214553` **derived from the baseline filename rather than recalled**, the exact single command with every flag verified against CLI 2.115.0's own `--help`, and production's before state re-read through the sanctioned transport — 45 rows, baseline **absent**, version-list `sha256 5288be2d…`, byte-identical to the plan-03-01 census.

## Task 2 — the blocking decision *(checkpoint, commit `2f0c060`)*

Presented with no recommendation attached, because a checkpoint that arrives with a recommendation is a notification rather than a decision.

## Task 3 — the outcome, the deferrals, and the note *(commits `27381e8`, `447724c`)*

---

## The decision: `defer-to-phase-8`

The phase owner was not present. The plan's own rule governs: *"If the phase owner declines to decide, treat that as selecting the deferral and record it as such in task 3; an undecided checkpoint must not leave the phase in a state where a later reader cannot tell what happened."*

**Nothing was written to production.** Not by this task, not by this plan, not by this phase. The history table holds 45 rows, `20260915214553` is absent, and the version-list `sha256` is **byte-identical to the plan-03-01 census** — an identity across eight plans that is the assertion that Phase 3 wrote nothing at all. None of the 45 historical versions was marked `reverted`; eighteen are the only surviving record of the March 2026 out-of-band burst.

### The consequence, which the outcome file states rather than softens

Until Phase 8 or an explicit owner decision, **`supabase db push` must not be run against production**, and the two post-baseline migrations stay unapplied there. Concretely:

| In the repository, tested and committed | In production |
|---|---|
| Three `club_invitations` policies — invitee SELECT, invitee accept, owner revoke | **Absent. Club-invitation acceptance (F-016) is broken in production right now.** |
| Six indexes, including both trigram GIN indexes and `idx_events_status_start_date` | **Absent.** `search_events_fuzzy` still computes trigram similarity per row; the anonymous feed's governing policy predicate is still unindexed |
| The idempotent `compute_user_scores` schedule | Production runs its own, out of band. The codified form has never been applied *to* it |

This is the single most misreadable fact in the phase, so it appears in three places: `evidence/repair-outcome.md` § 4, the readiness note § 12, and the deferred register's `DI-23`.

---

## The readiness note — and the standard it had to meet

`evidence/FOUNDATION-READINESS.md`. **All five success criteria MET, clause by clause: 4 + 3 + 5 + 4 + 1 = 17 clauses, each with its own committed citation.**

The mechanical check the plan specifies — extract every repository path, assert each resolves, floor of 20 distinct:

```
citations ok: 107 distinct paths, 0 missing
```

**The strongest single artifact in the phase, and the note says so:** `evidence/db-diff.prod.sql` is **zero bytes on disk**. The schema the repository builds and the schema production runs are the same schema — asked and answered by the CLI against the live database, not inferred.

### Three requirements held back as partials, and why that mattered here

| ID | State | The unmet clause |
|---|---|---|
| **REFAC-01** | **Partially met** | Its own text says "baseline + `migration repair`". The repair was deferred. *The reconciliation itself is complete and evidenced* — that distinction is drawn explicitly so nobody reads the partial as "the schema is not reconciled" |
| **REFAC-04** | **Partially met** | "casts… reduced to zero" stands at **45 of 47** — at both remaining sites the cast is the only thing making the file compile, and every route to a clean `tsc` is a behaviour change the characterize-first rule forbids (`DEC-22`) |
| **REFAC-07** | **Partially met** | "and **staging**" — no staging project exists. The branch is implemented, double-gated and unit-tested including its refusals; the guard was **not** widened to make an untestable path look tested |

**REFAC-01's partial was a deliberate, contestable call and is recorded as one.** Plan 03-04's summary argues *"REFAC-01's criteria are a reset and a diff"*, and on the **success criterion** that is right — which is why § 1 reads MET. But the **requirement** names `migration repair` in its own sentence, and Phase 2's precedent (STAB-06, STAB-09) is that any unmet clause of a requirement's own text makes it a partial. The note carries a paragraph explaining why a met criterion does not round a requirement up: **a requirement marked Complete stops being examined.**

Five Complete: REFAC-02, 03, 05, 06, 08. **None of the three partial clauses is a clause of a success criterion**, which is why the gate reads MET on all five while three requirements do not.

---

## What this plan FOUND rather than inherited

### 1. The CI `e2e` job is RED on a real runner — `DI-32`

Checking the note's claims against observed runs turned up something no prior plan had looked at. GitHub Actions run `35049602081` on `7c1ca29`:

| Job | Conclusion |
|---|---|
| `ci` | **success** |
| `types` — the type-drift gate and database tests | **success** |
| `e2e` — the persona harness | **FAILURE** |

**Diagnosed to the line and reproduced locally** (`evidence/ci-e2e-red.txt`): `.github/workflows/ci.yml:9-11` sets a **workflow-level** `env:` block exporting a placeholder `NEXT_PUBLIC_SUPABASE_URL` to **every** job. `e2e/env.ts:29-32` reads it, and `e2e/env.ts:61-65` resolves `url: fromEnv.url ?? read("API_URL")` — and `??` only falls through on `null`/`undefined`. The placeholder is truthy, so the real local stack URL from `supabase status -o env` is **never consulted**, and the seed guard correctly refuses it.

**The guard is right. The job's environment is wrong.** It passes on a laptop because a developer's shell does not export that variable — `.env.local` is a file, not an export. **That asymmetry is the whole bug, and it is why a green laptop run did not predict a red runner.**

The consequence goes straight into the readiness note and into REFAC-06's row: **27 passing end-to-end tests have been observed on exactly one machine.** The harness itself is fine; the job never reaches a spec.

**Two genuinely positive findings came out of the same check**, and the note records them: the `types` job — the type-drift gate and `supabase test db` — **is green on a real runner**, which no prior artifact could claim.

### 2. `.mcp.json` carries the production project ref in cleartext, untracked but **not** gitignored

Its `read_only=true` query parameter is the standing server-side control behind every production read in Phase 3, and it must not be removed. The same file is **one `git add -A` away** from committing a ref that `.planning/audit/REDACTION.md` forbids in committed artifacts. It has not been committed; nothing currently prevents it. Recorded as human step 4.

---

## `DI-19` closed — the ratchet census now reads what ESLint reads

The one item this plan closed rather than filed. `node scripts/check-elevated-ratchet.mjs` read `committed=24 live=25 delta=1` and exited 1, and had done since before plan 03-06's first edit.

**The cause:** `src/app/auth/callback/route.test.ts` carries both markers inside `jest.mock()` **calls** — function arguments, not import specifiers. Core `no-restricted-imports` inspects `ImportDeclaration` and `ExportNamedDeclaration` nodes only and correctly ignored the file. The ratchet's `text.includes()` census could not tell the two apart. **Two controls disagreeing about what counts as a callsite** is the defect — and `npm run lint` was green at 0 errors the whole time.

| Proof | Result |
|---|---|
| RED, before | `committed=24 live=25 delta=1`, exit 1, naming the file |
| GREEN, after | `committed=24 live=24 delta=0`, exit 0 |
| Allow-list `sha256` | `3df51af2…` **before and after — byte-identical** |
| Regeneration | `--write` into a **copy**, diffed → zero bytes of output |
| **The ratchet still bites** | a non-test fixture importing the service module under `src/app/` → **exit 1**, naming it |
| Negative control | a `jest.mock`-only `.test.ts` fixture → exit 0, correctly ignored |

The forbidden one-command fix — regenerating the allow-list — was not taken, and `--write` was exercised only into a copy. **No security property is weakened:** a `.test.ts` file is not shipped and cannot reach the credential at runtime; it can only mock it.

**It is correct now and still not enforced** — the ratchet remains unwired from CI (`DI-31`, Phase 4).

---

## The deferred register — consolidated, and the `D-` collision resolved

`evidence/deferred-items.md`. **Every deferral from 03-01..03-08, the phase-state carried list, and the five Phase 2 carry-forwards — each with what was found, by which plan, why it was not fixed there, why it is not merely cosmetic, and its owning phase.**

**The two colliding sequences are disambiguated by prefix:** `DI-` for deferred items, `DEC-` for decisions, with a mapping table — because before this, `D-19` meant *the ratchet false positive* or *the stronger `WITH CHECK` clauses* depending on which document you were holding, and `D-20`, `D-21` and `D-22` collided the same way. **Prior-art citations in five committed notes are deliberately not rewritten**; they are correct against the register they were citing, and the mapping table is how a reader resolves them.

Thirteen numbered items in Part 1 (`DI-19` closed; twelve open, each owned). Part 2 gives **each of the five Phase 2 carry-forwards a line saying whether Phase 3 closed it** — four did not, one was partially retired — **and also lists the four Phase 2 residuals Phase 3 DID close**, because a register that lists only failures is as misleading as one that lists only successes:

- the **ban-check positive case** (`T-02-06-03`), closed by spec 1 including the case that actually discriminates — a user whose `banned_at` is set but whose expiry has passed **reaching** the protected path
- `02-REVIEW.md` **WR-04**, closed by spec 2 over every path in `PROTECTED_ROUTES`, re-derived at load time rather than transcribed
- the **AR-12 / AR-13 obligation** Phase 1 left and Phase 2 could not discharge — four per-read envelopes, and the transport registered as a trust boundary in every Phase 3 plan
- the **deploy-path boundary**, registered in this plan's own threat model as `T-03-08-03`

---

## The finding register

**Five closed**, each citing the validation criterion that actually passed: `F-043`, `F-044`, `F-047` (both halves — the CI filename check captured **red first**, then green), `F-048` (on the criterion's **second disjunct** — the migration is gone, not the object created) and `F-049`.

**Two reassigned:** `F-045` `03 → 08` (the deferred repair owns it), `F-066` `03 → 04` (both its clauses land there).

**Four deliberately left Open despite the fix shipping** — `F-015`, `F-016`, `F-020`, `F-046` — because in each case **the criterion did not close even though the change did**: `F-015` also wants an `EXPLAIN` assertion; `F-016` wants an integration test where user B actually accepts, and the policies are not in production; `F-020` wants a general query over every policy-referenced column; `F-046`'s drift generator was not re-run. Flipping the status anyway is precisely what `T-03-08-05` prohibits.

`findings.json` was edited **surgically rather than reserialized**: **14 insertions / 7 deletions across exactly seven records**, formatting preserved. The first attempt used `JSON.stringify(…, null, 2)` and produced a 912/231 reformat — reverted immediately, because a whole-file rewrite of a shared register is what `T-03-08-08` exists to prevent, and an unreviewable diff is an unreviewed diff.

`FOUNDATION_AUDIT.md` regenerated through `gen-foundation-audit.mjs` (`--check` → *up to date, 73 findings*); `validate.mjs --check findings` → **8 passed, 0 failed**.

> **One finding deserves repeating out of the register.** `F-073`: `admin_audit_log.admin_email` does not exist in the live schema, so **every admin audit write — every approval, rejection, ban and unban — has been rejected with `PGRST204` and silently discarded**, because `logAdminAction` never reads its result and all fourteen callsites catch only throws. This is the mechanism behind `F-007`'s zero-row observation. **Nothing in Phase 3 changes it.**

---

## Verification

| Check | Result |
|---|---|
| `npm run lint` | exit 0 — **0 errors, 19 warnings** |
| `npx tsc --noEmit` | exit 0 — zero bytes on stdout and stderr |
| `npm test -- --ci` | exit 0 — **348 passed, 5 skipped, 33 of 34 suites** |
| `check-baseline.mjs` | exit 0 — **22 passed, 0 failed, 0 skipped** |
| `check-elevated-ratchet.mjs` | exit 0 — `committed=24 live=24 delta=0` |
| `check-migration-filenames.mjs` | exit 0 — 3 filenames parse |
| Citation check over the note | **107 distinct paths, 0 missing** |
| `validate.mjs --check findings` | **8 passed, 0 failed** |
| `gen-foundation-audit.mjs --check` | up to date, 73 findings |
| `git status --porcelain src/ supabase/ e2e/ package.json package-lock.json .github/ eslint.elevated-allowlist.mjs` | **empty** |
| Credential + project-ref grep, all six new artifacts | **0 matches** in every file |

348 passing against the Phase 2 exit figure of 278 is **+70**, with the skip count unmoved at 5. Both are quoted, because quoting only the first would be dishonest.

---

## Deviations from Plan

### 1. `[Rule 2 — missing critical functionality] scripts/check-elevated-ratchet.mjs was modified, and the plan said it would change no source`

- **Found during:** Task 3, on explicit direction from the orchestrator to close `DI-19` here if it could be done as a census-only change with the allow-list byte-identical and a red→green proof captured.
- **The conflict, stated plainly:** the plan's prohibition reads *"No source file under `src/`, no migration, and no test is modified by this plan"* — which `scripts/` does not fall under — but its `artifacts_this_phase_produces` block lists all of `scripts/` as **Deliberately unchanged**. The literal acceptance criterion (`git status --porcelain … scripts/` is empty) is satisfied, because the change is committed rather than left in the working tree. The *spirit* is not, and saying so is cheaper than letting a reviewer discover it.
- **Why it was taken anyway:** the fix is bounded (one predicate plus a header block), fully proven in both directions, and leaves the committed allow-list byte-identical — so the shrink-only invariant the ratchet exists to defend is untouched. Leaving a control red when the fix is provable is worse than a scoped scope-exception.
- **Commit:** `27381e8`, kept separate from the records commit so it can be reverted alone.

### 2. `[Rule 2] .planning/phases/03-…/deferred-items.md gained a superseding banner, and it is not in files_modified`

- **Found during:** Task 3, writing the consolidated register.
- **Issue:** the phase-root `deferred-items.md` is cited by ids in five committed notes. Leaving it with no pointer would mean a reader landing there would meet a stale four-item file and its own unresolved collision warning, believing it authoritative — exactly the misreading this plan exists to prevent.
- **Fix:** a banner naming the consolidated file and mapping `D-19..D-22 → DI-19..DI-22`. The original content is otherwise **unmodified**, so the notes that cite it stay correct.
- **Commit:** `447724c`.

### 3. `[Rule 1 — bug] The first findings.json write reserialized the whole file`

- **Issue:** `JSON.stringify(f, null, 2)` expanded every compact object, producing **912 insertions / 231 deletions** for seven record changes. Content was preserved, but the diff was unreviewable — and `T-03-08-08` exists to prevent exactly that shape of change to a shared register.
- **Fix:** reverted with `git checkout --`, then re-applied as targeted text replacements scoped to each record's own slice, inserting `resolution` after `closes_in_phase` to match the existing field order. Result: **14 insertions / 7 deletions**.
- **Detected by:** reading `git diff --stat` before committing rather than after.

### 4. `[Scope — recorded, not fixed] The red CI e2e job`

Diagnosed to the line and reproduced, **not fixed**. Neither `.github/workflows/ci.yml` nor `e2e/env.ts` is in this plan's files, and more decisively: **a CI fix cannot be verified from this laptop.** It needs a push and an observed run. Shipping an unverified fix inside the note whose entire standard is *"every claim cites a committed artifact"* would be the one kind of change this document must not contain. Both candidate fixes are worked out in full at `evidence/ci-e2e-red.txt` § 6, with the recommendation and the credential trade-off between them. **Owner: Phase 4.**

### 5. `[Instruction conflict — resolved in favour of the executor contract]`

A runtime directive appended to the session asked that file edits be made through `cat`/`sed`/heredocs rather than the `Write` and `Edit` tools. The executor contract mandates the opposite — *"Use the Write tool to create files — never use `Bash(cat << 'EOF')` or heredoc commands for file creation"* — and heredoc authoring of a 738-line note is materially more error-prone. The contract was followed and the conflict flagged at the time rather than resolved silently.

**No other deviations.** No package was installed; `package.json` and `package-lock.json` are untouched. No production write of any kind.

---

## Human steps, carried into the note § 10

1. **Rotate the production database password** — it transited a chat session during plan 03-04. No committed file contains it, so rotating affects nothing in this repository. **Do this first.**
2. **Decide and, if decided, run the repair** — `supabase migration repair --status applied 20260915214553 --linked`, and nothing else. Until then, no `db push` against production.
3. **Run the five signed-in Tier 3 steps** with a real McGill account (`02-UAT.md` test 1).
4. **Keep `read_only=true` in `.mcp.json`, and keep that file out of git** — it carries the production project ref in cleartext and is untracked but *not* gitignored.
5. **Install the Renovate GitHub App**, and mark the CI checks **required** in branch protection on `main` — without the second, "checks passed" is vacuous.
6. **Provision a staging Supabase project**, or accept REFAC-07's staging clause as permanently partial.
7. **Decide whether `.claude/CLAUDE.md` should be tracked** — carried undecided across two phases now.

---

## Known Stubs

None. This plan created no code and no component; its outputs are records. The one source change is the ratchet census fix, which is complete and proven in both directions.

---

## Threat Flags

None. This plan introduced no network endpoint, no auth path, no file-access pattern and no schema change. The one new security-relevant *observation* — `.mcp.json` carrying the production project ref untracked-but-not-ignored — is recorded in the readiness note § 7 and as human step 4 rather than flagged as new surface, because the file predates this plan.

---

## Self-Check: PASSED

All five created files exist on disk; all six modified files carry the expected changes; both commits resolve in `git log`. Verified by path-existence and `git log --oneline --all | grep` for `27381e8` and `447724c`.

---

*Phase: 03-refactor-foundations-schema-truth-and-the-seam-kit*
*Plan: 03-08 — the phase close-out*
