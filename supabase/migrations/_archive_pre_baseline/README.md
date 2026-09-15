# Pre-Baseline Migration Archive

**Plan:** 03-04 · **Phase:** 03-refactor-foundations-schema-truth-and-the-seam-kit · **Recorded:** 2026-09-15

> **Decision: the 44 pre-baseline migrations were MOVED here, not renamed.** Every filename in
> this directory is byte-identical to the name it carried at the top level of
> `supabase/migrations/`. Git records the change as 44 renames with **zero content changes**.
> The Supabase CLI reads only the *top level* of `supabase/migrations/`, so these files have
> stopped being migrations without any of them having been renamed.

**The git sha at which all 44 of these files were still at the top level is `7d4735f`**
(`7d4735f80abe21548c76b215598ea7bb0e618ad6`, *docs(phase-03): update tracking after wave 1*).
The archive commit is its direct child and contains nothing else, so its diff can be read on
its own as the no-rename evidence. The same diff is captured verbatim at
`.planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/archive-rename-diff.txt`.

---

## 1. Why 44 migrations sit in a directory the tool ignores

Four facts, each measured rather than asserted, made replay of this folder impossible. Any one
of them alone would have been survivable; together they mean the folder and production describe
two different databases rather than disagreeing at the margin.

**1. Four collision groups cover nine files.** The 44 files collapse to **39 distinct versions**,
because nine of them share a version with another file:

| Version | Files |
|---|---|
| `008` | `008_event_source_tracking.sql`, `008b_add_is_admin_to_users.sql` |
| `011` | `011_event_images_bucket.sql`, `011_rls_audit.sql` |
| `20260305000002` | `20260305000002_email_reminder_log.sql`, `20260305000002_phase1_club_rls_and_schema.sql` |
| `20260306` | `20260306_add_user_profile_fields.sql`, `20260306_create_event_invites.sql`, `20260306_create_user_follows.sql` |

`supabase_migrations.schema_migrations` has `version` as its primary key, so a collision is not
an ordering nuisance — it is a hard insert failure.

**2. Replay aborts at the twelfth of the 44 files.** `supabase db reset` (and `supabase start`
on a fresh volume, which replays the same folder) fails on `011_rls_audit.sql` with
`Key (version)=(011) already exists`. This is **F-043**. It is also why `supabase db diff` was
unusable throughout Phase 1: `db diff` builds its shadow database by replaying exactly these
files, so the abort took the diff down with it. Plan 03-01 reproduced this abort live and
recorded it in `evidence/ports-preflight.txt` §§ 5–6.

**3. One filename does not parse, and the CLI skips it *silently* with exit status 0.**
`008b_add_is_admin_to_users.sql` does not match the CLI's `<version>_<name>.sql` pattern — the
trailing `b` breaks the match — so the CLI prints `Skipping migration
008b_add_is_admin_to_users.sql...` and **continues**, exit status unchanged. This is **F-047**.
A silent skip is worse than a failure: the `users.is_admin` column that file declares is applied
in no environment ever built from this folder, which is why `009_user_roles.sql` guards its
`DROP COLUMN is_admin` behind a `DO $$ … IF EXISTS` block. The column is absent from production
for the same reason. `scripts/check-migration-filenames.mjs` is F-047's fix and now runs in CI.

**4. Eighteen versions are applied in production with no file here at all.** Production's history
table reports **45 applied versions**; the folder declares 39; the two sets overlap in only **27**.
Eighteen production versions have no corresponding file, seventeen of them inside a 36-hour burst
on 2026-03-15/16 — the shape the dashboard SQL editor writes. Plan 03-01 read those rows back
through the read-only Management API transport and found that **thirteen of the eighteen have no
local file under any name**, including a ten-statement `events_query_performance_indexes`. The
folder is not a lossy record of production; it is missing thirteen whole migrations. That is the
strongest single argument for baselining from production rather than from this folder.

## 2. This is the third baseline attempt in this repository, and the first with a gate

Two of the files archived here are themselves prior remote-schema dumps:

- `20251128053245_remote_schema.sql`
- `20260223193741_remote_schema.sql`

Both were pulled from production and both were subsequently overtaken — new files landed at the
top level beside them, out-of-band dashboard runs landed in production beside them, and neither
attempt left behind anything that would notice. **What is different this time is not the dump. It
is the two things that did not exist before:**

1. **The archive.** Previous attempts left the superseded history at the top level, where the CLI
   kept replaying it. This one removes the whole pre-baseline set from the CLI's view in a single
   move, so the baseline is the only thing that replays.
2. **The diff gate.** `supabase db reset` must exit 0 with nothing skipped, and
   `supabase db diff --linked --schema public,storage` must write a zero-byte file. A baseline
   that drifts from production now fails a check instead of going unnoticed.

## 3. A move is not a rename — and that is the point, not a loophole

REFAC-01 forbids renaming or renumbering any existing migration file. That constraint and
"`db reset` must replay cleanly" cannot both hold while the four collision groups sit at the top
level. The resolution is that the colliding files stop being *migrations* without being
*renamed*: the directory they live in changed; not one character of any filename did.

The evidence is mechanical rather than rhetorical. The archive commit shows **44 `R100` rows**
(pure renames at 100% similarity) and **0 added or deleted lines across all 44 paths**, and it
touches no path outside `supabase/migrations/`. `008b_add_is_admin_to_users.sql` — the file whose
name is the defect — is still called `008b_add_is_admin_to_users.sql`. REFAC-01's no-renaming
clause is honoured *by* that distinction, not in spite of it.

## 4. The rule that governs these files from now on

**Content that is still needed is RE-ISSUED as a new post-baseline migration. A file is never
moved back to the top level.**

This is the thing a future reader is most likely to get wrong. Moving a file back would
reintroduce its version into the CLI's view, and every version here either collides with another
file, is already recorded as applied in production, or both. Copy the *statements* into a new
migration with a fresh timestamp; leave the file where it is.

Three files in this directory are **source material** rather than history — their content is
still wanted, and it will arrive as new migrations:

| File | Why it is source material |
|---|---|
| `20260316000004_fk_indexes_and_cleanup.sql` | Never applied in production. Nine `CREATE INDEX IF NOT EXISTS` statements on FK columns plus one `DROP TABLE IF EXISTS public.events_tests`. This is REFAC-02's starting point. **Plan 03-01 measured that production version `20260316101601` declares the same nine index names and the same table drop**, so the baseline is expected to contain all nine already and to lack `events_tests` (F-049); plan 03-05 must verify that against the generated baseline before writing a migration that would do nothing. |
| `20260313000002_recommendation_engine.sql` | Never applied. Carries a **commented-out `cron.schedule(...)` line** that is this repository's only trace of the three live pg_cron jobs (F-042). Plan 03-01 measured `cron.schedule` in **0 of the 45** production history rows, so there is nothing to recover from production either — REFAC-03 must author the schedule from the live catalog, using this line as the raw material. |
| `20260226000001_invitee_select_update_policy.sql` | Its invitee policies are **not live in production** (F-016), so the baseline — which captures production — will not contain them. Club-invitation acceptance is broken in production as a result. If that policy gap is in scope, REFAC-02 must re-add these policies as a **new** migration. |

---

## 5. What this archive did *not* change

- **Production's `supabase_migrations.schema_migrations` is untouched.** All 45 historical
  versions are still recorded as applied there. They are true statements about what happened and
  must never be marked `reverted`; doing so would destroy the only record of the March 2026
  out-of-band burst.
- **Nothing in `src/`, `package.json` or `package-lock.json`.** No application behaviour is
  involved in this change at all.
- **No file's content.** Not one byte inside any `.sql` file here differs from what it held at
  `7d4735f`.
