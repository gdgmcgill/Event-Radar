# Schema fixes — what REFAC-02 and REFAC-03 actually changed, and what they left alone

**Plan:** 03-05 · **Phase:** 03-refactor-foundations-schema-truth-and-the-seam-kit · **Recorded:** 2026-09-15

Plan 03-04 left the repository in a state no previous plan could claim: the migrations folder
replays, and the schema it produces is byte-for-byte production's. That is the precondition this
plan spends. Every object below is a **deliberate addition on top of** that baseline — the first
time in this project's history that a schema change has been made against a known starting state
rather than against a guess.

This note is written in two halves. Sections 1–3 were written with the migrations (task 1) and
record what was added and, as importantly, what was deliberately **not**. Sections 4–6 were
appended after the database was rebuilt and measured (task 3) and record the proof.

---

## 1. What the plan assumed, and what measurement found instead

The plan was authored before plan 03-04's baseline existed. Three of its premises did not survive
contact with the measured schema. All three are recorded here rather than silently worked around.

| Plan premise | Measured reality | What this plan did |
|---|---|---|
| Re-issue the nine FK indexes from the archived `20260316000004_fk_indexes_and_cleanup.sql` | **All nine are already live.** Plan 03-01 measured production history row `20260316101601` declaring the same nine names; plan 03-04 confirmed all nine present in the baseline | **Did not re-issue.** Re-issuing would be dead SQL asserting a fix for a defect that does not exist. The nine names are listed in the migration header so a future reader can re-derive the decision |
| `grep -c "IF NOT EXISTS"` on the new migration is at least 10 — nine FK indexes plus the composite | Six genuinely-missing indexes exist to create, not ten | The count is **6**, and every one of the six covers a column measured to be uncovered. The criterion was arithmetic on a premise that did not hold |
| The FK-index half is the bulk of REFAC-02 | The measured index gaps are **policy-predicate** gaps (F-015, F-020) and **two absent trigram indexes** that `search_events_fuzzy` was written for | The index half is re-aimed at the gaps that are real |

---

## 2. Objects added

### `supabase/migrations/20260915230000_fk_indexes_and_policy_gaps.sql` — REFAC-02

**Six indexes.** Each closes a column measured to be uncovered in the baseline.

| Index | Table (columns) | Closes | Why it is not cosmetic |
|---|---|---|---|
| `idx_events_status_start_date` | `events (status, start_date) WHERE deleted_at IS NULL` | **F-015** | `Approved events are viewable by everyone` is `USING (status = 'approved')` — the single policy governing the entire anonymous event feed. None of `events`' seven existing indexes covers `status`, so every anonymous feed request sequentially scans the largest table in the product. The cost is paid by the database on behalf of an unauthenticated caller. Composite rather than single-column per `rls-review.md` § 5, so it serves the policy predicate and the feed's ordering together; partial on the soft-delete predicate the feed also carries |
| `idx_featured_events_window` | `featured_events (starts_at, ends_at)` | **F-020** | `Public can read active featured events` is `USING (starts_at <= now() AND ends_at > now())` — both halves unindexed, and the read is anonymous |
| `idx_moderation_reviews_author_action` | `moderation_reviews (author_id, action)` | **F-020** | `Creators can appeal their items` checks both columns on the write path; the table's only non-primary index is `(target_type, target_id, created_at)` |
| `idx_recommendation_feedback_event_id` | `recommendation_feedback (event_id)` | `rls-review.md` § 5 adjacent observation | Not policy-referenced, so not a policy-performance finding — but an unindexed foreign-key-shaped column on a table that already carries four other indexes. Recorded there as a REFAC-01 input |
| `idx_events_title_trgm` | `events USING gin (title public.gin_trgm_ops)` | measured gap | **`public.events` carries no trigram index in production.** `public.search_events_fuzzy` calls `similarity()` and the `%` operator against `title` and `description`, so every fuzzy search computes trigram similarity per row in the executor. The archived `20260308000001_fuzzy_search.sql` declared both indexes; its version was never applied, so production runs the function without the indexes it was written for |
| `idx_events_description_trgm` | `events USING gin (description public.gin_trgm_ops)` | measured gap | same |

**One drop.** `DROP TABLE IF EXISTS public.events_tests` — **F-049**. The relation exists in neither
production nor the baseline; it was created out of band and dropped out of band, and its only
repository trace is a hand-edited entry in the generated types file. The drop is re-issued so a
rebuilt environment cannot inherit it from anywhere, and it is a guarded no-op everywhere it is
already absent.

**Three policies on `public.club_invitations`.** — **F-016**.

Production carries exactly two policies on this table, both `is_club_owner(club_id)`: one INSERT,
one SELECT. An invitee can neither see nor accept their own invitation, and
`/api/clubs/[id]/invites` is RLS-reliant, so nothing masks it. **Club-invitation acceptance is
broken in production today.** The content is re-issued from the archived, never-applied
`20260226000001_invitee_select_update_policy.sql`; the archived file itself was not moved or
modified.

| Policy | Command | Gap it closes |
|---|---|---|
| `Invitees can view their own invitations` | SELECT | The invitee's own invitation is invisible to them. Because an UPDATE must first find its row through a SELECT policy, this absence also silently reduces the accept path to zero rows affected |
| `Invitees can accept their own invitations` | UPDATE | The accept transition itself. `USING` scopes the rows an invitee may touch to their own pending invitations; `WITH CHECK` constrains what the row may become |
| `Club owners can update club invitations` | UPDATE | An owner who sent an invitation cannot withdraw it — production grants owners INSERT and SELECT on this table and no UPDATE at all |

**Two deliberate strengthenings over the archived text**, applied under deviation rule 2 and
threat `T-03-05-07`. The archived `WITH CHECK` clauses constrained only the destination `status`.
Both were widened to re-assert ownership:

- `Invitees can accept their own invitations` — `WITH CHECK` now re-asserts the email match as well
  as `status = 'accepted'`. Without it an invitee could rewrite `invitee_email` to someone else's
  address in the same statement that accepts the invitation.
- `Club owners can update club invitations` — `WITH CHECK` now re-asserts `is_club_owner(club_id)`
  as well as `status = 'revoked'`. Without it an owner could reassign the invitation to a club they
  do not own.

This is the `USING`-plus-`WITH CHECK` rule from the RLS basics reference: a `USING` clause decides
which rows you may touch, a `WITH CHECK` clause decides what they may become, and an UPDATE policy
carrying only one of them lets a row be moved out from under its own predicate.

### `supabase/migrations/20260915230100_cron_compute_user_scores.sql` — REFAC-03

One job: `compute-user-scores`, `0 */6 * * *`, `SELECT compute_user_scores()`. Job name, schedule
expression and command are byte-identical to `.planning/audit/async/cron-job.json` — production's
own catalog, read through the AR-12 envelope in plan 01-11 and not re-read here. The schedule is
authored **from the live catalog, never from history**: `cron.schedule` appears in 0 of the 45
production history rows, and the repository's only trace is a commented-out line in the archived,
never-applied `20260313000002_recommendation_engine.sql`.

---

## 3. Policy style: written in the current form, in a tree that mostly is not

Every policy this plan writes:

- **names its target role with a `TO` clause** rather than testing the role inside the predicate.
  The predicate form is deprecated and it breaks silently if anonymous sign-ins are ever enabled,
  because an anonymous user carries the `authenticated` Postgres role and would pass the predicate
  without anyone being signed in (`T-03-05-06`);
- **wraps its auth-uid call in a scalar subquery**, so it is evaluated once per statement rather
  than once per candidate row;
- **carries both a `USING` and a `WITH CHECK` clause on every UPDATE** (§ 2 above);
- **introduces no `SECURITY DEFINER` function.** `is_club_owner` is the baseline's own helper,
  already granted to `authenticated`. Adding a definer function to make a permission error go away
  is prohibited by `T-03-05-08`, because such a function runs with its creator's privileges and
  removes the access check instead of fixing its cause.

Measured, in the migration itself: 3 `CREATE POLICY`, 3 preceding `DROP POLICY IF EXISTS`, 3 `TO`
clauses, 3 auth-uid references and 3 of them wrapped, 0 occurrences of the deprecated role
function.

**The two deprecated forms remain widespread in the inherited policy set and this plan neither
fixes nor propagates them.** 61 of 101 live policies carry no `TO` clause (finding 13) and 68
unwrapped auth-uid occurrences span 59 policies (finding 14). Converting them is a 100-policy
change to a security ring with no test coverage; it belongs to Phase 5, behind the pgTAP matrix.

---

## 4. Deliberately not fixed here

| Left alone | Why | Whose work |
|---|---|---|
| The **41-versus-24 policy divergence** (`rls-review.md` § 6, finding 7) — 41 live policies declared by no migration, 24 declared policies absent from production | 60 policies wide. REFAC-02's text names the audit-identified gaps, and the wider reconciliation needs the pgTAP matrix underneath it first | **Phase 5** |
| The other two live cron jobs — `send-event-reminders` (`*/15 * * * *`) and `send-feedback-requests` (`*/30 * * * *`) | REFAC-03 names `compute_user_scores` only. Both remain production-only, so **F-042 is narrowed by this plan, not closed** | **Phase 5** |
| **F-037** — two dead Next.js cron handlers duplicating live pg_cron functions with four behavioural divergences | Adjacent to REFAC-03 but it is a source-code finding, and this plan modifies no application source | **Phase 5** |
| **F-017** — experiment reads return zero rows for every non-admin caller | A policy gap the audit named, but it is part of the § 6b divergence set rather than a standalone fix, and closing it needs the A/B path characterized first | **Phase 5** |
| The two deprecated policy forms across 100 inherited policies (findings 13, 14) | § 3 above | **Phase 5** |
| **F-049**'s other half — the `events_tests` entry in the generated types file | This plan drops the relation; regenerating `types.ts` is REFAC-04's type-drift gate | **plan 03-06** |
| The production history repair | D-02's gated decision, deferred by plan 03-04 | **plan 03-08** |

**pgTAP is a local-time control only.** `.planning/audit/async/extensions.json` records pgTAP as
available but **not installed in production**, and this plan does not install it there. The
extension is created inside the local test database by `supabase/tests/database/000-setup.sql`, and
the suite runs against `--local`. These tests prove the policies behave correctly in a database
built from the repository. They assert nothing about the running production database, and no claim
in this note should be read as one.

---

## 5. The diff against production, accounted for line by line

`evidence/db-diff.after-fixes.sql` — `supabase db diff --linked --schema public,storage`, exit 0,
captured after the fixes and after the AR-12 envelope in
`evidence/transport-identity.03-05.json` (`supabase_read_only_user`, `transaction_read_only = on`).

Plan 03-04 left this diff at **zero bytes**. It is nine statements now, and that is the intended
outcome rather than a regression: this plan deliberately adds nine objects production does not
have. **The criterion is accountability, not emptiness.** Read the direction carefully —
`db diff --linked` emits the statements that would transform the LOCAL schema INTO the remote one,
so a `drop` below means *production lacks this*, not *something wants to delete it*.

| # | Statement in the diff | Added by | Closes |
|---|---|---|---|
| 1 | `drop policy "Club owners can update club invitations" on "public"."club_invitations"` | `20260915230000` § 4 | F-016 |
| 2 | `drop policy "Invitees can accept their own invitations" on "public"."club_invitations"` | `20260915230000` § 4 | F-016 |
| 3 | `drop policy "Invitees can view their own invitations" on "public"."club_invitations"` | `20260915230000` § 4 | F-016 |
| 4 | `drop index if exists "public"."idx_events_description_trgm"` | `20260915230000` § 2 | measured trigram gap |
| 5 | `drop index if exists "public"."idx_events_status_start_date"` | `20260915230000` § 1 | F-015 |
| 6 | `drop index if exists "public"."idx_events_title_trgm"` | `20260915230000` § 2 | measured trigram gap |
| 7 | `drop index if exists "public"."idx_featured_events_window"` | `20260915230000` § 1 | F-020 |
| 8 | `drop index if exists "public"."idx_moderation_reviews_author_action"` | `20260915230000` § 1 | F-020 |
| 9 | `drop index if exists "public"."idx_recommendation_feedback_event_id"` | `20260915230000` § 1 | `rls-review.md` § 5 |

**Nine statements, nine additions, one-to-one.** Nothing appears in the diff that this plan did not
put there. If anything had, the baseline or the migrations would be wrong and the diff would be the
evidence — which is why it is captured rather than assumed.

**Two absences that are correct, recorded so they are not read as misses:**

- `DROP TABLE IF EXISTS public.events_tests` produces no diff entry, because the relation exists in
  neither environment. It is a guarded no-op by design.
- The `cron.job` row is not in the diff either. `cron` is not one of the two schemas diffed, and
  pg_cron's job catalog is not schema DDL in any case. That job is proven by
  `evidence/cron-idempotence.txt` and `030-cron-schedule.test.sql` instead.

**The diff is a measurement, not a problem to be closed.** It is not closed by pushing these
objects to production. This plan issued exactly one production operation — the read above — and the
gated production repair remains D-02's decision for plan 03-08.

---

## 6. The proof

| Artifact | What it establishes |
|---|---|
| `evidence/db-reset.after-fixes.txt` | Two consecutive `supabase db reset --local` runs, both exit 0. The skip-line tripwire reads 0 on both transcripts and `supabase migration list --local` shows all three versions applied — because a reset can be green while a migration silently did not run |
| `evidence/pgtap-run.txt` | `supabase test db --local`, exit 0, **47 assertions across 4 files** against a freshly reset database |
| `evidence/pgtap-mutation-check.txt` | The one that matters. Each of the three new policies commented out in turn: the suite went red by **asserting** — 5, 3 and 1 named failures respectively — and green again on restore. `failures=0`, `migrations_dir_clean=true` |
| `evidence/cron-idempotence.txt` | Two reset rounds, each with `compute_user_scores_job_count=1` on the same expression. The unschedule-then-schedule guard is doing work, not decorating |
| `evidence/db-diff.after-fixes.sql` | § 5 above |
| `evidence/transport-identity.03-05.json` | The AR-12 envelope captured immediately before the single production read |

**Why the mutation check is a deliverable and not a ritual.** `02-REVIEW.md` finding WR-04 caught a
Phase 2 suite whose assertions could not fail when the behaviour they preserved was removed. Green
was worthless there, and it would be worthless here for a sharper reason: RLS denial has two
shapes — a raised error and a silent zero-row filter — and the obvious assertion notices only one.
`scripts/pgtap-mutation-check.sh` checks **two** failure modes rather than one. A policy whose
removal leaves the suite green is reported as a decorative test. And a policy whose removal makes
the suite fail to *parse* rather than to *assert* is reported as proving nothing — the harness
requires pg_prove to have produced real test results with a real failure count before it will
accept a red. All three policies recorded `RED_ASSERTION`.

The harness restores by checking the file out of git rather than by re-editing, and refuses to exit
0 if `supabase/migrations/` is dirty afterwards. A hand-restoration across several rounds is how a
stray character survives into a committed migration.

---

## 7. A tripwire that matched its own documentation

The plan's acceptance criteria grep this evidence directory for the CLI's schema-push subcommand,
to prove no push was performed. Three files written by earlier plans — `ports-preflight.txt`
(03-01), and `baseline-review.md` and `reconciliation-note.md` (03-04) — contain the literal
**while asserting that the command was not run**. The grep therefore reports hits for prose that
says the opposite of what the grep is looking for.

This plan's own two new captures are written to reference the subcommand rather than spell it out,
so they read 0. The three inherited files are left alone: rewriting another plan's committed
evidence to satisfy a grep would be worse than the grep being imprecise. The underlying fact is
unambiguous and is stated here instead — **no push, no linked history repair, no remote pull, no
history fetch, and no write of any kind was issued against production by this plan.** Its only
production operation was the read in § 5, under the envelope in
`evidence/transport-identity.03-05.json`.

It is the same class of defect plan 03-04 named when it wrote that evidence files should cite their
assertion patterns by reference so a tripwire cannot match itself. Worth carrying into Phase 5's
criteria.

