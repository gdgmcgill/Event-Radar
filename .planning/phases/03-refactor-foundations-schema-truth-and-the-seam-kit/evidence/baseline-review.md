# Baseline review — production's schema, checked by count and by name

**Plan:** 03-04 · **Phase:** 03-refactor-foundations-schema-truth-and-the-seam-kit · **Recorded:** 2026-09-15

**Subject:** `supabase/migrations/20260915214553_baseline.sql` — 4081 lines, 140,271 bytes, the only
`.sql` file at the top level of `supabase/migrations/`.

This review exists because the baseline is the moment the repository stops describing a database it
does not have and starts describing the one that is live. Whatever the baseline omits silently stops
being under version control — that is threat row **T-03-04-05**, and it is why the second pass below
is a programmatic set difference rather than a reading.

---

## 0. How the baseline was produced — and the decision that changed the command

**The baseline was produced by `supabase db dump --linked --schema public,storage`,** written into a
file created by `supabase migration new baseline`. It was **not** produced by `supabase db pull`.

```
$ supabase migration new baseline
  → supabase/migrations/20260915214553_baseline.sql   (0 bytes)

$ supabase db dump --linked --schema public,storage -f supabase/migrations/20260915214553_baseline.sql
  Dumped schema to /…/supabase/migrations/20260915214553_baseline.sql.
```

### D-15 — the baseline is dumped, not pulled

**Decision:** produce the baseline with `supabase db dump --linked`, never `supabase db pull --linked`.

**Why the plan's own command was not used.** 03-RESEARCH.md § Pattern 1 step 2 and the plan's
`<read_first>` both name `supabase db pull baseline --linked` as the mechanism. The first executor of
this plan stopped at a checkpoint on exactly this point, and the orchestrator decided against it:
the CLI documents that `db pull` **may record the pulled migration in the remote history table**.
That write lands in production's `supabase_migrations.schema_migrations` — which is

- the precise production write **D-02** gates behind a decision checkpoint in plan 03-08,
- prohibited by name in this plan's threat row **T-03-04-04**, and
- irreversible in the sense that matters: it would make the deferred repair decision *for* the
  human who is supposed to make it.

`db dump` is a pure `pg_dump` read. It cannot write to the history table because it does not write
at all. The two routes are not a compromise: 03-RESEARCH.md § **Assumptions Log A1** already rates
the `db pull` mechanic as the one unverified step on the critical path (**High**) and names
`db dump --linked --schema public,storage` as *"the documented fallback that produces the same DDL by
a different route."* A1's mitigation is the route that was taken. The assumption was therefore never
load-bearing, and A1 can be closed as **routed around rather than verified**.

**Confirmed after the fact:** production's migration history is untouched. Nothing in this plan wrote
to it, and the reconciliation note records that explicitly.

### The link, and what it took

```
$ supabase link --project-ref <PROD-PROJECT-REF>
  {"project_ref":"<PROD-PROJECT-REF>","message":""}   exit 0
```

The link succeeded on the CLI's **default pooler path on the first attempt**. `--skip-pooler` was
prepared as a contingency — `supabase status` reports the *local* containers
`supabase_pooler_Event-Radar` and `supabase_imgproxy_Event-Radar` as stopped — and was **not needed**,
because the local pooler container and the remote pooler the link dials are different things. Recorded
here because the preceding checkpoint flagged it as a likely failure mode and a later reader should
know it did not fire.

### Credentials — where they lived and where they did not

| Credential | Source | Where it went |
|---|---|---|
| Management API token | macOS keychain, service `Supabase CLI` (the method 03-01-SUMMARY § Deviations 3 established) | `process.env` of one uncommitted scratchpad shim, for the AR-12 envelope only |
| Database password | macOS keychain, service `Event-Radar DB password` | `SUPABASE_DB_PASSWORD` in the shell, read in the same command that used it |

The password was **never** passed as `-p` / `--password`, which the CLI accepts and which would put it
in shell history; the CLI reads the environment variable. Neither value was written to any file, any
evidence capture, or any commit. `.env.local` was not opened. `SUPABASE_DB_PASSWORD` is unset when the
plan ends.

### AR-12 — the envelope, captured before the read

`evidence/transport-identity.03-04.json` reads `txn_read_only: "on"`, `role: supabase_read_only_user`.

```
envelope mtime  2026-09-15T17:45:25Z
baseline mtime  2026-09-15T17:46:44Z
envelope_precedes_baseline=true
delta_seconds=79.5
```

A fresh capture rather than a reuse of 03-01's: AR-12's clause is **per-read**, and a stale envelope
proves nothing about a later connection.

---

## 1. First pass — the four-point object check

Each of the four is resolved to a real finding id from `.planning/audit/findings.json` by its
description, not transcribed from prose.

| # | Expectation | Finding | Command | Result |
|---|---|---|---|---|
| 1 | The baseline **must contain** the `rsvps` table | **F-044** — *"The rsvps table is created by no migration, yet policies are written for it and code reads it"* | `grep -cE 'CREATE TABLE (IF NOT EXISTS )?"?public"?\."?rsvps"?'` | **1** — present ✅ |
| 2 | The baseline **must not contain** `user_engagement_summary` | **F-048** — *"user_engagement_summary is created by a migration and does not exist in production"* | `grep -ci 'user_engagement_summary'` | **0** — absent ✅ |
| 3 | The baseline **must not contain** `events_tests` | **F-049** — *"events_tests exists only in types.ts — created out of band, dropped out of band, its cleanup migration never applied"* | `grep -ci 'events_tests'` | **0** — absent ✅ |
| 4 | The baseline **must not contain** a `users.is_admin` **column** | **F-047** — *"users.is_admin is declared only by the one migration file the CLI silently skips"* | `grep -cE '^\s+"?is_admin"?\s+boolean'` | **0** — absent ✅ |

**Point 4 needs its distinction stated, because a careless grep inverts the answer.** The string
`is_admin` appears **11 times** in the baseline. Every one of them is the
`public.is_admin()` **function** — its definition at line 311, its `ALTER … OWNER` at 322, six RLS
policies that call it, and three `GRANT` lines. **Not one is a column on `users`.** That is exactly
the state F-047 predicts: `008b_add_is_admin_to_users.sql` is the file the CLI skips silently with
exit status 0, so the column it declares was never applied in production, while the `is_admin()`
helper that arrived by a different route is very much alive. The two are unrelated objects that share
a name, and conflating them would report a passing check as a failure.

All four findings are confirmed *by the baseline* rather than merely by the Phase 1 census — an
independent second measurement of each, taken through a different transport on a different day.

---

## 2. Second pass — the policy census, by count and by name

This is the pass that matters. **41 of production's 101 RLS policies are declared by no migration at
all** (F-012), so there is no local text to compare against and an eye check is structurally
insufficient: the reviewer would have nothing to check against except the file being reviewed.

Both sides were reduced to `schema.table :: policyname` pairs and diffed as sets. Full sorted sets,
producing commands and the difference are in **`evidence/policy-census-crosscheck.txt`**.

```
live_policy_count=101
baseline_policy_count=101
symmetric_difference_count=0
```

- **Live authority:** `.planning/audit/rls/pg_policies.json`, 101 rows captured 2026-09-14 through the
  Management API.
- **Baseline:** parsed with `/^CREATE POLICY "((?:[^"]|"")+)" ON "([^"]+)"\."([^"]+)"/gm` — anchored,
  quote-aware, and tolerant of embedded doubled quotes in policy names.

### The symmetric difference is empty

**Every one of the 101 live production policies is present in the baseline, on the same table, under
the same name. Nothing was dropped and nothing was invented.**

The plan requires every entry in the symmetric difference to be explained individually by name rather
than summarised. **There are no entries to explain.** This is the strongest outcome the check can
produce, and it is worth saying why it was not assumed: the census was taken on 2026-09-14 and the
baseline on 2026-09-15, so a non-empty difference would have been *legitimate* — production is a live
system and could have moved between the two captures. It did not. The count agreeing at 101 is
necessary but not sufficient on its own; the name-and-table set agreeing is the actual result.

**T-03-04-05 is mitigated by measurement, not by intention.**

---

## 3. What the baseline *captures* without thereby *controlling*

A later reader must not be able to mistake one for the other. The baseline is a photograph of
production. A photograph of a door does not lock it.

| Object | State | Why capture ≠ control |
|---|---|---|
| **Production's migration history table** | `supabase_migrations.schema_migrations`, 45 rows, **completely unchanged by this plan** | Nothing here wrote to it — that is why D-15 chose `db dump` over `db pull`. Production still has no row for version `20260915214553`. Until one exists, a future `supabase db push` would not know the baseline is applied. That single write is D-02's gated decision, deferred to plan 03-08. |
| **The three storage buckets** — `avatars`, `banners`, `club-logos` | Created **in the dashboard**, not by a migration (F-035). `config.toml`'s `[storage.buckets.*]` block is entirely commented out. | The baseline dumps the `storage` **schema** — `storage.buckets` and its seven sibling tables appear as DDL at lines 2070–2200. `grep -ci 'INSERT INTO .*storage.*buckets'` returns **0**: the dump carries the table *structure*, not the bucket *rows*. A `db reset` therefore produces the schema with **no buckets in it**. Anything downstream that assumes a bucket exists locally must create it; the repository does not. |
| **The three pg_cron jobs** — `send-event-reminders` (`*/15 * * * *`), `compute-user-scores` (`0 */6 * * *`), `send-feedback-requests` (`*/30 * * * *`) | All live, all `active: true`, all succeeding in production (F-042) | The dump is scoped to `public,storage`. The `cron` schema is **not** in it: `grep -ci 'cron\.schedule'` returns **0** and `grep -ci 'CREATE SCHEMA.*cron'` returns **0**. The jobs run in production regardless of anything in this repository. Plan 03-01 separately measured `cron.schedule` in **0 of the 45** production history rows, so there is nothing to recover from production either. REFAC-03 must author the schedule from the live catalog. |

The honest summary: **this plan makes the repository able to reproduce production's `public` and
`storage` schemas. It does not put production's configuration under version control, and it does not
change one byte of production.**

---

## 4. Carry-forwards measured against the baseline

Three findings from Wave 1 were stated as predictions about a baseline that did not yet exist. All
three are now measured against the real file. Plan **03-05** inherits them.

**1. The nine FK indexes are already live — REFAC-02's starting point has moved.**
`20260316000004_fk_indexes_and_cleanup.sql` (archived, never applied under that version) declares nine
`CREATE INDEX IF NOT EXISTS` statements and one `DROP TABLE IF EXISTS public.events_tests`. Plan 03-01
measured that production version `20260316101601` declares the same nine names. **All nine are present
in the baseline:**

```
idx_club_invitations_inviter_id     1
idx_event_reports_reviewed_by       1
idx_featured_clubs_club_id          1
idx_featured_clubs_created_by       1
idx_featured_events_created_by      1
idx_feedback_user_id                1
idx_notifications_club_id           1
idx_organizer_requests_reviewed_by  1
idx_users_banned_by                 1
```

…and `events_tests` is absent (point 3 above). **Re-issuing that file's content as a new migration
would be a no-op.** Plan 03-05 must confirm this before writing one, exactly as the archive README
instructs.

**2. The invitee policies are genuinely absent — a real production gap, not a dump artifact.**
`20260226000001_invitee_select_update_policy.sql` declares three policies. **None is in the baseline:**

| Policy name | Occurrences in baseline |
|---|---|
| `Invitees can view their own invitations` | 0 |
| `Invitees can accept their own invitations` | 0 |
| `Club owners can update club invitations` | 0 |

`public.club_invitations` carries exactly two live policies — `Club owners can create club invitations`
(INSERT) and `Club owners can view club invitations` (SELECT). **An invitee can neither see nor accept
their own invitation.** This is **F-016**, confirmed against production's own schema. Club-invitation
acceptance is broken in production today. If closing that gap is in scope, REFAC-02 must add these as
a **new** migration — never by moving the archived file back.

**3. There is no repository trace of the cron schedule to recover.** As in § 3 — `cron.schedule`
appears 0 times in the baseline and 0 times in the 45 production history rows. The commented-out line
in the archived `20260313000002_recommendation_engine.sql` remains REFAC-03's only raw material.

---

## 5. Deliberately not done

- **`supabase/seed.sql` was not created.** `test ! -e supabase/seed.sql` succeeds. `config.toml`'s
  `[db.seed] sql_paths = ["./seed.sql"]` points at a path that does not exist, which is harmless. A
  stray file there would execute inside **every** `db reset` and would falsify the seed loader's
  determinism claim in plan 03-07 before it is written (**T-03-04-10**).
- **The archive was not disturbed.** `git status --porcelain supabase/migrations/_archive_pre_baseline/`
  is empty. Exactly one `.sql` file is at the top level and it is the baseline.
- **No production write of any kind.** No `db push`, no `migration repair`, no `db pull`,
  no `migration fetch`.
- **The baseline was not hand-edited.** It is generated output. Editing it would make it a claim about
  production rather than a copy of it, and the `db diff` gate in task 3 is what tests that claim.

---

## 6. Sweep

The baseline and every evidence file this plan writes were swept with the four credential shapes
enumerated in `.planning/audit/REDACTION.md` § *The five shapes* — the JWT shape, the Supabase
personal-access-token prefix, the Supabase secret-key prefix, and a connection string carrying a
password — plus a fifth pattern for the literal production project ref. **Every file returned 0 on
every pattern, and 0 of them merely matched the shape either.**

The patterns themselves are cited by reference rather than inlined here, deliberately: writing the
bare prefixes into this file would make it match the sweep it is reporting on, which is how a
redaction ledger starts lying about itself. `.planning/audit/REDACTION.md` is the single authority
for the pattern set.

The production ref appears in no committed artifact from this plan; `<PROD-PROJECT-REF>` is written
throughout, per that same ledger.
