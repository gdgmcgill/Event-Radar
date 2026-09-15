# Migration reconciliation — what was fixed, what was not, and what is left for a human

**Plan:** 03-04 · **Phase:** 03-refactor-foundations-schema-truth-and-the-seam-kit · **Recorded:** 2026-09-15

REFAC-01 asked for two things that looked mutually exclusive: never rename an existing migration
file, and make `supabase db reset` replay the folder cleanly. This note records how both now hold,
and — more importantly — the parts of production that this reconciliation deliberately did **not**
touch.

---

## 1. Before and after, in numbers

| | Before | After |
|---|---|---|
| Files at the top level of `supabase/migrations/` | **44** | **1** |
| Distinct versions among them | **39** (44 files collapse) | 1 |
| Collision groups | **4**, covering **9 files** | 0 |
| Filenames the CLI passes over in silence | **1** (`008b_add_is_admin_to_users.sql`) | 0 |
| `supabase db reset` | **aborts at the 12th applied file** — `Key (version)=(011) already exists` | **exit 0**, one migration, nothing passed over |
| `supabase db diff --linked --schema public,storage` | **unusable** — it builds its shadow by replaying exactly these files | **zero bytes** — "No schema changes found" |
| Files renamed or renumbered | — | **0** |

The four collision groups, named because "four groups covering nine files" is otherwise unverifiable:

| Colliding version | Files |
|---|---|
| `008` | `008_event_source_tracking.sql`, `008b_add_is_admin_to_users.sql` |
| `011` | `011_event_images_bucket.sql`, `011_rls_audit.sql` |
| `20260305000002` | `20260305000002_email_reminder_log.sql`, `20260305000002_phase1_club_rls_and_schema.sql` |
| `20260306` | `20260306_add_user_profile_fields.sql`, `20260306_create_event_invites.sql`, `20260306_create_user_follows.sql` |

`011` is the group that produced the abort. Note that `008b` sits in the `008` group *and* is the
unparseable name — it is both defects at once, which is why it is the file F-047 and F-043 both point
at.

**The mechanism was a move, not a rename.** All 44 files went into `_archive_pre_baseline/`
byte-identical and name-identical; git recorded 44 `R100` renames and **zero changed lines**
(`evidence/archive-rename-diff.txt`). The Supabase CLI reads only the top level, so the collisions
became inert historical record without one character of one filename changing. REFAC-01's no-renaming
clause is honoured **by** that distinction, not in spite of it.

### The three-set arithmetic, derived rather than transcribed

```
archived_files=44   distinct_local_versions=39   prod_history_rows=45
overlap=27          local_only=12                remote_only=18
```

Computed by subtracting the leading-digit version of each archived filename from the 45 versions in
production's history. It reproduces plan 03-01's figures exactly, by an independent route.

---

## 2. The twelve never-applied files — nearly all of their effects are already live

The plan asks which of the twelve local-only versions had effects already in production and therefore
inside the baseline. The answer is **ten of the twelve, completely; one partially; one not at all.**

**Five were applied out of band under a different version number** — the same change, a different
timestamp, which is the whole shape of the March burst:

| Never-applied local file | Applied in production as |
|---|---|
| `20260315000001_moderation_reviews.sql` | `20260315231016` `moderation_reviews` |
| `20260315000002_soft_delete.sql` | `20260316002951` `soft_delete` |
| `20260316000001_feedback_request_log.sql` | `20260316091643` `feedback_request_log` |
| `20260316000002_event_reports.sql` | `20260316051022` `create_event_reports` |
| `20260316000004_fk_indexes_and_cleanup.sql` | `20260316101601` `fk_indexes_and_cleanup` |

**Five more match no production version by name, but every object they declare is nonetheless present
in the baseline** — applied by some route that left no matching history row:

| File | Objects declared | Present in the baseline |
|---|---|---|
| `20260308000002_admin_audit_log.sql` | `admin_audit_log` + 3 indexes | **4 / 4** |
| `20260308000003_time_of_day_filter.sql` | `get_event_ids_by_time_filter()` | **1 / 1** |
| `20260308000004_content_hash_dedup.sql` | `content_hash` column | **1 / 1** |
| `20260313000001_featured_events.sql` | `featured_events` + 1 index | **2 / 2** |
| `20260313000002_recommendation_engine.sql` | `user_event_scores`, `tag_interaction_counts`, `compute_user_scores()`, `inferred_tags`, 1 index | **5 / 5** |
| `20260316000003_audit_fixes.sql` | `featured_clubs` + 2 indexes | **3 / 3** |

**One is partial, and it is a real defect rather than a bookkeeping curiosity.**
`20260308000001_fuzzy_search.sql` declares three objects. The function is live; **both indexes are
not**:

| Object | In production |
|---|---|
| `search_events_fuzzy()` | **LIVE** |
| `idx_events_title_trgm` — `GIN (title gin_trgm_ops)` | **ABSENT** |
| `idx_events_description_trgm` — `GIN (description gin_trgm_ops)` | **ABSENT** |

Production's `public.events` carries exactly five indexes — `idx_events_category`,
`idx_events_club_id`, `idx_events_created_by`, `idx_events_not_deleted`, `idx_events_start_date` —
**and not one of them is a trigram index.** Meanwhile `search_events_fuzzy` calls `similarity()` and
sets `pg_trgm.similarity_threshold = 0.1`. **Every fuzzy search in production today is a sequential
scan over `events` computing trigram similarity per row.** It is correct and it is slow, and it gets
slower with every event added. This was invisible before the baseline existed because there was
nothing to compare the archived file against.

### The two files whose content is re-issued as new work in plan 03-05

1. **`20260308000001_fuzzy_search.sql`** — the two missing trigram GIN indexes above. This is now the
   strongest candidate for REFAC-02's first migration, and it is a *measured* gap rather than a
   suspected one.
2. **`20260226000001_invitee_select_update_policy.sql`** — its three policies are live in neither
   production nor the baseline (**F-016**). `public.club_invitations` has exactly two policies, both
   for club owners: `Club owners can create club invitations` and `Club owners can view club
   invitations`. **An invitee can neither see nor accept their own invitation** — club-invitation
   acceptance is broken in production. Re-adding these is REFAC-02 work.

And the file that is explicitly **not** re-issued: `20260316000004_fk_indexes_and_cleanup.sql`. All
nine of its FK indexes are present in the baseline and `events_tests` is already gone, so a migration
re-issuing it would be a no-op. Plan 03-05 should confirm and skip it rather than write it.

`20260313000002_recommendation_engine.sql` remains source material for a different reason: its
commented-out `cron.schedule(...)` line is this repository's only trace of the live cron jobs. See § 3.

---

## 3. What production still holds that this reconciliation did not change

**This is the section most likely to be misread, so it is stated bluntly: the baseline is a
photograph of production. A photograph of a door does not lock it.**

### Production's migration history table — untouched

`supabase_migrations.schema_migrations` still holds its 45 rows and **has no row for the baseline
version `20260915214553`**. Nothing in this plan wrote to it. That is not an oversight; it is the
reason **D-15** chose `supabase db dump --linked` over `supabase db pull --linked`. The CLI documents
that `db pull` *may record* the pulled migration in the remote history — precisely the production
write that D-02 gates and that T-03-04-04 prohibits. `db dump` is a pure `pg_dump` read and cannot
write at all.

### Policies, buckets and cron jobs created outside migrations

| Object | State | What the baseline does and does not do |
|---|---|---|
| **41 of 101 RLS policies** declared by no migration (F-012) | Live | All 101 are now **in** the baseline — verified by set difference, not by eye (`policy-census-crosscheck.txt`, symmetric difference **0**). From here they are under version control. This is the one item that genuinely moved from uncontrolled to controlled. |
| **3 storage buckets** — `avatars`, `banners`, `club-logos` — created in the dashboard (F-035) | Live | **Not** captured. The baseline carries storage *policies* only; `config.toml`'s `[storage.buckets.*]` block is still entirely commented out. A `db reset` produces a local database with **no buckets in it**. Anything downstream assuming a bucket exists locally must create it. |
| **3 pg_cron jobs** — `send-event-reminders` `*/15 * * * *`, `compute-user-scores` `0 */6 * * *`, `send-feedback-requests` `*/30 * * * *`, all active (F-042) | Live | **Not** captured. The dump is scoped to `public,storage`; `cron.schedule` appears **0 times** in the baseline, and plan 03-01 measured it in **0 of the 45** production history rows. There is nothing to recover from either side. REFAC-03 must author the schedule from the live catalog. |
| **The storage schema's structure** — 10 tables, the `buckettype` enum, its functions | Live, service-owned | Deliberately **not** carried — see D-16 in `db-reset.txt`. It is created identically by the storage service in every environment and is not replayable by the migration role. The empty `db diff` is what proves local and production agree on it. |

### Vercel

Untouched and unclaimed. The project is not git-linked, a push does not deploy, and this plan makes no
claim about deployed behaviour.

---

## 4. The deferred production repair — D-02's position, in writing

**The one remaining production write is `supabase migration repair --status applied 20260915214553
--linked`.** It would insert a single row into production's history table recording that the baseline
version is applied. It is one call, and it is the only production write anywhere in this phase.

**It was not performed by this plan, and the plan is complete without it.**

- **Nothing in Phase 3's success criteria requires it.** REFAC-01's criterion is a reset that replays
  and a diff that is empty. Both are met, and both are verified against a database — neither depends
  on production's history table containing anything in particular.
- **It is gated behind a `checkpoint:decision` in plan 03-08, with `autonomous: false`,** per D-02.
  That gate exists because the write is irreversible in the way that matters: it changes the record of
  what production has run.
- **Declining it is an acceptable outcome and does not fail the phase.** 03-RESEARCH.md § Open
  Questions Q2 says so explicitly. If declined, the repair defers to **Phase 8's deployment
  certification**, and this sentence is that written deferral.
- **What it costs to defer:** a future `supabase db push` would try to apply the baseline to
  production, because production's history has no row saying it is already applied. Since the baseline
  *is* production's schema, that push would be redundant at best and destructive at worst. **So while
  the repair is outstanding, `db push` must not be run against production at all.** Deferring the
  repair is safe; deferring it and then pushing is not. Phase 8 owns resolving this before any
  deployment path depends on `db push`.

### The 45 historical versions are never to be marked reverted — under any option

**Whatever is decided in plan 03-08, `supabase migration repair --status reverted` must never be run
against the 45 historical production versions.**

They are true statements about what happened. Eighteen of them are the *only* surviving record of the
March 2026 out-of-band burst — there is no file in this repository for any of them, which is why this
plan recovered their `statements` into
`supabase/migrations/_archive_pre_baseline/recovered/` as documentation. Marking them reverted would
assert that changes which demonstrably did run did not, and would destroy that record for nothing.

It would also buy nothing. Once the baseline version is marked applied, `db push` ignores the older
versions anyway. The only effect of reverting them is the loss of the history.

---

## 5. The recovered history — the optional step, taken

Plan 03-01's Open Question **Q1** asked whether production's history rows carry usable SQL. The
measured answer was **yes: all 18 remote-only versions have `statements` populated**, with names and
full SQL. The plan makes the recovery step conditional on that answer, so it was performed.

All 18 are written to `supabase/migrations/_archive_pre_baseline/recovered/`, one file per version,
each with a one-line header naming its version and stating that it is recovered history and not a
migration. They carry a `.sql.recovered` suffix so that the CLI could not read them as migrations even
from the top level, and they sit two directories below the only level the CLI scans.

Asserted, not assumed: **the baseline is unchanged by this step, nothing was placed at the top level
(still exactly 1 `.sql`), the filename check still exits 0, and the diff is still zero bytes.** All 18
files were swept for JWT, token-prefix, secret-key-prefix, connection-string and bearer shapes, plus
`api_key` / `secret` / `password` / `token` wording — **0 matches across all 18**.

---

## 6. Standing rule for the archived files

**Content that is still needed is RE-ISSUED as a new post-baseline migration. A file is never moved
back to the top level.** Both `_archive_pre_baseline/README.md` and `recovered/README.md` state it,
and § 2 above names the two files whose content is genuinely wanted and the one that would be a no-op.

The reason is mechanical, not stylistic: every archived version either collides with another archived
version or is already applied in production under some version, so moving one back reintroduces
exactly the defect this plan removed.
