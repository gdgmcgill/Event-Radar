# Repair outcome — the decision taken, and what followed

**Plan:** 03-08 · **Phase:** 03-refactor-foundations-schema-truth-and-the-seam-kit · **Recorded:** 2026-09-16

---

## 1. The decision

> **Option selected: `defer-to-phase-8`.**
> **Taken by:** the phase owner's standing rule, applied by the orchestrator at the blocking
> checkpoint. The phase owner was not present to decide, and `03-08-PLAN.md` task 2 says in its own
> words: *"If the phase owner declines to decide, treat that as selecting the deferral and record it
> as such in task 3; an undecided checkpoint must not leave the phase in a state where a later reader
> cannot tell what happened."* This file is that record.

**No production write of any kind occurred in this task.** `supabase migration repair` was not run.
Neither was `supabase db push`, `apply_migration`, or any other statement against the production
project. The only production access this plan made at all was the single read recorded in
`evidence/repair-preflight.md` § 3, taken through `.planning/audit/tools/sql-readonly.mjs` under the
AR-12 envelope at `evidence/transport-identity.03-08.json`, whose `transaction_read_only` reads `on`
as a **server-side** control rather than an executor's intention.

Phase 3 therefore closes **entirely read-only toward production**, which is the posture every other
plan in the phase held and the posture `03-08-PLAN.md`'s `phase_locked_constraints` #1 states.

---

## 2. Why the deferral is the recorded outcome rather than a non-decision

Three reasons, stated so that a later reader does not have to reconstruct them:

1. **The plan's own rule.** An undecided checkpoint resolves to the deferral by written instruction,
   not by drift. That rule exists precisely so the absence of a human at a checkpoint produces a
   recorded, conservative outcome instead of an ambiguous one.
2. **Nothing in the phase's five success criteria requires it.** `evidence/repair-preflight.md` § 7
   makes this argument in full and `.planning/ROADMAP.md` § Phase 3 is the text it is measured
   against — none of the five criteria mentions production's migration history. REFAC-01's criterion
   is a reset that replays and a diff that is accounted for, and both are met and verified against a
   database (`evidence/db-reset.after-fixes.txt`, `evidence/db-diff.prod.sql`,
   `evidence/reconciliation-note.md` § 1).
3. **The repair is a single reversible command that is fully captured.** It is not lost by deferring.
   `evidence/repair-preflight.md` § 2 records it verbatim, with every flag verified against the
   installed CLI, and § 1 derives the version string from the baseline filename rather than recalling
   it. Phase 8's deployment certification examines the deploy path anyway, and it is the only place
   the repair's sufficiency can be **verified** by an actual deploy rather than assumed — the
   assumption 03-RESEARCH.md § Assumptions Log **A2** rates at Medium confidence.

---

## 3. What was not done, exactly

The command that did **not** run, quoted unchanged from `evidence/repair-preflight.md` § 2:

```
supabase migration repair --status applied 20260915214553 --linked
```

Production's `supabase_migrations.schema_migrations` therefore still holds **45 rows**, and version
`20260915214553` is still **absent** from it — the same state
`evidence/repair-preflight.md` § 3 measured, whose newline-joined version-list sha256 is
`5288be2dc3c4a1b0f749255a32aa55ae869c26e8ffbdb0a4df48add208082454` and which is byte-identical to
the plan-03-01 census in `evidence/migration-history.prod.json`. That identity, across seven plans,
is the assertion that **nothing in Phase 3 wrote to production at all**.

Under this option, as under the other, **none of the 45 historical versions was marked reverted.**
Not one. `evidence/repair-preflight.md` § 6 gives the three independent reasons; the operative one
is that eighteen of them are the only surviving record of the March 2026 out-of-band burst, recovered
into `supabase/migrations/_archive_pre_baseline/recovered/` by plan 03-04 precisely because
production's history was the sole copy.

---

## 4. The consequence, stated plainly

This is the part a later reader most needs, so it is not softened.

**Until Phase 8 — or until the phase owner explicitly decides to run the preflight's command —
`supabase db push` MUST NOT be run against the production project.** Production's history has no row
saying the baseline is applied, so a push would attempt to apply
`supabase/migrations/20260915214553_baseline.sql` against a database that already contains every
object in it. `evidence/reconciliation-note.md` § 4 records this constraint in the same terms.
Deferring the repair is safe. Deferring it **and then pushing** is not.

**The two post-baseline migrations remain unapplied in production, and they carry real fixes.** Plan
03-05 measured exactly nine objects that production genuinely does not have, in
`evidence/db-diff.after-fixes.sql`:

| Not in production | Migration | What it means today |
|---|---|---|
| Three `club_invitations` policies — invitee SELECT, invitee accept UPDATE, owner revoke UPDATE | `supabase/migrations/20260915230000_fk_indexes_and_policy_gaps.sql` | **F-016: club-invitation acceptance is broken in production right now.** An invitee can neither see nor accept their own invitation, and `/api/clubs/[id]/invites` is RLS-reliant so nothing masks it. The fix is written, tested and committed — and not deployed. |
| Six indexes, including `idx_events_title_trgm` and `idx_events_description_trgm` | same file | `public.search_events_fuzzy` calls `similarity()` and the `%` operator with **no trigram index on `public.events` at all** in production, so every fuzzy search computes trigram similarity per row. `idx_events_status_start_date` (F-015) is likewise absent, so the anonymous feed's single governing policy predicate is still unindexed. |
| The `compute_user_scores` pg_cron schedule | `supabase/migrations/20260915230100_cron_compute_user_scores.sql` | Codified idempotently in the repository. Production already runs its own schedule out of band; the repository now governs the local and staging copies, which is what REFAC-03 asked for — but the codified form has never been applied *to* production. |

**The honest summary of that table: these are fixed in the repository and broken or absent in
production.** A reader who sees `F-016` described as addressed by Phase 3 and concludes that
club invitations now work for McGill students would be reading it wrongly. `F-016` remains **Open**
in `.planning/audit/findings.json` for exactly this reason, and its `closes_in_phase` is unchanged at
`05`.

---

## 5. What a person must run before any push, in the meantime

Two commands, in this order. Both are re-derived from committed artifacts rather than recalled.

```bash
# 1. Confirm production's history is still where the preflight measured it (45 rows, baseline absent).
#    Read-only, through the sanctioned transport, which enforces read-only server-side.
node .planning/audit/tools/sql-readonly.mjs \
  "SELECT count(*) FROM supabase_migrations.schema_migrations"

# 2. Then, and only with an explicit owner decision, the repair itself — exactly this, nothing else:
supabase migration repair --status applied 20260915214553 --linked
```

Step 2 needs the production database password, supplied through `SUPABASE_DB_PASSWORD` read from the
macOS keychain item **"Event-Radar DB password"** at the moment of use — never on a command line,
never written to a file, never printed. `.env.local` is not opened. This is the handling
`evidence/repair-preflight.md` § 2 records.

**One additional human step, which the deferral makes more urgent rather than less:** that database
password transited a chat session during plan 03-04. It should be rotated in the Supabase dashboard
and the keychain item updated. Rotating it does not affect anything in this repository — no committed
file contains it, asserted by the credential greps every plan in this phase ran before commit.

---

## 6. Owner

**Phase 8 — Operational Certification and Sign-Off.** Listed in
`.planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/deferred-items.md`
as **DI-23**, and in `evidence/FOUNDATION-READINESS.md` § 9 as a numbered did-not-close item. Phase 8
is where the deploy path is certified, so it is where the repair can be run and its sufficiency
verified end to end by an actual deploy rather than inferred.

Nothing blocks on it inside Stage 3. Phases 4 through 6 refactor the application against the local
database the migrations build; none of them deploys.

---

## 7. Redaction

The production project reference appears nowhere in this file. No token, key, JWT, connection string
or password shape appears here — the database password is named only by its keychain item, never by
its value, per `.planning/audit/REDACTION.md`.
