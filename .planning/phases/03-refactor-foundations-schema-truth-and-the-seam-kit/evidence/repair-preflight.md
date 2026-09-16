# Repair preflight — the exact version, the exact command, and what production holds right now

**Plan:** 03-08 · **Phase:** 03-refactor-foundations-schema-truth-and-the-seam-kit · **Recorded:** 2026-09-16

This document exists so that the person deciding has everything in front of them and nothing to look
up. It is a decision aid, not a recommendation. 03-RESEARCH.md § Open Questions Q2 states that this
is the phase owner's call and not the executor's, and it states that skipping the repair does not
fail the phase. Both statements are honoured below: **neither option fails Phase 3.**

---

## 0. The read that produced this document

Every production read in this phase carries its own AR-12 envelope, because AR-12's clause is
per-read and a note that quotes an older envelope is quoting a different connection. This plan's
envelope is `evidence/transport-identity.03-08.json` — the phase's third, separate from 03-01's and
03-05's — and it was captured **before** the history re-read below.

| Field | Value |
|---|---|
| Transport | `node .planning/audit/tools/sql-readonly.mjs` — Management API `POST /v1/projects/<PROD-PROJECT-REF>/database/query` with `read_only: true`, enforced **server-side** |
| `current_user` | `supabase_read_only_user` |
| `transaction_read_only` | **`on`** |
| Captured (UTC) | `2026-09-16T02:54:26Z` |

Nothing in this plan has written to production. The read-only-ness above is a server control, not an
intention — a write through that transport is refused by the server, not by this executor's restraint.

---

## 1. The exact version string, derived rather than recalled

The version is read off the baseline filename at the only level the Supabase CLI scans,
`supabase/migrations/`, by taking the characters before the first underscore:

```
20260915214553_baseline.sql   →   20260915214553
```

There are exactly three files at that level today, and their versions are:

| File | Version | In production's history? |
|---|---|---|
| `supabase/migrations/20260915214553_baseline.sql` | `20260915214553` | **No** |
| `supabase/migrations/20260915230000_fk_indexes_and_policy_gaps.sql` | `20260915230000` | **No** |
| `supabase/migrations/20260915230100_cron_compute_user_scores.sql` | `20260915230100` | **No** |

**Only the first is the subject of this decision.** The other two are deliberately left unmarked
under both options — see § 4.

---

## 2. The exact single command

```
supabase migration repair --status applied 20260915214553 --linked
```

That is the whole of it. One subcommand, one status value, one version, one target. It is the same
command `evidence/reconciliation-note.md` § 4 named when plan 03-04 declined to run it, quoted here
unchanged so that the thing approved is the literal thing that would run.

Flags verified against the installed CLI (`supabase migration repair --help`, CLI **2.115.0**):

| Token | What the CLI says it is |
|---|---|
| `--status applied` | "Version status to update" — choices are `applied` and `reverted`. `applied` marks a migration as applied in the tracking table when it is missing from the remote history but the schema change is already there. |
| `20260915214553` | The positional `version...` argument. Exactly one version is passed. |
| `--linked` | "Repairs the migration history of the linked project" — the linked project is the production project (`supabase/.temp/project-ref`, gitignored). |

**Operational note on credentials, so the command is not surprising when it runs.** `--linked`
opens a database connection and therefore needs the production database password. It is supplied
through `SUPABASE_DB_PASSWORD` read from the macOS keychain item **"Event-Radar DB password"** at the
moment of use — never on a command line, never written to a file, never printed, and unset
immediately after. `.env.local` is not opened. This is the same handling `evidence/db-diff.prod.sql`
and `evidence/db-diff.after-fixes.sql` record for plan 03-05's reads.

---

## 3. What production holds right now — the before state

Re-read through the sanctioned tool immediately after the envelope above, with the query
`SELECT version, name, statements FROM supabase_migrations.schema_migrations ORDER BY version`:

| Measurement | Value |
|---|---|
| Rows in `supabase_migrations.schema_migrations` | **45** |
| Is `20260915214553` present? | **No** |
| Lowest version | `001` |
| Highest version | `20260324061310` |
| Any version greater than the baseline version | **none** |
| `sha256` of the newline-joined version list | `5288be2dc3c4a1b0f749255a32aa55ae869c26e8ffbdb0a4df48add208082454` |
| Identical to the plan-03-01 census in `evidence/migration-history.prod.json`? | **Yes — 45 rows, same order, same values** |

The last row matters more than it looks: it is the assertion that **nothing has written to production
between plan 03-01 and now**, across six plans. It is also the number a post-repair claim would be
measured against. Without it, "the repair added one row" has nothing to be a change *from*.

---

## 4. What changes if the command runs

- **One row is added** to `supabase_migrations.schema_migrations`, recording version `20260915214553`
  as applied. The count goes **45 → 46**.
- **No schema object is touched.** No table, column, index, policy, function, trigger, view, bucket or
  cron job changes. `migration repair` writes to the migration tracking table and nothing else.
- **No data is touched.** Not one row of `public` changes.
- **None of the 45 existing rows is modified.** They keep their versions, their names and their
  `statements`.
- **The two post-baseline migrations stay unmarked**, and that is the point rather than an omission.
  `20260915230000_fk_indexes_and_policy_gaps.sql` and `20260915230100_cron_compute_user_scores.sql`
  carry changes production genuinely does **not** have — plan 03-05 measured exactly nine such objects
  in `evidence/db-diff.after-fixes.sql`: three `club_invitations` policies (the **F-016** invitee
  read/accept gap — club-invitation acceptance is broken in production today) and six indexes
  including the two trigram GIN indexes that make fuzzy search something other than a sequential scan.
  Marking those applied would be a lie and would strand the fixes forever. Leaving them unmarked is
  what lets a later, deliberate push deliver them.

---

## 5. What changes if the command does not run

- **Nothing in production.** The history table stays at 45 rows and the phase stays entirely read-only
  toward production, which is the posture every other plan in Phase 3 held.
- **Deployment continuity stays unresolved.** Production's history has no row saying the baseline is
  applied, so a future `supabase db push` would try to apply `20260915214553_baseline.sql` against a
  database that already contains every object in it. That push would be redundant at best and
  destructive at worst.
- **Therefore, while this is outstanding, `supabase db push` must not be run against production at
  all.** This is not a new constraint invented here; `evidence/reconciliation-note.md` § 4 records it
  in those terms. Deferring the repair is safe. Deferring it and then pushing is not.
- The repair then lands in **Phase 8's deployment certification**, which examines the deploy path
  anyway and can verify the result end to end with an actual deploy rather than by inference.

---

## 6. What must not happen under either option

**The 45 historical production versions are never marked reverted.** Not under `repair-now`, not
under `defer-to-phase-8`, not as a follow-up, not as a tidy-up.

Three reasons, and each is sufficient on its own:

1. **They are true statements about what happened.** `--status reverted` is for a migration "recorded
   as applied but never run". These were run. Marking them reverted asserts the opposite of the
   measured fact.
2. **Eighteen of them are the only surviving record of the March 2026 out-of-band burst.** There is no
   file in this repository for any of those versions; plan 03-04 recovered their `statements` into
   `supabase/migrations/_archive_pre_baseline/recovered/` precisely because production's history was
   the sole copy. Erasing the rows destroys the provenance of the recovery.
3. **It would buy nothing.** Once the baseline version is marked applied, `db push` ignores the older
   versions regardless. The only effect of reverting them is the loss of the history.

Also out of scope under both options: no `supabase db push`, no `apply_migration`, no schema change,
no data change, and no second version passed to `migration repair`.

---

## 7. The risk, stated honestly on both sides

**Running it.** It is a production write. It is small — one row in a bookkeeping table, touching no
schema and no data — and it is reversible in principle, since the row can be removed. But it is a
write, and it rests on an assumption the research could not verify without performing it:
03-RESEARCH.md § Assumptions Log **A2** — "`supabase migration repair --status applied <baseline>` is
sufficient to make a future `db push` work, without marking the 45 historical versions reverted" —
rated **Medium** confidence, with the note that it "only matters for post-phase deployment". If the
assumption turns out to be insufficient, the discovery happens at the next push rather than here, and
the remedy is whatever Phase 8 would have done anyway.

**Declining it.** Deployment continuity stays unresolved for the length of Stage 3. Any push attempted
before Phase 8 needs the repair first, so the prohibition in § 5 has to hold for the whole stage —
and a prohibition that has to be remembered for three phases is a weaker control than a row in a
table. Against that: Phase 8 is where the deploy path is examined in any case, and it is the only
place the repair's sufficiency can actually be *verified* rather than assumed.

**Neither option fails Phase 3.** None of the five Phase 3 success criteria mentions production's
migration history. REFAC-01's criterion is a reset that replays and a diff that is accounted for;
both are met and both are verified against a database (`evidence/db-reset.after-fixes.txt`,
`evidence/db-diff.after-fixes.sql`, `evidence/reconciliation-note.md` § 1). The repair is a
post-phase deployment concern that this phase is merely the first to be in a position to act on.

---

## 8. What is recorded either way

Whichever option is selected, `evidence/repair-outcome.md` records which one it was and who took it.
If the repair ran, it records the history version count before and after and confirms no version was
marked reverted and no schema object changed. If it was deferred, it records the deferral in writing,
names Phase 8's deployment certification as the owner, and states what a person must run before any
push in the meantime. An undecided checkpoint is recorded as the deferral, so a later reader can
always tell what happened.

---

## 9. Redaction

The production project reference appears nowhere in this file; it is `<PROD-PROJECT-REF>` throughout,
per `.planning/audit/REDACTION.md`. No token, key, JWT, connection string or password shape appears
here — the shapes are asserted absent by this plan's acceptance criteria, and the database password
is named only by its keychain item, never by its value.
