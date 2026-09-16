---
phase: 03-refactor-foundations-schema-truth-and-the-seam-kit
reviewed: 2026-09-16T03:34:25Z
depth: standard
files_reviewed: 74
files_reviewed_list:
  - .github/workflows/ci.yml
  - e2e/auth.setup.ts
  - e2e/env.ts
  - e2e/fixtures.ts
  - e2e/specs/admin-login-cookie-equivalence.spec.ts
  - e2e/specs/admin-moderation-queue.spec.ts
  - e2e/specs/anonymous-browse.spec.ts
  - e2e/specs/banned-redirect.spec.ts
  - e2e/specs/club-owner-surfaces.spec.ts
  - e2e/specs/protected-route-redirect.spec.ts
  - e2e/specs/save-and-rsvp.spec.ts
  - eslint.config.mjs
  - eslint.elevated-allowlist.mjs
  - playwright.config.ts
  - scripts/check-elevated-ratchet.mjs
  - scripts/check-migration-filenames.mjs
  - scripts/pgtap-mutation-check.sh
  - scripts/seed/clock.ts
  - scripts/seed/guard.ts
  - scripts/seed/load.ts
  - scripts/seed/personas.ts
  - scripts/seed/prng.ts
  - src/__tests__/api/events/friends-defect.test.ts
  - src/__tests__/moderation/audit-shape.test.ts
  - src/__tests__/seed/guard.test.ts
  - src/app/api/admin/audit-log/route.ts
  - src/app/api/admin/featured/[id]/route.ts
  - src/app/api/admin/featured/route.ts
  - src/app/api/clubs/featured/route.ts
  - src/app/api/clubs/friends/route.ts
  - src/app/api/events/[id]/friends/route.ts
  - src/app/api/events/[id]/invite/route.ts
  - src/app/api/events/featured/route.ts
  - src/app/api/events/friends-activity/route.ts
  - src/app/api/events/friends-organizing/route.ts
  - src/app/api/events/route.ts
  - src/app/api/profile/inferred-tags/route.ts
  - src/app/api/profile/interests/route.ts
  - src/app/api/users/[id]/follow/route.ts
  - src/app/api/users/me/friends/route.ts
  - src/app/api/users/me/requests/route.ts
  - src/app/api/users/saved-events/route.ts
  - src/app/api/users/search/route.ts
  - src/app/auth/callback/route.test.ts
  - src/app/moderation/page.tsx
  - src/app/onboarding/page.tsx
  - src/app/profile/page.tsx
  - src/app/users/[id]/page.tsx
  - src/lib/audit.ts
  - src/lib/supabase/types.ts
  - src/server/__tests__/context.test.ts
  - src/server/__tests__/elevated.test.ts
  - src/server/__tests__/errors.test.ts
  - src/server/__tests__/http.test.ts
  - src/server/__tests__/requireClubRole.test.ts
  - src/server/__tests__/requireRole.test.ts
  - src/server/__tests__/requireUser.test.ts
  - src/server/authz/requireClubRole.ts
  - src/server/authz/requireRole.ts
  - src/server/authz/requireUser.ts
  - src/server/context.ts
  - src/server/db/elevated/REGISTRY.md
  - src/server/db/elevated/index.ts
  - src/server/errors.ts
  - src/server/http.ts
  - supabase/migrations/20260915214553_baseline.sql
  - supabase/migrations/20260915230000_fk_indexes_and_policy_gaps.sql
  - supabase/migrations/20260915230100_cron_compute_user_scores.sql
  - supabase/migrations/_archive_pre_baseline/README.md
  - supabase/tests/database/000-setup.sql
  - supabase/tests/database/010-fk-indexes.test.sql
  - supabase/tests/database/020-rls-policy-gaps.test.sql
  - supabase/tests/database/030-cron-schedule.test.sql
  - supabase/tests/database/040-seed-coverage.test.sql
findings:
  critical: 5
  warning: 12
  info: 9
  total: 26
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-09-16T03:34:25Z
**Depth:** standard
**Files Reviewed:** 74
**Status:** issues_found

## Summary

The seam kit (`src/server/**`), the cast-removal pass, the seed/persona harness and the
pgTAP suite are, mechanically, high-quality work: `npx tsc --noEmit` is clean, `npm run lint`
reports 0 errors, `npx jest --ci` is 348 passed / 0 failed, `node scripts/check-elevated-ratchet.mjs`
reports `committed=24 live=24 delta=0`, and `node scripts/check-migration-filenames.mjs` passes.
The guards fail closed, `requireClubRole` genuinely cannot be bypassed by a site-wide role
(it reads one table), the error/success vocabularies are byte-preserving, and the pgTAP
assertions do assert behaviour rather than `lives_ok`.

The defects are not in the mechanics. They are in the **boundaries of the controls** and in
**what the schema baseline codified without review**:

1. The baseline migration — now the repository's declared schema truth — carries
   `SECURITY DEFINER` RPCs that are `GRANT`ed to `anon`, take the caller's identity as a
   parameter, and never check `auth.uid()`. Any unauthenticated request can read any user's
   friend graph. Nothing in the new pgTAP suite looks at RPC exposure at all.
2. The elevated-client boundary (REFAC-05, threat T-03-03-05) is scoped to `src/app/**` only,
   and is *already* walked around: `src/lib/audit.ts` holds the service-role client and is
   imported by ~17 admin routes. The census does not see it and `REGISTRY.md` declares itself
   empty.
3. The new `club_invitations` UPDATE policy's `WITH CHECK` pins `invitee_email` and `status`
   but not `club_id` — a partial miss of registered threat T-03-05-07 — and the migration's
   claim to close F-016 is not achievable because `club_members` still has no INSERT policy
   for the invitee.
4. `src/lib/audit.ts` was edited by this phase (cast removed) and still writes a column that
   does not exist and still discards the result, so every moderation action remains unaudited.

Each Critical below is reproducible from the tree as it stands. Findings that are inherited
from production rather than authored here are marked as such — inherited or not, a migration
file in this repository is now the thing that creates them in every new environment.

## Critical Issues

### CR-01: `get_friends` / `get_friends_going_to_event` are anon-executable SECURITY DEFINER IDORs

**File:** `supabase/migrations/20260915214553_baseline.sql:282-305` (definitions), `:2454-2462` (grants)
**Issue:**
```sql
CREATE OR REPLACE FUNCTION "public"."get_friends"("target_user_id" "uuid") ...
    LANGUAGE "sql" STABLE SECURITY DEFINER     -- no SET search_path, no auth.uid() check
AS $$ SELECT u.id, u.name, u.avatar_url FROM users u
      JOIN user_follows f1 ON ... f1.follower_id = target_user_id
      JOIN user_follows f2 ON ... f2.following_id = target_user_id; $$;

GRANT ALL ON FUNCTION "public"."get_friends"("target_user_id" "uuid") TO "anon";
```
The function runs as `postgres`, bypasses every RLS policy on `users` and `user_follows`, and
takes the subject **as a parameter** rather than reading it from the session. The anon key and
project URL are public by construction (they ship in the client bundle), so:

```
POST /rest/v1/rpc/get_friends
apikey: <public anon key>
{"target_user_id": "<any user uuid>"}
```
returns that user's full mutual-follow list with `id`, `name` and `avatar_url`, with no session
at all. `get_friends_going_to_event(current_user_id, target_event_id)` is the same shape and
additionally discloses who saved a given event. User ids are trivially harvestable from
`/api/users/search` and `/users/[id]`.

This phase's own skill guidance states the rule it breaks: *"Always include an explicit
`auth.uid()` check inside the function body, keep them in a non-exposed schema, and revoke
`EXECUTE` from any role that shouldn't call them directly"* (`security-rls-performance.md`).
Plan 03-05 registered T-03-05-08 for *adding* a definer function but nothing for auditing the
five it inherited, and `020-rls-policy-gaps.test.sql` asserts nothing about RPC reachability.

Inherited from production, but this migration is what creates it in every environment built
from the repo from now on.

**Fix:** derive the subject from the session and revoke the public grants.
```sql
CREATE OR REPLACE FUNCTION public.get_friends()
  RETURNS TABLE(id uuid, name text, avatar_url text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT u.id, u.name, u.avatar_url
  FROM public.users u
  JOIN public.user_follows f1 ON f1.following_id = u.id AND f1.follower_id = (SELECT auth.uid())
  JOIN public.user_follows f2 ON f2.follower_id = u.id AND f2.following_id = (SELECT auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.get_friends() FROM PUBLIC, anon;
```
If the parameterised signature must be preserved for call-site compatibility, add
`WHERE target_user_id = (SELECT auth.uid())` as the first predicate and still revoke `anon`.
Add a pgTAP case: `tests.act_as_anon()` then `throws_ok`/`is_empty` on the RPC.

---

### CR-02: every admin moderation action is silently unaudited — and `audit.ts` was edited without fixing or guarding it

**File:** `src/lib/audit.ts:36-43`
**Issue:** The insert names `admin_email`, which is **not** a column of `admin_audit_log`
(`src/lib/supabase/types.ts:12-40` lists seven columns; `admin_email` is not among them).
PostgREST answers `PGRST204`, the row never lands, and the result is discarded — `await` with
no destructuring of `error`, no throw, no log. Callers (17 admin routes) wrap `logAdminAction`
in `try/catch` and therefore observe success on every failure.

This phase **removed the `(supabase as any)` cast from this exact statement**, which makes the
call look type-checked while the generated types cannot catch an excess key (supabase-js infers
the insert generic from the literal, so `Row extends Insert` is satisfied by a superset — I
verified `npx tsc --noEmit` is clean with the phantom column present). The characterization
suite `src/__tests__/moderation/audit-shape.test.ts` documents all of this and then pins it.

The consequence is a lost audit trail for bans, approvals, rejections and featured-event
changes — the Validated workflow PROJECT.md records as "with actions written to
`admin_audit_log`". F-007 already recorded the table as empty in production; this is the cause.

Deferring the *column* decision to the owning slice is defensible. Deferring the **error check**
is not: surfacing the failure is a pure observability change with no wire-format impact, and it
was available inside this phase's "type-only" remit.

**Fix (minimum, non-behavioural):**
```ts
const { error } = await supabase.from("admin_audit_log").insert({
  admin_user_id: params.adminUserId,
  action: params.action,
  target_type: params.targetType,
  target_id: params.targetId,
  metadata: params.metadata ?? {},
});
if (error) console.error("[Audit] audit row rejected:", error.code, error.message);
```
and drop `admin_email` (or add the column in a migration) in the same change. Update
`audit-shape.test.ts` — its assertions are written to flip when this is fixed, which is correct.

---

### CR-03: the elevated-client boundary is scoped to `src/app/**` only, and is already bypassed

**File:** `eslint.config.mjs:11-33`, `scripts/check-elevated-ratchet.mjs:45` (`APP_DIR`), `src/server/db/elevated/REGISTRY.md:12-14`, `src/lib/audit.ts:1`
**Issue:** Threat T-03-03-05 ("a new route reaching the service-role client without review") is
mitigated by a rule whose `files` glob is `["src/app/**/*.ts", "src/app/**/*.tsx"]`, and by a
census that walks `src/app` and nothing else. Neither control can see an *indirect* reach.

The bypass is not hypothetical — it is live in the tree today:

```
src/lib/audit.ts:1   import { createServiceClient } from "@/lib/supabase/service";
```
`logAdminAction` is a service-role write, imported by ~17 files under `src/app/api/admin/**`
(e.g. `src/app/api/admin/featured/[id]/route.ts:5`, `.../users/[id]/ban/route.ts`). None of
those routes appears in `eslint.elevated-allowlist.mjs`, because none imports the service module
directly. So the register says *"This register is empty in this phase, and that is the intended
state"* while an RLS-bypassing operation is reachable from admin routes and counted nowhere.

The same hole lets any *future* contributor defeat the control in one move: put
`createServiceClient()` in a new `src/lib/foo.ts` and import `foo` from a route. Lint passes,
the ratchet reports `delta=0`, and the credential is in the request path.

**Fix:** widen the rule to the whole source tree with an explicit exemption for the door, and
walk the same scope in the census.
```js
{
  files: ["src/**/*.ts", "src/**/*.tsx"],
  ignores: ["src/lib/supabase/**", "src/server/db/elevated/**"],
  rules: { "no-restricted-imports": ["error", { patterns: [/* unchanged */] }] },
}
```
and in `check-elevated-ratchet.mjs` replace `APP_DIR` with `join(REPO_ROOT, "src")` plus the same
ignore list, regenerating the allowlist once to absorb `src/lib/audit.ts` as a known legacy row.
Then add the `logAdminAction` row to `REGISTRY.md` — an elevated operation that exists but is
unregistered is exactly what the register was written to prevent.

---

### CR-04: the invitee UPDATE policy does not pin `club_id`, so an invitee can repoint an invitation at any club and accept it

**File:** `supabase/migrations/20260915230000_fk_indexes_and_policy_gaps.sql:156-168`
**Issue:**
```sql
CREATE POLICY "Invitees can accept their own invitations" ON public.club_invitations
  FOR UPDATE TO authenticated
  USING      (invitee_email = (SELECT u.email ...) AND status = 'pending')
  WITH CHECK (invitee_email = (SELECT u.email ...) AND status = 'accepted');
```
`WITH CHECK` constrains two columns. `club_id`, `inviter_id`, `token` and `expires_at` are
unconstrained, so the holder of any pending invitation may issue, with their own anon-key JWT:

```
PATCH /rest/v1/club_invitations?id=eq.<their invite>
{"status":"accepted","club_id":"<any club uuid>"}
```
The row passes `USING` (it is theirs and pending) and passes `WITH CHECK` (still theirs, now
accepted). `src/app/invites/[token]/page.tsx:99-140` then reads `invitation.club_id` and inserts
a `club_members` row for whatever club the row now names. This is the escalation path from
"invited to club A" to "organizer of club B".

Two things currently blunt it, and neither is a control: (a) `club_members` has no INSERT policy
for non-admins today (see WR-01), so the membership insert fails — which means the escalation
goes live the moment the acceptance path is actually fixed; (b) `USING` also omits the expiry
check, so an invitation the app treats as expired after 7 days
(`src/app/invites/[token]/page.tsx:74`) is still `pending` at the policy tier and remains
accept-able forever.

This is a partial miss of the plan's own registered threat T-03-05-07 ("an update policy without
a with-check clause letting a user reassign a row to someone else"). The pgTAP suite tests the
`invitee_email` half of exactly this class (`020-rls-policy-gaps.test.sql:135-141`) and never
tests the `club_id` half.

**Fix:** pin the immutable columns and honour the expiry.
```sql
  USING (
    invitee_email = (SELECT u.email FROM public.users u WHERE u.id = (SELECT auth.uid()))
    AND status = 'pending'
    AND expires_at > now()
  )
  WITH CHECK (
    invitee_email = (SELECT u.email FROM public.users u WHERE u.id = (SELECT auth.uid()))
    AND status = 'accepted'
    AND club_id   = (SELECT ci.club_id    FROM public.club_invitations ci WHERE ci.id = id)
    AND inviter_id= (SELECT ci.inviter_id FROM public.club_invitations ci WHERE ci.id = id)
  );
```
(or, cleaner, a `BEFORE UPDATE` trigger that rejects any change to a column other than `status`).
Add the matching pgTAP case:
```sql
SELECT throws_ok(
  $q$UPDATE public.club_invitations SET status='accepted',
       club_id='00000000-0000-4000-8000-0000000000c2'
     WHERE id='00000000-0000-4000-8000-0000000000b1'$q$,
  '42501', NULL,
  'the invitee cannot repoint an invitation at another club while accepting it');
```
and bump `plan(15)` accordingly.

---

### CR-05: `compute_user_scores()`, `send_event_reminders()` and `send_feedback_requests()` are anon-executable privileged writes

**File:** `supabase/migrations/20260915214553_baseline.sql:72`, `:379-445`, `:448+`; grants at `:2442-2444`, `:2490-2492`
**Issue:** All three are `SECURITY DEFINER`, none checks a caller, and all three are
`GRANT ALL ... TO "anon"`. An unauthenticated caller holding the public anon key can:

- `POST /rest/v1/rpc/compute_user_scores` — a full recompute of `user_event_scores` across every
  user, on demand, unthrottled. This is the job this phase just put on a 6-hour pg_cron schedule
  (`20260915230100_cron_compute_user_scores.sql`) precisely because it is expensive.
- `POST /rest/v1/rpc/send_event_reminders` — writes `notifications` rows on behalf of other
  users (`:401-407`, `:428-434`). It de-duplicates by `(user_id,event_id,type)`, so the spam
  ceiling is bounded, but an anonymous caller triggering notification writes for other users is
  an authorization failure regardless of the ceiling.

Registered nowhere in the phase threat models, asserted nowhere in `030-cron-schedule.test.sql`
(which checks the schedule row, not who may invoke the function).

**Fix:**
```sql
REVOKE EXECUTE ON FUNCTION public.compute_user_scores()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_event_reminders()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_feedback_requests()   FROM PUBLIC, anon, authenticated;
-- pg_cron runs as the job owner; service_role retains EXECUTE for the cron routes.
```
plus a pgTAP assertion per function: `SELECT ok(NOT has_function_privilege('anon', 'public.compute_user_scores()', 'EXECUTE'), …)`.

## Warnings

### WR-01: the migration claims to close F-016, but invitation acceptance still cannot succeed

**File:** `supabase/migrations/20260915230000_fk_indexes_and_policy_gaps.sql:6-13`, `:125-137`
**Issue:** The header states F-016 ("club-invitation acceptance is broken in production") is
*closed*. The accept path is `src/app/invites/[token]/page.tsx:130-140`, which under the
RLS-bound user client does `club_members.insert({user_id, club_id, role:'organizer'})`. The
complete policy set on `club_members` in the baseline is:

```
Admins manage memberships        (ALL,    admin only)
Club owners can remove members   (DELETE)
Club owners can view all members (SELECT)
Users see own memberships        (SELECT)
```
There is **no INSERT policy** an invitee satisfies, so `memberResult.error` is set and the page
renders "Something Went Wrong". The three new policies are necessary and not sufficient; the
requirement is still unmet and the phase artifacts say otherwise.
`020-rls-policy-gaps.test.sql` cannot catch this because it asserts the three policies in
isolation and never exercises the acceptance transaction end to end.

**Fix:** either add the missing policy in the same migration (scoped so it cannot be used to
self-join arbitrary clubs) —
```sql
CREATE POLICY "Invitees can join the club they were invited to"
  ON public.club_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid()) AND role = 'organizer'
    AND EXISTS (SELECT 1 FROM public.club_invitations ci
                 JOIN public.users u ON u.id = (SELECT auth.uid())
                WHERE ci.club_id = club_members.club_id
                  AND ci.invitee_email = u.email
                  AND ci.status = 'accepted' AND ci.expires_at > now())
  );
```
— or downgrade the header and the requirement table from "closes F-016" to "narrows F-016",
naming the `club_members` INSERT gap as the remainder. Add a pgTAP case that performs the
acceptance as the invitee and asserts a `club_members` row comes back via `RETURNING`.

---

### WR-02: the invitee policies compare emails case-sensitively; the application compares case-insensitively

**File:** `supabase/migrations/20260915230000_fk_indexes_and_policy_gaps.sql:149`, `:162`, `:166`
**Issue:** `invitee_email = (SELECT u.email FROM public.users u WHERE u.id = …)` is a
case-sensitive `text` comparison. `public.users.email` is written by
`src/app/auth/callback/route.ts:110,150` straight from `user.email` with **no** normalisation,
while `src/app/invites/[token]/page.tsx:85-87` deliberately compares
`user.email?.toLowerCase() !== invitation.invitee_email.toLowerCase()`. The application has
already decided the two may differ in case; the policy has not. One mixed-case row in
`users.email` makes the invitation invisible to its own recipient, reproducing the exact F-016
symptom the migration exists to remove — and it fails silently (USING-filter shape, zero rows,
no error).

**Fix:** `lower(invitee_email) = lower((SELECT u.email FROM public.users u WHERE u.id = (SELECT auth.uid())))`
in all three clauses, and add `CREATE INDEX IF NOT EXISTS idx_club_invitations_email_lower ON public.club_invitations (lower(invitee_email));`
so the predicate stays indexable. Add a pgTAP fixture row whose stored email differs in case.

---

### WR-03: `reuseExistingServer` lets the harness drive an application built from `.env.local`

**File:** `playwright.config.ts:89`, `:123-135`
**Issue:** `assertSeedTargetAllowed(stack.url)` at line 89 proves the *config's* target is local.
It says nothing about the server the harness actually talks to. With
`reuseExistingServer: !process.env.CI`, a local run that already has `npm run dev` on port 3000
— the normal state of a developer's machine, and a process Next boots from `.env.local`, i.e.
**production** — skips the `webServer.env` block entirely and runs every spec against a
production-connected application. The specs then sign in with local-stack cookies (which that
app will ignore) and drive save/RSVP/moderation surfaces. The blast radius is bounded by the
cookies being wrong rather than by any control in this phase, and the plan's claim
("`NEXT_PUBLIC_SUPABASE_URL` is handed to the seed loader's OWN guard below, before Playwright
starts anything") is stronger than what the code delivers.

**Fix:** set `reuseExistingServer: false` unconditionally (the harness needs a production build
anyway, so reuse of a dev server is never correct), or add a `globalSetup` that fetches a
health/config endpoint from `BASE_URL` and re-applies `assertSeedTargetAllowed` to the URL the
*running server* reports.

---

### WR-04: partial `SUPABASE_*` overrides silently mix a remote URL with local-stack keys

**File:** `e2e/env.ts:37-73`
**Issue:** The all-three-present branch (43-50) is guarded correctly. The fall-through is not:
line 70 is `url: fromEnv.url ?? read("API_URL")`, so exporting `SUPABASE_URL` alone (a remote
project, say) and not the two keys produces `{url: <remote>, anonKey: <local>, serviceRoleKey: <local>}`
— one object assembled from two different environments. Today the seed guard refuses the remote
URL, so the failure is loud; but the mixing is a latent trap the moment a staging target is
acknowledged (`SEED_STAGING_PROJECT_REF`), at which point a seed *write* would be attempted
against the remote project with local keys. The same shape exists at
`scripts/seed/load.ts:75-99`.

**Fix:** make the override all-or-nothing in both files:
```ts
const anyPresent = fromEnv.url || fromEnv.anonKey || fromEnv.serviceRoleKey;
const allPresent = fromEnv.url && fromEnv.anonKey && fromEnv.serviceRoleKey;
if (anyPresent && !allPresent) throw new Error("Export all three SUPABASE_* values or none — partial overrides mix environments.");
```

---

### WR-05: five of the seven SECURITY DEFINER functions in the baseline have a mutable `search_path`

**File:** `supabase/migrations/20260915214553_baseline.sql:72`, `:282`, `:295`, `:379`, `:448`
**Issue:** Only `is_admin` (`:309-311`) and `is_club_owner` (`:323-325`) carry
`SET "search_path" TO 'public'`. `compute_user_scores`, `get_friends`,
`get_friends_going_to_event`, `send_event_reminders` and `send_feedback_requests` do not, and
their bodies reference unqualified relations (`users`, `user_follows`, `saved_events`,
`notifications`). This is the standard `function_search_path_mutable` advisory, and it is the
amplifier for CR-01/CR-05: a definer function with a mutable path plus a public `EXECUTE` grant
is the shape that turns a schema-creation privilege anywhere in the cluster into arbitrary
execution as `postgres`.

**Fix:** `ALTER FUNCTION public.<name>(...) SET search_path = '';` for all five (schema-qualify
the bodies at the same time), as a new migration. Add a pgTAP assertion that iterates
`pg_proc WHERE prosecdef` and requires `proconfig` to contain a `search_path` entry — one
assertion that cannot be satisfied by a future definer function forgetting it.

---

### WR-06: the baseline codifies a storage policy that lets any signed-in user read every object in every bucket

**File:** `supabase/migrations/20260915214553_baseline.sql:2770` (hand-added storage section)
**Issue:**
```sql
CREATE POLICY "Allow public read access 1oj01fe_0" ON "storage"."objects"
  FOR SELECT TO "authenticated" USING (true);
```
No `bucket_id` scope. Every other SELECT policy in the same block is bucket-scoped
(`'banners'`, `'club-logos'`, `'event-images'`), which is what makes this one stand out: it
makes the eleven scoped policies decorative for any authenticated caller, including for any
bucket added later that was intended to be private. The section header explains, correctly, why
storage *structure* is excluded and why the policies are included — but the policies were
carried verbatim without being read.

**Fix:** delete the policy in a follow-up migration (the three bucket-scoped public-read policies
already cover the intended access), or scope it:
`USING (bucket_id IN ('event-images','club-logos','banners'))`. Whichever is chosen, add a
`050-storage-policies.test.sql` that asserts an authenticated non-owner cannot select an object
in a bucket they have no relationship to — right now nothing in the suite looks at `storage`.

---

### WR-07: CI grants default token permissions and pins third-party actions to mutable tags

**File:** `.github/workflows/ci.yml:1-13`, `:19`, `:23`, `:74-76`, `:136-138`, `:160`
**Issue:** There is no `permissions:` block, so every job runs with the repository's default
`GITHUB_TOKEN` scope (write, for many repositories). `supabase/setup-cli@v3` is a third-party
action referenced by a mutable major tag, as are `actions/checkout@v4`,
`actions/setup-node@v4` and `actions/upload-artifact@v4`. A compromised or force-moved tag
executes with whatever that default token can do. The CLI *version* is pinned (2.115.0, and the
rationale is excellent) while the *action that installs it* is not — the pinning discipline stops
one level short.

**Fix:**
```yaml
permissions:
  contents: read
```
at workflow level, and pin at least the third-party action by digest:
`uses: supabase/setup-cli@<40-char-sha>  # v3`.

---

### WR-08: `purge()`'s stale-account cleanup ignores eight delete errors that every sibling call checks

**File:** `scripts/seed/load.ts:187-194`
**Issue:** Lines 115-154 route every delete through `must(...)`, which is the right discipline.
Lines 187-194 — the stale-by-email branch — issue the same eight deletes with the result thrown
away. If any fails (a new child table with a `NO ACTION` FK is the obvious case), the loop at
196-201 reports `"Database error deleting user"`, which the comment at 183-186 says in as many
words is the message that "would say nothing about why". The code creates the condition its own
comment warns about.

**Fix:** wrap all eight in `must("purge stale <table>", (await …).error)`, identical to the block
above.

---

### WR-09: `src/app/profile/page.tsx` keeps `as Record<string, unknown>` escapes on columns that now exist in the generated types

**File:** `src/app/profile/page.tsx:69-75`
**Issue:** The cast-removal pass edited lines 38-61 of this file and left, six lines later:
```ts
banner_url: (profile as Record<string, unknown>)?.banner_url as string | null ?? null,
pronouns:   ((profile as Record<string, unknown>)?.pronouns as string) ?? null,
year: …, faculty: …, visibility: …
```
All five columns are present in `src/lib/supabase/types.ts` (`banner_url`, `pronouns`, `year`,
`faculty`, `visibility` are all on `users.Row`). The casts are therefore dead weight that
disables exactly the drift detection the new `types` CI job was built to provide: if one of
these columns is dropped tomorrow, the gate catches the type file but this page keeps compiling.
The same stale-escape pattern sits at `src/app/api/recommendations/route.ts:92`
(`.from("user_event_scores" as any)` — the table is in the generated types at line 1080).

**Fix:** delete the five casts (`profile?.banner_url ?? null`, etc.) and the
`"user_event_scores" as any`; both compile clean against the current generated types.

---

### WR-10: `040-seed-coverage.test.sql` ban assertions are not scoped to seeded ids

**File:** `supabase/tests/database/040-seed-coverage.test.sql:92-113`
**Issue:** The "not banned" assertion (85-90) correctly scopes with
`id::text LIKE '5eed0000-%'`. The three that follow — permanent ban, active suspension, expired
suspension — query `public.users` unscoped. Any banned row from any other source satisfies them,
so the assertions can report "the seed covers this state" about rows the seed did not create.
Given that the e2e job runs this against a database the harness has been writing to, that is a
live false-green path, not a theoretical one.

**Fix:** add `AND id::text LIKE '5eed0000-%'` to all three predicates, matching line 88.

---

### WR-11: the `next` parameter reaches `NextResponse.redirect` unvalidated, and the new PRESERVE suite pins that behaviour

**File:** `src/app/auth/callback/route.test.ts:313-325` (the characterization), `src/app/auth/callback/route.ts:36`, `:203-205`
**Issue:** The route does `new URL(next, requestUrl.origin)` with `next` taken straight from the
query string. An absolute value wins over the base, so `?next=https://evil.example/` redirects
the freshly-authenticated user off-origin — with the session cookies already set on the
response. `src/components/auth/SignInButton.tsx:30` only ever sets a pathname, so exploitation
needs the attacker to craft the OAuth `redirect_to`; whether that is reachable depends entirely
on how permissive the Supabase redirect allow-list is, which is not something this repository
controls or asserts.

The reason this belongs in *this* review: the new PRESERVE suite asserts the `next` behaviour
(test 6, "routes an already-onboarded McGill user to the next destination") and its header states
these expectations "must pass byte-for-byte identically afterwards". That freezes the missing
validation into the contract Phases 5-6 are told to preserve.

**Fix:** add a same-origin guard to the route and a characterization case that pins the *safe*
behaviour before the freeze takes effect:
```ts
const raw = requestUrl.searchParams.get("next") ?? "/";
const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
```
```ts
it("refuses an off-origin next destination", async () => { /* ?next=https%3A%2F%2Fevil.test */ });
```

---

### WR-12: the seam reads ban state that no guard consumes, inviting handlers to assume a check that is not there

**File:** `src/server/context.ts:35-48`, `src/server/authz/requireUser.ts`, `src/server/authz/requireRole.ts`
**Issue:** `RequestProfile` selects `banned_at` and `ban_expires_at` and the docblock says they
are "exactly what the ban check, the onboarding guard and the role guards between them need".
No guard in `src/server/authz/` reads either column, and no `requireNotBanned` exists. A Phase
4-6 handler adopting `requireUser`/`requireRole` gets authentication and role membership and
**no** ban enforcement from the seam. The proxy does cover `/api/**` today, but it fails open by
design (`src/proxy.ts` outer `catch` returns `NextResponse.next({ request })`), so the ring is
the only ban check and it is a best-effort one.

**Fix:** either add the guard the columns were selected for —
```ts
export function requireNotBanned(ctx: Pick<RequestContext,"profile">): AuthGuardResult | null {
  const p = ctx.profile;
  if (p?.banned_at && (!p.ban_expires_at || new Date(p.ban_expires_at) > new Date()))
    return { ok: false, response: forbidden("Account suspended") };
  return null;
}
```
— or narrow `RequestProfile` to the three columns something actually reads, so the seam does not
advertise a check it does not perform.

## Info

### IN-01: `playwright.config.ts` reporter ternary has identical branches

**File:** `playwright.config.ts:97-99`
**Issue:** `process.env.CI ? [["list"],["html",{open:"never"}]] : [["list"],["html",{open:"never"}]]` — the condition cannot affect the result.
**Fix:** collapse to the single array, or make CI actually differ (e.g. add `["github"]`).

---

### IN-02: the protected-route spec hardcodes the base URL instead of importing it

**File:** `e2e/specs/protected-route-redirect.spec.ts:45`
**Issue:** `page.url().replace("http://127.0.0.1:3000", "")` duplicates the `BASE_URL` constant
that `playwright.config.ts:83` exports and `auth.setup.ts:49` already imports. Changing the port
silently turns every comparison into a full-URL-vs-path mismatch.
**Fix:** `import { BASE_URL } from "../../playwright.config";` and use `new URL(page.url()).pathname + new URL(page.url()).search`.

---

### IN-03: `pick()` is exported and unused; the loader inlines the same expression

**File:** `scripts/seed/prng.ts:36-39` vs `scripts/seed/load.ts:306`
**Issue:** `load.ts` writes `organizers[Math.floor(next() * organizers.length)]` rather than
calling `pick(next, organizers)`, so the helper (including its empty-list guard) is dead code in
a 20-line module whose whole justification is that it is small and auditable.
**Fix:** use `pick(next, organizers)` in `seedEvents`.

---

### IN-04: membership fixture names contradict the roles they assign

**File:** `scripts/seed/personas.ts:411-427`
**Issue:** `organizerOfApproved` assigns `role: "owner"`, and `multi_club_organizer` is therefore
a **second owner** of `approvedClub` alongside `club_owner`. `memberOfApproved` is the one row
that is actually `organizer`. Any future assertion of the form "the approved club has one owner"
is quietly false, and the key names mislead a reader of `club-owner-surfaces.spec.ts`.
**Fix:** rename the key to `ownerOfSecondApprovedAndApproved`, or set the role to `organizer` if
two owners was not intended.

---

### IN-05: `requireClubRole` tests exercise club roles the schema forbids

**File:** `src/server/__tests__/requireClubRole.test.ts:51`, `:63`, `:86`
**Issue:** `"member"` and `"officer"` are used as `ClubRole` values. `club_members_role_check`
permits only `'owner'` and `'organizer'` (baseline `:688`), a fact `personas.ts:395-400`
documents explicitly. The tests compile because the column is `text`, so they pass while
describing a database that does not exist.
**Fix:** use `"organizer"` for the outside-the-set case and drop the `"officer"` case (or keep it
with a comment that it is a synthetic third role proving set semantics, not a schema value).

---

### IN-06: `expect(getRequestContext).toBe(createRequestContext)` will fail as a mystery on the React upgrade

**File:** `src/server/__tests__/context.test.ts:160-167`
**Issue:** The assertion is a deliberate pin on the React-18 fallback, but on the day React gains
`cache` it fails with "expected function to be function" and no hint that the *correct* outcome
has occurred.
**Fix:** assert the property rather than the identity:
```ts
const hasCache = typeof (require("react") as Record<string, unknown>).cache === "function";
expect(getRequestContext === createRequestContext).toBe(!hasCache);
```

---

### IN-07: the two zero-dependency checkers resolve their roots differently

**File:** `scripts/check-migration-filenames.mjs:61` vs `scripts/check-elevated-ratchet.mjs:43-45`
**Issue:** The first resolves against `process.cwd()`, the second against the script's own
directory. Run from a subdirectory the first reports "the directory is missing or unreadable"
(fails closed, but for the wrong reason); the second is cwd-independent.
**Fix:** use the `fileURLToPath(import.meta.url)` pattern in both.

---

### IN-08: documented-unreachable guard in `friends-activity`

**File:** `src/app/api/events/friends-activity/route.ts:52-58`
**Issue:** `if (eventId === null) continue;` is, by its own comment, unreachable while the select
uses `events!inner`. It is defensible defensive code, but it is a branch no test can cover and
none does.
**Fix:** keep it and add `/* istanbul ignore next */`-style intent, or replace with an assertion
that makes the impossibility explicit rather than silently skipping.

---

### IN-09: the seed-guard suite never asserts the staging ALLOW path or the dev-server-port refusal

**File:** `src/__tests__/seed/guard.test.ts:54-118`
**Issue:** Four refusals and one local allow. Two branches with dedicated code are untested: the
fully-acknowledged staging *allow* (`guard.ts:194-210`, the branch the module header admits has
"never been loaded through"), and the `LOCAL_PORT_MIN/MAX` window that exists specifically to
stop `http://localhost:3000` — the dev server — reading as a seed target (`guard.ts:56-59`).
**Fix:** add two cases:
```ts
expect(assertSeedTargetAllowed(STAGING_URL, {envFilePath, env:{SEED_STAGING_PROJECT_REF:STAGING_REF, SEED_I_UNDERSTAND_TARGET:"staging"}})).toBe(STAGING_URL);
expect(() => assertSeedTargetAllowed("http://localhost:3000", {envFilePath, env:{}})).toThrow(/REFUSED/);
```

---

_Reviewed: 2026-09-16T03:34:25Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
