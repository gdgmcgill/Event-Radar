<!-- GENERATED FILE — DO NOT EDIT BY HAND.
     Source: .planning/audit/findings.json
     Regenerate: node .planning/audit/tools/gen-foundation-audit.mjs
     `validate.mjs --check findings` asserts this document and the register agree. -->

# Foundation Audit — Finding Register

**Requirement:** AUDIT-20 · **Phase:** 01-read-only-foundation-audit · **Plan:** 01-13
**Generated from:** [`findings.json`](./findings.json) — the machine register is the source of truth; this document is a view of it and cannot drift from it.
**Severity policy:** [`SEVERITY_SLA.md`](./SEVERITY_SLA.md), written in Wave 1 before the first finding existed. Severity is exposure-adjusted; CVSS vectors are not assigned to application-logic findings.
**Reading order:** this register first, then the three threat models under [`security/`](./security/), then the inventories under [`inventory/`](./inventory/). The artifact index is [`README.md`](./README.md).

---

## Summary

**70 findings**, every one carrying a reproduction, a recommended fix and a validation criterion. A finding with no evidence is not in this register.

### By severity

| Severity | Count | Must be fixed by |
|---|---:|---|
| Critical | 4 | First Stage 3 slice owning the layer. **None may be Open when Phase 5 starts.** |
| High | 17 | Before Phase 7 begins, or a dated risk acceptance with a reachability argument. |
| Medium | 27 | Within Stage 3, in the slice that touches the file. |
| Low | 22 | Opportunistically. No deadline. |
| **Total** | **70** | |

### By category

| Category | Count |
|---|---:|
| authz | 25 |
| cache-exposure | 4 |
| schema-drift | 10 |
| config | 12 |
| dependency | 5 |
| observability | 6 |
| validation | 2 |
| performance | 3 |
| dead-code | 3 |
| **Total** | **70** |

### By status

| Status | Count |
|---|---:|
| Open | 70 |

---

## Contents

| Id | Severity | Category | Finding |
|---|---|---|---|
| [F-001](#f-001) | Critical | authz | Admin popularity route accepts any request when ADMIN_API_KEY is unset, then constructs a service-role client |
| [F-006](#f-006) | Critical | authz | Any authenticated user can set their own users.roles to admin, and can self-unban |
| [F-007](#f-007) | Critical | authz | Anyone, including anonymous callers, can insert forged rows into admin_audit_log |
| [F-025](#f-025) | Critical | cache-exposure | Personalized API responses are stored by the shared CDN cache under a key that ignores the session |
| [F-002](#f-002) | High | authz | Reminder cron route compares the Authorization header against the fixed literal 'Bearer undefined' |
| [F-005](#f-005) | High | authz | The public user profile page reads another user's email and interest tags on a service-role client with no authentication |
| [F-008](#f-008) | High | authz | Event INSERT policy carries WITH CHECK (true), permitting a self-approved event with a forged created_by |
| [F-009](#f-009) | High | authz | Anonymous callers can forge another user's interaction history, poisoning recommendations and popularity through an AFTER INSERT trigger |
| [F-010](#f-010) | High | authz | Any authenticated user can insert, update or delete any row in event_popularity_scores |
| [F-011](#f-011) | High | authz | The attendance graph in rsvps is world-readable by anonymous callers, on a table declared by no migration |
| [F-012](#f-012) | High | schema-drift | The live policy set and the repository disagree: 41 production policies are declared by no migration and 24 declared policies are absent from production |
| [F-026](#f-026) | High | cache-exposure | Thirty-seven auth-gated routes, including all fifteen admin handlers, sit under the same blanket shared-cache directive |
| [F-027](#f-027) | High | cache-exposure | /api/auth-debug echoes the caller's own id and email with no gate, under a shared-cache directive |
| [F-030](#f-030) | High | authz | Any authenticated user can overwrite any club's logo or banner object by addressing the Storage API directly |
| [F-038](#f-038) | High | config | No email is sent by anything in the project, while three names and a Validated requirement assert otherwise |
| [F-039](#f-039) | High | config | The events-webhook edge function is deployed and ACTIVE with verify_jwt disabled, built from a developer's local checkout |
| [F-040](#f-040) | High | config | Only three environment variables are configured in production; ADMIN_API_KEY, CRON_SECRET and ADMIN_EMAILS are all absent |
| [F-043](#f-043) | High | schema-drift | The migration history does not replay from zero — the reset aborts at the 12th of 44 files |
| [F-044](#f-044) | High | schema-drift | The rsvps table is created by no migration, yet policies are written for it and code reads it |
| [F-051](#f-051) | High | dependency | next 16.2.1 carries 25 advisories, two of them critical, reachable on every request, with a fix inside the declared range |
| [F-052](#f-052) | High | dependency | The vercel CLI is declared in dependencies rather than devDependencies and is imported by nothing |
| [F-003](#f-003) | Medium | authz | The entire middleware authentication ring is environment-variable-conditional and passes traffic through unauthenticated when unbound |
| [F-013](#f-013) | Medium | authz | The complete social graph (user_follows, club_followers) is bulk-readable by anonymous callers |
| [F-014](#f-014) | Medium | authz | Review text is anonymously readable alongside its author's user_id |
| [F-015](#f-015) | Medium | performance | events.status, the predicate column of the anonymous feed policy, has no index |
| [F-016](#f-016) | Medium | config | Club-invitation acceptance is broken in production because the invitee policies exist only in an unapplied migration |
| [F-017](#f-017) | Medium | config | A/B experiment assignment silently degrades to the control path for every non-admin caller |
| [F-028](#f-028) | Medium | cache-exposure | Eight personalized routes answer anonymous callers with 200 and a degraded body instead of 401 |
| [F-029](#f-029) | Medium | observability | /api/health returns a full infrastructure health report, including a live auth-configuration probe, to any caller |
| [F-031](#f-031) | Medium | authz | club-logos has neither a file size limit nor a content-type allow-list |
| [F-032](#f-032) | Medium | authz | avatars has no content-type allow-list, so arbitrary content can be hosted under a user's own prefix |
| [F-033](#f-033) | Medium | authz | The banners INSERT policy tests the bucket only, while its sibling UPDATE and DELETE policies test path-prefix ownership |
| [F-034](#f-034) | Medium | authz | A bucket-agnostic USING (true) read policy on storage.objects becomes a cross-tenant read the day a private bucket exists |
| [F-035](#f-035) | Medium | schema-drift | Three of four storage buckets and thirteen object policies exist only in production, declared by no migration or config file |
| [F-037](#f-037) | Medium | config | Two dead cron handlers duplicate live pg_cron functions with four behavioural divergences |
| [F-041](#f-041) | Medium | config | user_event_scores holds exactly zero rows, so personalized recommendations always take the popularity fallback |
| [F-042](#f-042) | Medium | schema-drift | All three pg_cron jobs exist only in production; the repository's sole trace is a commented-out schedule line in a never-applied migration |
| [F-045](#f-045) | Medium | schema-drift | Production reports 45 applied migration versions against 44 files in the repository |
| [F-046](#f-046) | Medium | schema-drift | Seventy-six of 288 reconciled schema rows are out of sync across production, migrations and types.ts |
| [F-047](#f-047) | Medium | schema-drift | users.is_admin is declared only by the one migration file the CLI silently skips |
| [F-048](#f-048) | Medium | schema-drift | user_engagement_summary is created by a migration and does not exist in production |
| [F-053](#f-053) | Medium | dependency | swagger-ui-react and two companion packages are installed, vulnerable and imported by nothing |
| [F-054](#f-054) | Medium | authz | /docs is an anonymous public route that publishes the full API surface through a shipped rendering package |
| [F-055](#f-055) | Medium | config | The Content-Security-Policy allows both 'unsafe-inline' and 'unsafe-eval' |
| [F-058](#f-058) | Medium | observability | Twenty-two of ninety-four route files have no error handling, and no route on any path carries request correlation or rate limiting |
| [F-059](#f-059) | Medium | observability | Twenty-two route files return internal error text to the caller across forty sites |
| [F-061](#f-061) | Medium | validation | Twenty-two admin handlers answer an anonymous caller with 403 where the contract says 401 |
| [F-062](#f-062) | Medium | validation | The ban ring answers JSON API calls with a 307 redirect to an HTML page, on ninety-two routes |
| [F-004](#f-004) | Low | authz | The auth callback grants the admin role from an ADMIN_EMAILS allowlist read at request time |
| [F-018](#f-018) | Low | authz | 61 of 101 policies carry no TO clause; 39 rely on an auth.uid()-bearing predicate rather than role targeting to exclude anon |
| [F-019](#f-019) | Low | performance | 68 unwrapped auth.uid() occurrences across 59 policies are re-evaluated per row |
| [F-020](#f-020) | Low | performance | Four policy-referenced columns on featured_events and moderation_reviews have no index |
| [F-021](#f-021) | Low | authz | event_popularity_scores carries two byte-identical permissive USING (true) SELECT policies |
| [F-022](#f-022) | Low | authz | Pending and rejected clubs are publicly readable, because the club read policy ignores the status column |
| [F-023](#f-023) | Low | authz | Twelve policies inline the admin EXISTS subquery instead of calling is_admin(); only six call the helper |
| [F-024](#f-024) | Low | authz | Any authenticated user can read every object in every storage bucket |
| [F-036](#f-036) | Low | config | event-images carries two byte-identical permissive SELECT policies |
| [F-049](#f-049) | Low | schema-drift | events_tests exists only in types.ts — created out of band, dropped out of band, its cleanup migration never applied |
| [F-050](#f-050) | Low | dead-code | Five source locations reference event_date and event_time columns that do not exist on the events table |
| [F-056](#f-056) | Low | dependency | tailwindcss-animate in dependencies drags the Tailwind build toolchain into the production tree |
| [F-057](#f-057) | Low | dependency | A Windows remote-code-execution critical is dispositioned 'not applicable' on an unverified assumption about the host OS |
| [F-060](#f-060) | Low | observability | One hundred and sixty-two console calls across sixty files, with no logger declared anywhere |
| [F-063](#f-063) | Low | dead-code | Seven documented facts about the codebase are contradicted by the working tree |
| [F-064](#f-064) | Low | dead-code | Four tracked files and one npm script are residue of tooling that is not installed |
| [F-065](#f-065) | Low | config | CI runs lint, type-check and build but never runs the tests, and pins a Node version that cannot run the project's own tooling |
| [F-066](#f-066) | Low | config | Five of twenty-one Jest suites are skipped, for two different reasons needing two different fixes |
| [F-067](#f-067) | Low | observability | The specified fail-open detector finds one of the four fail-open shapes that exist |
| [F-068](#f-068) | Low | observability | A redaction sweep that reports zero can be false-clean, and was treated as authoritative until one fired |
| [F-069](#f-069) | Low | config | Page protection cannot be read from the middleware list alone — the single-ring model is wrong in both directions |
| [F-070](#f-070) | Low | authz | The client-bundle secret sweep is INCONCLUSIVE, not clean — the build that produced it ran without the real key |

---

## Findings

### F-001 — Admin popularity route accepts any request when ADMIN_API_KEY is unset, then constructs a service-role client

**Severity:** Critical · **Category:** authz · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Anonymous-reachable with no compensating control, and the variable is confirmed absent from the production environment, so this is live rather than conditional. The gate is `if (expectedKey && ...)`, which evaluates false when the key is unset and skips the comparison entirely on both GET and POST. Past the gate the handler builds an RLS-bypassing client inline, so neither the authorization ring nor the row-level ring stands in the way.

**Affected paths.**

- `src/app/api/admin/calculate-popularity/route.ts` lines 15-29
- `src/app/api/admin/calculate-popularity/route.ts` lines 54-66
- `src/app/api/admin/calculate-popularity/route.ts` lines 165-175

**Evidence.** [`authz/fail-open-register.md#fo-01`](./authz/fail-open-register.md#fo-01)

**Reproduction.**

1. Confirm the variable is absent in production: `node -e "console.log(require('./.planning/audit/raw/vercel/env-names.json'))"` lists exactly three configured names and ADMIN_API_KEY is not among them.
2. Read the gate at src/app/api/admin/calculate-popularity/route.ts:57-61 (POST) and :167-170 (GET) — both are `if (expectedKey && provided !== expectedKey)`.
3. With ADMIN_API_KEY unset, `curl -s -o /dev/null -w '%{http_code}' https://<host>/api/admin/calculate-popularity` returns 200 with no credential of any kind.
4. Read lines 15-29: the handler constructs its own service-role client with createAdminClient() rather than the shared factory.

**Recommended fix.** Invert the gate so an absent key fails closed: `if (!expectedKey) return NextResponse.json({error:'Server misconfiguration'},{status:500})` before any comparison, matching the shape already used in src/app/api/cron/send-feedback-requests/route.ts:8-12. Then replace the shared-secret gate with verifyAdmin(), since this path lives under /api/admin. Delete createAdminClient() and use the shared factory so the uses_service_client detector can see the callsite.

**Validation criterion.** An integration test asserting that a request with no Authorization header receives 401 (or 500 when the variable is unset) on both GET and POST, and a grep asserting that src/app/api/admin/calculate-popularity/route.ts contains no direct read of SUPABASE_SERVICE_ROLE_KEY.

**Related.** [F-040](#f-040), [F-067](#f-067)

---

### F-006 — Any authenticated user can set their own users.roles to admin, and can self-unban

**Severity:** Critical · **Category:** authz · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Crosses every trust boundary in the system in a single statement, with no compensating control whatsoever. The policy `users :: Users can update own profile` is `USING (auth.uid() = id)` with no WITH CHECK, `authenticated` holds a table-level UPDATE grant covering every column, users.roles has no CHECK constraint, and the only trigger touches updated_at. It is a direct PostgREST write, so no handler-level control is in the path. Requires sign-in, which is McGill-gated — the only thing keeping it off Critical-anonymous.

**Affected paths.**

- `.planning/audit/rls/rls-review.md` lines 343-375
- `.planning/audit/rls/rls-heatmap.csv` lines public.users row

**Evidence.** [`rls/rls-review.md#4c`](./rls/rls-review.md#4c)

**Reproduction.**

1. Read .planning/audit/rls/pg_policies.json for `users :: Users can update own profile` — qual is `auth.uid() = id`, with_check is null.
2. Read .planning/audit/raw/prod/grants.json — `authenticated` holds UPDATE on public.users with no column list.
3. Read .planning/audit/raw/prod/constraints.json — only users_pkey, users_email_key and users_banned_by_fkey exist; nothing constrains roles.
4. As any signed-in user, PATCH /rest/v1/users?id=eq.<self> with body {"roles":["admin"]} through PostgREST; is_admin() returns true from that moment. The same write clears ban state.

**Recommended fix.** Add `WITH CHECK (auth.uid() = id AND roles = (SELECT roles FROM users WHERE id = auth.uid()) AND banned_at IS NOT DISTINCT FROM (SELECT banned_at FROM users WHERE id = auth.uid()))` or, preferably, revoke the table-level UPDATE grant and re-grant it column-scoped: `GRANT UPDATE (name, bio, avatar_url, interest_tags, banner_url, onboarding_completed) ON public.users TO authenticated`. Role changes then have no path except an audited administrative action.

**Validation criterion.** A pgTAP test signing in as a non-admin and asserting that an UPDATE setting roles to include 'admin' is rejected, and that an UPDATE clearing banned_at is rejected, while an UPDATE of bio succeeds.

**Related.** [F-007](#f-007), [F-012](#f-012)

---

### F-007 — Anyone, including anonymous callers, can insert forged rows into admin_audit_log

**Severity:** Critical · **Category:** authz · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Anonymous-reachable tampering with the system's only accountability record, with no compensating control — it is a direct PostgREST write. Two INSERT policies both carry WITH CHECK (true) and both name {public}, and anon holds INSERT on the table. An attacker can attribute a fabricated approval to a real administrator, or flood the table to bury a genuine entry. Neither policy is needed: both legitimate writers are service-role callsites that bypass RLS anyway.

**Affected paths.**

- `.planning/audit/rls/rls-review.md` lines 164-165
- `.planning/audit/rls/rls-review.md` lines 330-331
- `src/lib/audit.ts` lines logAdminAction service-role writer

**Evidence.** [`rls/rls-review.md#3a`](./rls/rls-review.md#3a)

**Reproduction.**

1. Read .planning/audit/rls/pg_policies.json for `admin_audit_log :: Admins can insert audit log` and `:: Service role can insert audit log` — both are INSERT, roles {public}, with_check `true`.
2. Read .planning/audit/raw/prod/grants.json — anon holds INSERT on public.admin_audit_log.
3. With no session, POST /rest/v1/admin_audit_log with a body naming any admin_id and action; the row is accepted.
4. Confirm the table holds 0 rows in production (.planning/audit/raw/prod/exact-counts.json family), so a forged entry would be the only entry.

**Recommended fix.** Drop both INSERT policies. The two legitimate writers (/api/clubs/[id] and /api/clubs/[id]/transfer, via logAdminAction in src/lib/audit.ts) use the service-role client and bypass RLS, so removing the policies costs nothing and closes the write path completely. Then REVOKE INSERT ON public.admin_audit_log FROM anon, authenticated.

**Validation criterion.** A pgTAP test asserting that an INSERT into admin_audit_log as anon and as authenticated both fail, and an integration test asserting that a genuine moderation action still writes a row through the service-role path.

**Related.** [F-006](#f-006), [F-004](#f-004)

---

### F-025 — Personalized API responses are stored by the shared CDN cache under a key that ignores the session

**Severity:** Critical · **Category:** cache-exposure · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Credential-equivalent cross-tenant disclosure with no compensating control, and the mechanism is proven by measurement rather than inferred. Eight personalized routes returned x-vercel-cache HIT or STALE with non-zero age under the blanket s-maxage=60 directive, and not one response in the entire run varied on Cookie or Authorization — every vary read accept-encoding and nothing else. A cache entry is therefore keyed by URL alone and served to every caller of that URL. The verdict is held at latent-hazard rather than leak-confirmed because the cross-session retrieval step was not observed (blocked on a second account's cookies); the severity is not softened, because the missing step is the victim, not the mechanism.

**Affected paths.**

- `vercel.json` lines 12
- `src/app/api/notifications/count/route.ts` lines whole handler — observed HIT, HIT, HIT, age 43s
- `src/app/api/events/following/route.ts` lines whole handler — observed MISS, STALE, HIT, age 96s

**Evidence.** [`cache/cache-matrix.csv`](./cache/cache-matrix.csv)

**Reproduction.**

1. Read vercel.json:12 — the /api/(.*) rule attaches `s-maxage=60, stale-while-revalidate=300` by path, not by response.
2. Run `bash .planning/audit/tools/cache-probe.sh` with PROD_HOST set; observe x-vercel-cache HIT or STALE with non-zero age on the eight routes listed in cache/cache-matrix.csv with verdict latent-hazard.
3. Inspect any captured header file under cache/curl/ and confirm the vary header reads accept-encoding only.
4. Confirm the harness is valid: cache/curl-summary.json records the positive control (/api/clubs/featured) at HIT with age 47.

**Recommended fix.** Remove the blanket /api/(.*) cache rule from vercel.json and set Cache-Control per handler. Personalized responses get `private, no-store` (48 routes per the cache_policy_target column); genuinely public ones keep a shared directive and add `Vary: Cookie` as a defence in depth. Never attach a caching header by path, because the header then applies to the 401 as well as the 200.

**Validation criterion.** Re-run the two-session probe with COOKIE_A and COOKIE_B supplied and assert that no personalized route returns x-vercel-cache HIT for session B after session A populated it, and that every personalized route's Cache-Control contains `private` or `no-store`.

**Related.** [F-026](#f-026), [F-027](#f-027), [F-028](#f-028)

---

### F-002 — Reminder cron route compares the Authorization header against the fixed literal 'Bearer undefined'

**Severity:** High · **Category:** authz · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Fail-open shape on a machine path in front of a service-role client. The check still runs, but its comparison target is a template literal interpolating an unset variable, so it degrades to one well-known constant rather than disappearing. CRON_SECRET is confirmed absent from production. Bounded below Critical only because the caller must send an exact known string rather than nothing at all.

**Affected paths.**

- `src/app/api/cron/send-reminders/route.ts` lines 6-13

**Evidence.** [`authz/fail-open-register.md#fo-02`](./authz/fail-open-register.md#fo-02)

**Reproduction.**

1. Read src/app/api/cron/send-reminders/route.ts:9 — the comparison target is a template literal over process.env.CRON_SECRET.
2. Confirm CRON_SECRET is not configured in production via .planning/audit/raw/vercel/env-names.json.
3. Send `curl -H 'Authorization: Bearer undefined' https://<host>/api/cron/send-reminders`; the comparison succeeds and line 13 constructs a service-role client.

**Recommended fix.** Copy the fail-closed shape from src/app/api/cron/send-feedback-requests/route.ts:8-12 — a separate presence check that returns 500 before any comparison, then a constant-time comparison of the supplied token. Do not fold the presence check into the comparison; folding them is precisely how F-001 fails. If the handler is to be deleted instead (see F-037), delete it rather than guarding it.

**Validation criterion.** A test asserting that with CRON_SECRET unset the route returns 500 for every caller, and with it set returns 401 for a wrong token and 200 only for the correct one. A grep asserting no `Bearer ${` template literal appears in any comparison under src/app/api/cron/.

**Related.** [F-037](#f-037), [F-040](#f-040)

---

### F-005 — The public user profile page reads another user's email and interest tags on a service-role client with no authentication

**Severity:** High · **Category:** authz · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Anonymous-reachable personal-data disclosure with no compensating control. generateMetadata() constructs the RLS-bypassing client with no session read at all, and the page body's getUser() does not help: its only branch redirects a self-view to /profile, so an anonymous request falls straight through to the second construction. The user-supplied path parameter is passed directly into the filter. This is the only `unjustified` verdict in the entire service-role register and the only page classified `unprotected_but_should_be`.

**Affected paths.**

- `src/app/users/[id]/page.tsx` lines 33-48
- `src/app/users/[id]/page.tsx` lines 56
- `src/app/users/[id]/page.tsx` lines 63

**Evidence.** [`authz/service-role-register.md#users-id-page`](./authz/service-role-register.md#users-id-page)

**Reproduction.**

1. Read src/app/users/[id]/page.tsx:33-48 — generateMetadata() builds the service-role client before any session is read.
2. Read line 56 — the getUser() result is used only to redirect when the viewed id equals the caller's own id.
3. Read line 63 — the second service-role construction selects email, visibility and interest_tags filtered on the path parameter.
4. Request /users/<any other user id> with no cookies; the page renders and the metadata is generated from the privileged read.

**Recommended fix.** Read the profile on the cookie client so the users table's row-level policies apply, and select only the columns a public profile needs — never email. If a privileged read is genuinely required, gate it behind an explicit viewer check that honours the visibility column, and apply the same gate in generateMetadata(), which today has no gate whatsoever.

**Validation criterion.** A test asserting that an anonymous request to /users/<id> for a user whose visibility is not public returns 404 or a redirect, and a grep asserting createServiceClient() does not appear in src/app/users/[id]/page.tsx.

**Related.** [F-069](#f-069)

---

### F-008 — Event INSERT policy carries WITH CHECK (true), permitting a self-approved event with a forged created_by

**Severity:** High · **Category:** authz · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Requires authentication but crosses the moderation trust boundary: a signed-in user can insert an event with status already 'approved' and created_by set to someone else, bypassing the pending-to-approved pipeline entirely. No compensating control exists for the direct PostgREST write path — the moderation check lives in handlers the attacker simply does not use.

**Affected paths.**

- `.planning/audit/rls/rls-review.md` lines 166
- `.planning/audit/rls/rls-review.md` lines 160-211

**Evidence.** [`rls/rls-review.md#3a`](./rls/rls-review.md#3a)

**Reproduction.**

1. Read .planning/audit/rls/pg_policies.json for `events :: Authenticated users can insert events` — cmd INSERT, roles {authenticated}, with_check `true`.
2. As any signed-in user, POST /rest/v1/events with {"status":"approved","created_by":"<another user id>"}; the row is accepted and appears in the public approved feed.

**Recommended fix.** Replace the policy with `WITH CHECK (auth.uid() = created_by AND status = 'pending')`. Approval then has no path except the moderation handler, which is the control the product actually intends.

**Validation criterion.** A pgTAP test asserting that an authenticated INSERT with status 'approved' is rejected, that an INSERT with a created_by other than auth.uid() is rejected, and that an INSERT with status 'pending' and created_by = auth.uid() succeeds.

**Related.** [F-022](#f-022)

---

### F-009 — Anonymous callers can forge another user's interaction history, poisoning recommendations and popularity through an AFTER INSERT trigger

**Severity:** High · **Category:** authz · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Anonymous-reachable tampering with no compensating control, amplified by a trigger. WITH CHECK (true) with roles {public} on user_interactions, and anon holds INSERT. Forged rows both feed the tag-affinity and interaction signals consumed by compute_user_scores() and drive unbounded recomputation of event_popularity_scores. Held below Critical because the damage is to derived ranking state rather than to credentials or personal data, and because a caller-bound alternative policy already exists on the same table.

**Affected paths.**

- `.planning/audit/rls/rls-review.md` lines 167
- `.planning/audit/rls/rls-review.md` lines 196-211

**Evidence.** [`rls/rls-review.md#3a`](./rls/rls-review.md#3a)

**Reproduction.**

1. Read .planning/audit/rls/pg_policies.json for `user_interactions :: Anyone can insert interactions` — INSERT, {public}, with_check `true`.
2. With no session, POST /rest/v1/user_interactions with an arbitrary user_id and event_id; the row is accepted.
3. Observe the AFTER INSERT trigger recomputing event_popularity_scores for the named event.

**Recommended fix.** Drop the unconditional policy and keep only the two caller-bound siblings already present on the table (`WITH CHECK (auth.uid() = user_id OR user_id IS NULL)` for authenticated, and the anonymous-insert policy scoped so user_id must be NULL). Rate-limit the anonymous path, because the trigger makes each insert expensive.

**Validation criterion.** A pgTAP test asserting that an anon INSERT naming a non-null user_id is rejected, and that an authenticated INSERT naming another user's id is rejected.

**Related.** [F-010](#f-010), [F-041](#f-041)

---

### F-010 — Any authenticated user can insert, update or delete any row in event_popularity_scores

**Severity:** High · **Category:** authz · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Crosses the tenant boundary for every event in the system: the policy's cmd is ALL and its role targeting sits in the predicate (auth.role() = 'authenticated') rather than in a TO clause, so it covers INSERT, UPDATE and DELETE for every signed-in caller. Ranking becomes attacker-controlled, and all five handlers reading this table use the cookie client, so nothing downstream re-derives the value. No compensating control.

**Affected paths.**

- `.planning/audit/rls/rls-review.md` lines 333
- `.planning/audit/rls/rls-heatmap.csv` lines public.event_popularity_scores row

**Evidence.** [`rls/rls-review.md#4b`](./rls/rls-review.md#4b)

**Reproduction.**

1. Read .planning/audit/rls/pg_policies.json for `event_popularity_scores :: Authenticated users can update popularity scores` — cmd ALL, roles {public}, predicate contains auth.role() = 'authenticated'.
2. As any signed-in user, DELETE /rest/v1/event_popularity_scores?event_id=eq.<any event>; the row is removed.
3. As the same user, POST a replacement row with an arbitrary score; the feed ranking changes.

**Recommended fix.** Restrict writes to the service role: drop the ALL policy, and if a read policy is wanted keep only a SELECT policy. Recomputation runs as compute_user_scores() and through the service-role handlers, neither of which needs a policy. Move role targeting out of predicates and into TO clauses across the board.

**Validation criterion.** A pgTAP test asserting that an authenticated INSERT, UPDATE and DELETE on event_popularity_scores are all rejected, while a SELECT succeeds and the scheduled recomputation still writes.

**Related.** [F-021](#f-021), [F-023](#f-023)

---

### F-011 — The attendance graph in rsvps is world-readable by anonymous callers, on a table declared by no migration

**Severity:** High · **Category:** authz · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Anonymous-reachable disclosure of who is attending what, attributable per account, with no compensating control — six of the eight handlers touching rsvps are RLS-reliant, so the policy is the only ring. Compounded by the table existing in production with no schema-as-code anywhere, so a rebuilt environment does not reproduce it and no review of the repository would have found this policy.

**Affected paths.**

- `.planning/audit/rls/rls-review.md` lines 216
- `.planning/audit/rls/rls-review.md` lines 225-238

**Evidence.** [`rls/rls-review.md#3b`](./rls/rls-review.md#3b)

**Reproduction.**

1. Read .planning/audit/rls/pg_policies.json for `rsvps :: Anyone can view rsvps` — SELECT, roles {public}, qual `true`.
2. With no session, GET /rest/v1/rsvps?select=user_id,event_id,status; every row in the table is returned.
3. Confirm in .planning/audit/schema/drift.md that all six rsvps columns are classified prod-only — no migration creates the table.

**Recommended fix.** Replace USING (true) with a predicate binding the row to the caller or to an event the caller organizes, and expose aggregate counts through a view or a security-definer function instead of raw rows. Separately, create the table in a migration so the policy set is reviewable from the repository (F-044).

**Validation criterion.** A pgTAP test asserting that an anon SELECT on rsvps returns zero rows, that a user sees only their own rsvps, and that an event organizer sees the attendee list for their own events only.

**Related.** [F-044](#f-044), [F-013](#f-013)

---

### F-012 — The live policy set and the repository disagree: 41 production policies are declared by no migration and 24 declared policies are absent from production

**Severity:** High · **Category:** schema-drift · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** This finding is the failure of the compensating control itself. 41 of 101 live policies (41%) exist only in production, so a code review of supabase/migrations/ cannot see the rules that actually govern the data — which is how the two Criticals and four of the five Highs survived. In the other direction, 24 migration-declared policies never reached production, which is how two live functional breaks (F-016, F-017) arose. Any certification run against a rebuilt environment is measuring a different system.

**Affected paths.**

- `.planning/audit/rls/rls-review.md` lines 475-497
- `.planning/audit/rls/rls-review.md` lines 498-536
- `supabase/migrations` lines 44 files, 24 declared policies absent from production

**Evidence.** [`rls/rls-review.md#6`](./rls/rls-review.md#6)

**Reproduction.**

1. Run the reconciliation recorded in .planning/audit/rls/rls-review.md § 6 against .planning/audit/rls/pg_policies.json and supabase/migrations/*.sql.
2. Count policies present in pg_policies.json with no declaring migration: 41.
3. Count policies declared in a migration and absent from pg_policies.json: 24.

**Recommended fix.** Make the live policy set reproducible: dump the 41 undeclared policies into a single reconciliation migration, decide per policy whether the 24 absent ones should be applied or deleted from the repository, and add a CI check that diffs pg_policies against the declared set so the gap cannot silently reopen. This work cannot begin until the migration history replays (F-043).

**Validation criterion.** A CI job that reconciles live pg_policies against the migration-declared set and fails on any difference, run green once.

**Related.** [F-043](#f-043), [F-016](#f-016), [F-017](#f-017), [F-035](#f-035), [F-042](#f-042)

---

### F-026 — Thirty-seven auth-gated routes, including all fifteen admin handlers, sit under the same blanket shared-cache directive

**Severity:** High · **Category:** cache-exposure · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Crosses a trust boundary on authenticated and administrative paths, with no compensating control. Nothing cached during the anonymous probe because these routes answer 401 — but the anonymous 401s on /api/notifications and /api/users/saved-events both carried `s-maxage=60, stale-while-revalidate=300`, proving the header is attached by path rather than by response. An authorized caller's 200 on any of those paths is therefore storable and re-servable to an unauthorized one. Held below Critical because no authorized 200 was observed being stored, unlike F-025.

**Affected paths.**

- `vercel.json` lines 12
- `.planning/audit/cache/cache-matrix.csv` lines 37 rows with verdict latent-hazard on auth-gated routes

**Evidence.** [`cache/cache-matrix.csv`](./cache/cache-matrix.csv)

**Reproduction.**

1. Filter .planning/audit/cache/cache-matrix.csv for rows whose route is classified admin or authenticated in inventory/endpoints.json and whose cache_policy_today is the blanket directive: 37 rows.
2. Inspect .planning/audit/cache/curl/api_notifications.anon.1.headers.txt and confirm the 401 response carries the shared-cache directive.

**Recommended fix.** Same fix as F-025 — per-handler Cache-Control. Administrative responses must carry `private, no-store` unconditionally; there is no admin response that benefits from a shared cache.

**Validation criterion.** A test asserting that every route classified admin or authenticated in inventory/endpoints.json responds with a Cache-Control containing `private` or `no-store`, on both its success and its 401 path.

**Related.** [F-025](#f-025)

---

### F-027 — /api/auth-debug echoes the caller's own id and email with no gate, under a shared-cache directive

**Severity:** High · **Category:** cache-exposure · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Anonymous, personalized and shared-cacheable at once — the only route in the inventory with all three properties. It has no authorization check whatsoever, returns caller-identifying data, and carries the blanket s-maxage=60 directive, so a signed-in caller's identity response is storable and re-servable. It was one of the eight routes observed HIT/STALE with age 77s. Held below Critical only because the data it echoes is the caller's own rather than an arbitrary victim's.

**Affected paths.**

- `src/app/api/auth-debug/route.ts` lines 1-57
- `vercel.json` lines 12

**Evidence.** [`cache/cache-matrix.csv`](./cache/cache-matrix.csv)

**Reproduction.**

1. Read src/app/api/auth-debug/route.ts — there is no session gate before the identity fields are assembled.
2. Read .planning/audit/cache/curl/api_auth-debug.anon.2.headers.txt and .3.headers.txt — x-vercel-cache STALE then HIT, age 77.
3. Read .planning/audit/inventory/classification-rules.md § 6 row D-7.

**Recommended fix.** Delete the route. A debug endpoint that echoes identity has no place in a production deployment; if it is needed for development, gate it behind a NODE_ENV check that fails closed in production and mark the response `private, no-store`.

**Validation criterion.** A test asserting that /api/auth-debug returns 404 in a production build, and a grep asserting the route file does not exist under src/app/api/.

**Related.** [F-025](#f-025), [F-029](#f-029)

---

### F-030 — Any authenticated user can overwrite any club's logo or banner object by addressing the Storage API directly

**Severity:** High · **Category:** authz · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Crosses the club authorization boundary with no compensating control at the layer that matters. The club-logos INSERT and UPDATE policies test only bucket_id and auth.role(), with no ownership predicate. Both upload routes do perform a genuine club_members owner check — and it is bypassed simply by not using the route, because the caller holds a session token that addresses the Storage REST API directly. A trust boundary enforced in exactly one of two layers. Bounded below Critical by McGill-gated authentication and by the accidental absence of a DELETE policy.

**Affected paths.**

- `src/app/api/clubs/logo/route.ts` lines 34-45
- `src/app/api/clubs/banner/route.ts` lines 36
- `.planning/audit/storage/storage-review.md` lines 166

**Evidence.** [`storage/storage-review.md#st-01`](./storage/storage-review.md#st-01)

**Reproduction.**

1. Read .planning/audit/storage/storage-policies.json for the club-logos INSERT and UPDATE policies — the predicate tests bucket_id and auth.role() = 'authenticated' only.
2. Read src/app/api/clubs/logo/route.ts:34-45 — the route does check club_members ownership, which is the control being bypassed.
3. As any signed-in user, PUT to the Storage REST API at /storage/v1/object/club-logos/<another club's key> with the caller's own session token; the object is replaced.

**Recommended fix.** Add an ownership predicate to the club-logos INSERT and UPDATE policies that resolves the club from the object path prefix and requires the caller to be an owner in club_members — mirroring the check the route already performs. Do the same for banners (F-033). A route-level check with no policy behind it is a single-layer control on a multi-client system.

**Validation criterion.** A test where user A, an owner of club 1 but not club 2, attempts a direct Storage API upload under club 2's prefix and is rejected, while the same upload under club 1's prefix succeeds.

**Related.** [F-033](#f-033), [F-031](#f-031), [F-024](#f-024)

---

### F-038 — No email is sent by anything in the project, while three names and a Validated requirement assert otherwise

**Severity:** High · **Category:** config · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** A Validated product requirement — PROJECT.md's 'In-app notifications and email reminders' — has no implementation anywhere. No email-provider dependency exists in the project at all. Both the live pg_cron function and the dead handler insert in-app notifications rows and nothing else, while the table name email_reminder_log, the route name send-reminders and the requirement's own wording all assert an email path. Graded High rather than Medium because the gap is between what the program believes it has shipped and what exists, and that belief is load-bearing for every downstream phase: email_reminder_log holds exactly 0 rows, which is consistent with both 'working and idle' and 'never implemented' unless someone checks.

**Affected paths.**

- `package.json` lines dependencies — no email provider declared
- `.planning/audit/async/cron-webhook-inventory.md` lines § 2.6
- `.planning/PROJECT.md` lines Validated: 'In-app notifications and email reminders'

**Evidence.** [`async/cron-webhook-inventory.md#cw-02`](./async/cron-webhook-inventory.md#cw-02)

**Reproduction.**

1. Search package.json for any email provider (resend, sendgrid, nodemailer, postmark, ses): zero matches.
2. Read .planning/audit/raw/prod/functions.json for send_event_reminders() and confirm it only inserts into notifications.
3. Read src/app/api/cron/send-reminders/route.ts and confirm the same.
4. Read .planning/audit/raw/prod/exact-counts.json — email_reminder_log holds exactly 0 rows.

**Recommended fix.** Decide the product question first: either implement the email path with a provider and a delivery log, or rename email_reminder_log and the route to say 'notification', and correct PROJECT.md's Validated line. Do not leave three names asserting a capability that does not exist — that is how the next reader concludes the feature works and does not test it.

**Validation criterion.** Either an integration test asserting an email is dispatched and logged for a due reminder, or a grep asserting no identifier in the codebase contains 'email' for a path that only writes in-app notifications, plus a corrected PROJECT.md line.

**Related.** [F-037](#f-037), [F-041](#f-041)

---

### F-039 — The events-webhook edge function is deployed and ACTIVE with verify_jwt disabled, built from a developer's local checkout

**Severity:** High · **Category:** config · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** An anonymously reachable ingestion endpoint with no gateway authentication — verify_jwt is false, so the platform performs no JWT check and all request-level authentication must be implemented inside the function body. An in-body HMAC check does exist and was verified, which is the compensating control that holds this below Critical. Two further facts raise it above Medium: the function has no replay protection or deduplication on an HMAC-authenticated endpoint, and it was deployed from a different developer's local filesystem rather than from CI, so the deployed code is not provably the code in this repository.

**Affected paths.**

- `supabase/functions/events-webhook/index.ts` lines 99
- `.planning/audit/raw/prod/edge-functions.json` lines events-webhook row: verify_jwt false, version 3

**Evidence.** [`raw/prod/edge-functions.json`](./raw/prod/edge-functions.json)

**Reproduction.**

1. Read .planning/audit/raw/prod/edge-functions.json — events-webhook, status ACTIVE, version 3, verify_jwt false, entrypoint_path redacted to a non-CI local filesystem path.
2. Read supabase/functions/events-webhook/index.ts and confirm the HMAC verification runs before the body is processed, and that no nonce, timestamp window or delivery-id deduplication is applied.
3. Note line 99's comment asserting club_id and status are absent from events, which the column census disproves (F-050).

**Recommended fix.** Add replay protection: a timestamp window plus a delivery-id dedupe table, both checked before the body is processed. Redeploy from CI so the deployed artifact is traceable to a commit. Leave verify_jwt false only if the in-body HMAC is the intended control, and document that decision beside the function.

**Validation criterion.** A test replaying a previously accepted, validly-signed payload and asserting it is rejected, plus a deployment record showing the function was built by CI from a named commit.

**Related.** [F-050](#f-050), [F-042](#f-042)

---

### F-040 — Only three environment variables are configured in production; ADMIN_API_KEY, CRON_SECRET and ADMIN_EMAILS are all absent

**Severity:** High · **Category:** config · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** This is the fact that converts three conditional findings into live ones. F-001's admin gate is skipped entirely, F-002's comparison degrades to a known literal, and F-004's allowlist is empty — all because the variables their code reads are not set. Graded High in its own right because the configuration surface the code believes it has is three times larger than what exists, so any reasoning about the deployment from the source alone is wrong.

**Affected paths.**

- `.planning/audit/raw/vercel/env-names.json` lines three names, production scope
- `src/app/api/admin/calculate-popularity/route.ts` lines 57-61
- `src/app/api/cron/send-reminders/route.ts` lines 9

**Evidence.** [`raw/vercel/env-names.json`](./raw/vercel/env-names.json)

**Reproduction.**

1. Read .planning/audit/raw/vercel/env-names.json — exactly three variable names are configured for the production environment.
2. Grep src/ for process.env references and compare the set; ADMIN_API_KEY, CRON_SECRET and ADMIN_EMAILS are read by code and configured nowhere.

**Recommended fix.** Add a startup assertion that every environment variable the code reads is present, failing the deployment rather than degrading silently. Then decide per variable whether to configure it or to delete the code that reads it — F-001 and F-002 argue for deleting the shared-secret gates entirely in favour of verifyAdmin() and pg_cron.

**Validation criterion.** A boot-time check enumerating required variables that fails the build or the first request when any is absent, plus a test asserting the check fires.

**Related.** [F-001](#f-001), [F-002](#f-002), [F-004](#f-004)

---

### F-043 — The migration history does not replay from zero — the reset aborts at the 12th of 44 files

**Severity:** High · **Category:** schema-drift · **Status:** Open · **Closes in phase:** 03

**Exposure rationale.** Blocking defect for every downstream phase that needs a reproducible environment, and the root cause of several other findings being unfixable in isolation (F-012, F-016, F-035, F-042 all sequence behind it). This is not 'input not supplied': Docker was up and all 44 migration files are present and tracked. The repository's own history is the blocker. Two distinct causes compound — one file is silently skipped because its name does not parse, and two files derive the same version and collide on the primary key of supabase_migrations.schema_migrations.

**Affected paths.**

- `supabase/migrations/008b_add_is_admin_to_users.sql` lines filename — version does not parse, file is silently skipped
- `supabase/migrations/011_event_images_bucket.sql` lines filename — derives version 011
- `supabase/migrations/011_rls_audit.sql` lines filename — also derives version 011, aborts the replay

**Evidence.** [`schema/local-reset.txt`](./schema/local-reset.txt)

**Reproduction.**

1. Run `supabase db reset` against a local containerised database.
2. Observe 'Skipping migration 008b_add_is_admin_to_users.sql' with exit status 0 — the file is not applied and nothing fails.
3. Observe the abort at the 12th of 44 files when 011_rls_audit.sql violates the primary key already taken by 011_event_images_bucket.sql.
4. Read .planning/audit/schema/local-reset.txt for the full transcript, and .planning/audit/schema/drift.md for the three further collisions (008, 20260305000002, 20260306) that would abort subsequent attempts.

**Recommended fix.** Renumber the colliding files to unique, parseable versions and rename 008b so its version parses. Because production has already applied 45 versions (F-045), the renumbering must be paired with a reconciliation of supabase_migrations.schema_migrations rather than done blind — squashing the history into a single baseline migration that matches the production schema is the lower-risk option.

**Validation criterion.** `supabase db reset` completes with exit status 0 applying every migration file, and a schema census of the resulting local database matches the production catalog.

**Related.** [F-012](#f-012), [F-016](#f-016), [F-035](#f-035), [F-042](#f-042), [F-044](#f-044), [F-045](#f-045), [F-047](#f-047)

---

### F-044 — The rsvps table is created by no migration, yet policies are written for it and code reads it

**Severity:** High · **Category:** schema-drift · **Status:** Open · **Closes in phase:** 03

**Exposure rationale.** A table holding user-linked attendance state has no schema-as-code anywhere: all six of its columns are classified prod-only. 011_rls_audit.sql writes RLS policies for it and 20260313000002_recommendation_engine.sql reads it; neither creates it. 011_rls_audit.sql is also one half of the duplicate-011 pair that aborts the replay (F-043). Graded High because it makes rsvps invisible to repository review — which is how F-011, its anonymous world-read policy, survived.

**Affected paths.**

- `supabase/migrations/011_rls_audit.sql` lines writes policies for a table it does not create
- `.planning/audit/schema/drift.md` lines named consequence 1

**Evidence.** [`schema/drift.json`](./schema/drift.json)

**Reproduction.**

1. Read .planning/audit/schema/drift.json and filter for table rsvps — all six columns are prod-only.
2. Grep supabase/migrations for 'CREATE TABLE' and rsvps: no match.
3. Grep the same directory for rsvps policies and reads: matches in 011_rls_audit.sql and 20260313000002_recommendation_engine.sql.

**Recommended fix.** Add a migration creating rsvps with its production column definitions and the corrected policies from F-011, sequenced with the F-043 renumbering so the file lands in a replayable history.

**Validation criterion.** A fresh `supabase db reset` produces an rsvps table whose columns and policies match the production catalog.

**Related.** [F-011](#f-011), [F-043](#f-043), [F-046](#f-046)

---

### F-051 — next 16.2.1 carries 25 advisories, two of them critical, reachable on every request, with a fix inside the declared range

**Severity:** High · **Category:** dependency · **Status:** Open · **Closes in phase:** 03

**Exposure rationale.** A reachable set of advisories in the single most-executed production dependency. Ten of the 25 are ruled out by verified configuration or unused features (images.unoptimized, no use server, no rewrites, no i18n, no CSP nonces) and five cache-poisoning records were held open pending the cache matrix — which has since proven the shared cache does store personalized responses (F-025), so those five cannot be closed by configuration. The fix is available inside the declared ^16.0.3 range, so the remediation cost is a lockfile update rather than a migration.

**Affected paths.**

- `package.json` lines next dependency declared ^16.0.3, installed 16.2.1
- `.planning/audit/quality/dependency-report.md` lines § 3 — all 25 advisories individually dispositioned

**Evidence.** [`quality/dependency-report.md`](./quality/dependency-report.md)

**Reproduction.**

1. Read .planning/audit/quality/npm-audit.prod.json and filter advisories rooted at next: 25 records.
2. Read .planning/audit/quality/dependency-report.md § 3 for the per-advisory disposition and the five cache-poisoning records held open.

**Recommended fix.** Update next to the latest 16.x inside the declared range and re-run npm audit --omit=dev. Re-disposition the five cache-poisoning advisories against the cache matrix rather than closing them by version bump alone, because F-025 shows the precondition they need is present.

**Validation criterion.** npm audit --omit=dev reports zero High or Critical advisories rooted at next, and the five cache-poisoning records are either resolved by version or individually re-dispositioned with the cache-matrix evidence cited.

**Related.** [F-025](#f-025), [F-052](#f-052)

---

### F-052 — The vercel CLI is declared in dependencies rather than devDependencies and is imported by nothing

**Severity:** High · **Category:** dependency · **Status:** Open · **Closes in phase:** 03

**Exposure rationale.** Packaging defect with a large advisory footprint: it roots 7 of the 24 High/Critical rows in the production tree, including a critical in tar, for a package no source file imports. The severity is attack surface, not a specific exploit — a CLI in the production dependency tree ships its entire transitive closure to the runtime. It is also the highest-leverage single fix in the audit: one line retires seven rows, against npm's own advice of a 27-major-version upgrade.

**Affected paths.**

- `package.json` lines 47
- `.planning/audit/quality/dependency-report.md` lines § 7 candidate D-1

**Evidence.** [`quality/dependency-report.md#d-1`](./quality/dependency-report.md#d-1)

**Reproduction.**

1. Read package.json:47 — vercel ^32.3.0 under dependencies.
2. Grep src/ for any import of vercel: zero matches; confirmed by .planning/audit/quality/knip.out.json's unused-dependency list.
3. Read .planning/audit/quality/npm-audit.prod.json and count advisory paths rooted at vercel: 7 High/Critical rows.

**Recommended fix.** Remove vercel from dependencies entirely — the deployment platform provides its own CLI and nothing in the repository imports it. If it is wanted for local scripting, move it to devDependencies.

**Validation criterion.** npm audit --omit=dev reports no advisory path rooted at vercel, and knip reports it is no longer an unused production dependency because it is no longer a production dependency.

**Related.** [F-051](#f-051), [F-053](#f-053), [F-056](#f-056)

---

### F-003 — The entire middleware authentication ring is environment-variable-conditional and passes traffic through unauthenticated when unbound

**Severity:** Medium · **Category:** authz · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Applies to every route through the middleware matcher, but the two variables are NEXT_PUBLIC_* and are present in production, so the ring is skipped only in a misconfigured deployment rather than today. The compensating control is the layout guard ring, which covers 14 pages but no API handler. Latent hazard that becomes High the moment a deployment ships without them.

**Affected paths.**

- `src/middleware.ts` lines 10-16
- `src/middleware.ts` lines 113-115

**Evidence.** [`authz/fail-open-register.md#fo-03`](./authz/fail-open-register.md#fo-03)

**Reproduction.**

1. Read src/middleware.ts:10-16 — when either NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is falsy the function returns NextResponse.next() without constructing a client.
2. Observe that the 8-entry PROTECTED_ROUTES array at line 114 is never reached on that branch.
3. Unset either variable locally and request /profile; the redirect does not occur.

**Recommended fix.** Fail closed: throw at module load if either variable is absent, so a misconfigured deployment refuses to start rather than serving unauthenticated. A middleware that silently disables itself is worse than one that crashes, because the failure is invisible in production logs.

**Validation criterion.** A test that boots the middleware with the variables unset and asserts it throws, plus a test asserting /profile redirects an anonymous caller when they are set.

**Related.** [F-069](#f-069)

---

### F-013 — The complete social graph (user_follows, club_followers) is bulk-readable by anonymous callers

**Severity:** Medium · **Category:** authz · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Anonymous-reachable disclosure, but of association rather than of identifying content, and the users table already carries a visibility column the product intends for exactly this. Held at Medium because the exposed edges are inherently semi-public in a campus-events product; the defect is that the visibility column is ignored rather than that the data exists.

**Affected paths.**

- `.planning/audit/rls/rls-review.md` lines 217
- `.planning/audit/rls/rls-review.md` lines 239-245

**Evidence.** [`rls/rls-review.md#3b`](./rls/rls-review.md#3b)

**Reproduction.**

1. Read .planning/audit/rls/pg_policies.json for `user_follows :: Anyone can view follows` and the club_followers equivalent — SELECT, {public}, USING (true).
2. With no session, GET /rest/v1/user_follows?select=* ; every edge is returned.

**Recommended fix.** Qualify both read policies against the existing users.visibility column so a private account's edges are not returned, and expose follower counts through an aggregate view rather than raw rows.

**Validation criterion.** A pgTAP test asserting that an anon SELECT on user_follows returns no edge whose follower or followee has visibility other than public.

**Related.** [F-011](#f-011), [F-014](#f-014)

---

### F-014 — Review text is anonymously readable alongside its author's user_id

**Severity:** Medium · **Category:** authz · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Anonymous-reachable, and it links an opinion to an account, which is a stronger disclosure than the review text alone. Held at Medium because the reviews table holds 0 rows today, so there is nothing to disclose yet — but the policy is what the table will be filled under.

**Affected paths.**

- `.planning/audit/rls/rls-review.md` lines 219
- `.planning/audit/rls/rls-review.md` lines 246-248

**Evidence.** [`rls/rls-review.md#3b`](./rls/rls-review.md#3b)

**Reproduction.**

1. Read .planning/audit/rls/pg_policies.json for `reviews :: Anyone can read reviews` — SELECT, {public}, USING (true).
2. With no session, GET /rest/v1/reviews?select=user_id,body ; author linkage is returned with the text.

**Recommended fix.** Keep public read of review text but expose it through a view that omits user_id, or qualify the policy against users.visibility as in F-013. Decide the product question — are reviews attributed or anonymous — before the table has rows, because retrofitting is harder.

**Validation criterion.** A pgTAP test asserting that an anon SELECT on reviews cannot project user_id.

**Related.** [F-013](#f-013)

---

### F-015 — events.status, the predicate column of the anonymous feed policy, has no index

**Severity:** Medium · **Category:** performance · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Correctness-adjacent performance defect whose cost is paid on every anonymous feed read — the most-hit path in the product. Held at Medium because it degrades rather than breaks, and because the table is small today; it becomes a denial-of-service lever as the events table grows, which is exactly the plausible future change the SLA's Medium definition names.

**Affected paths.**

- `.planning/audit/rls/rls-review.md` lines 403-448
- `.planning/audit/rls/policy-column-indexes.json` lines events.status row

**Evidence.** [`rls/policy-column-indexes.json`](./rls/policy-column-indexes.json)

**Reproduction.**

1. Read .planning/audit/rls/policy-column-indexes.json — events.status appears with a null index name.
2. Read .planning/audit/rls/rls-review.md § 5 for the five policy-referenced columns with no index.
3. EXPLAIN a SELECT against the anonymous feed policy and observe the sequential scan.

**Recommended fix.** CREATE INDEX CONCURRENTLY on public.events (status), and review the remaining four unindexed policy columns in the same slice (F-020).

**Validation criterion.** A query asserting an index exists on events(status), plus an EXPLAIN assertion that the anonymous feed query uses it.

**Related.** [F-020](#f-020)

---

### F-016 — Club-invitation acceptance is broken in production because the invitee policies exist only in an unapplied migration

**Severity:** Medium · **Category:** config · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** A live functional break, not a security defect: an invitee can neither see nor accept their invitation because club_invitations has exactly two live policies, both is_club_owner(club_id). /api/clubs/[id]/invites is RLS-reliant, so nothing masks it. Held at Medium because it denies rather than grants access, and because the fix already exists in the repository unapplied — the compensating control is that the correct policy is written, just not deployed.

**Affected paths.**

- `supabase/migrations/20260226000001_invitee_select_update_policy.sql` lines whole file — declared, never applied
- `.planning/audit/rls/rls-review.md` lines 498-536

**Evidence.** [`rls/rls-review.md#6b`](./rls/rls-review.md#6b)

**Reproduction.**

1. Read .planning/audit/rls/pg_policies.json — club_invitations has exactly two policies, both is_club_owner(club_id).
2. Read supabase/migrations/20260226000001_invitee_select_update_policy.sql — it declares the invitee SELECT and UPDATE policies.
3. As an invited user, GET /api/clubs/<id>/invites; the invitation is not returned, and the accept path cannot update it.

**Recommended fix.** Apply the existing migration. It cannot be applied by a plain replay because the migration history aborts (F-043), so this is sequenced behind that fix or applied as a targeted reconciliation statement with the same content.

**Validation criterion.** An integration test where user A invites user B to a club, user B lists their invitations and sees it, and user B accepts it and becomes a member.

**Related.** [F-012](#f-012), [F-043](#f-043)

---

### F-017 — A/B experiment assignment silently degrades to the control path for every non-admin caller

**Severity:** Medium · **Category:** config · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Correctness defect with a compensating control that is itself the problem: experiments and experiment_variants each have exactly one live policy, an admin-only ALL, and the five migration-declared read policies are absent. /api/recommendations reads all three experiment tables on the cookie client, so a non-admin gets zero rows and falls through to control without erroring. No user-visible failure, which is why it survived — the experiment framework reports results it never actually ran.

**Affected paths.**

- `src/app/api/recommendations/route.ts` lines experiment table reads on the cookie client
- `.planning/audit/rls/rls-review.md` lines 498-536

**Evidence.** [`rls/rls-review.md#6b`](./rls/rls-review.md#6b)

**Reproduction.**

1. Read .planning/audit/rls/pg_policies.json — experiments and experiment_variants each carry one admin-only ALL policy.
2. As a non-admin signed-in user, GET /api/recommendations and observe that no variant is assigned.
3. Read .planning/audit/rls/rls-review.md § 6b for the five declared-but-absent read policies.

**Recommended fix.** Apply the missing read policies, or read the experiment tables on the service-role client with an explicit assignment write. Then add an assertion that a non-admin caller receives a variant, so a silent degradation fails a test rather than producing a null result.

**Validation criterion.** An integration test asserting a non-admin caller to /api/recommendations is assigned a variant and that experiment_assignments records it.

**Related.** [F-012](#f-012), [F-041](#f-041)

---

### F-028 — Eight personalized routes answer anonymous callers with 200 and a degraded body instead of 401

**Severity:** Medium · **Category:** cache-exposure · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** The body is degraded rather than another user's, so no cross-tenant data crosses the boundary directly. The defect is that a 200 is cacheable where a 401 would at least be a different entry, and that a caller cannot distinguish 'you are not signed in' from 'there is nothing here'. Compensating control: the degraded body contains no personal data. This is the shape that makes F-025 exploitable in practice, which is why it is recorded separately.

**Affected paths.**

- `.planning/audit/inventory/classification-rules.md` lines § 6 row D-6
- `.planning/audit/cache/cache-matrix.csv` lines the eight personalized rows with an anonymous 200

**Evidence.** [`inventory/classification-rules.md#d-6`](./inventory/classification-rules.md#d-6)

**Reproduction.**

1. Request each of the eight routes named in inventory/classification-rules.md § 6 row D-6 with no cookies and observe a 200 with an empty or degraded payload.

**Recommended fix.** Return 401 when no session is present on a personalized route, rather than a degraded 200. The status code is part of the contract and a cache keys on it.

**Validation criterion.** A test asserting that each of the eight routes returns 401 to an anonymous caller.

**Related.** [F-025](#f-025), [F-061](#f-061)

---

### F-029 — /api/health returns a full infrastructure health report, including a live auth-configuration probe, to any caller

**Severity:** Medium · **Category:** observability · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Anonymous-reachable information disclosure about infrastructure state rather than user data. Compensating control: the response was observed MISS on all three probes and is the one route the shared cache declines to store, because it emits set-cookie. The disclosure is reconnaissance value — which dependencies are reachable, whether auth is configured — not a direct compromise.

**Affected paths.**

- `src/app/api/health/route.ts` lines 160
- `.planning/audit/inventory/classification-rules.md` lines § 6 row D-8

**Evidence.** [`inventory/classification-rules.md#d-8`](./inventory/classification-rules.md#d-8)

**Reproduction.**

1. Request /api/health with no cookies and read the response body — it enumerates infrastructure checks including an auth-configuration probe.
2. Read .planning/audit/authz/getsession-register.md for the line-160 getSession() callsite, which is non-gating.

**Recommended fix.** Split the route: an unauthenticated liveness endpoint returning only a status literal, and an authenticated diagnostics endpoint behind verifyAdmin() carrying the detail. Do not replace the getSession() call with getUser() here — it errors for anonymous callers on a route that is anonymous by design; remove the unused call instead.

**Validation criterion.** A test asserting that an anonymous GET /api/health returns a body containing no dependency names, no configuration state and no error text, and that the detailed report requires an admin session.

**Related.** [F-027](#f-027), [F-059](#f-059)

---

### F-031 — club-logos has neither a file size limit nor a content-type allow-list

**Severity:** Medium · **Category:** authz · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Upload abuse on a bucket any authenticated user can write to (F-030), so the two compound. Held at Medium because production's project-wide storage ceiling was not captured and is recorded as a gap rather than assumed absent, and because authentication is still required.

**Affected paths.**

- `.planning/audit/storage/buckets.json` lines club-logos row — file_size_limit and allowed_mime_types both null
- `.planning/audit/storage/storage-review.md` lines 167

**Evidence.** [`storage/storage-review.md#st-02`](./storage/storage-review.md#st-02)

**Reproduction.**

1. Read .planning/audit/storage/buckets.json — the club-logos row has null for both file_size_limit and allowed_mime_types.

**Recommended fix.** Set file_size_limit and allowed_mime_types on the bucket to match what the upload route already validates, so the policy layer reproduces the route layer rather than trusting it.

**Validation criterion.** A test asserting that a direct Storage API upload of a non-image content type, and of a file above the limit, are both rejected for club-logos.

**Related.** [F-030](#f-030), [F-032](#f-032)

---

### F-032 — avatars has no content-type allow-list, so arbitrary content can be hosted under a user's own prefix

**Severity:** Medium · **Category:** authz · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Writes are confined to the caller's own prefix, which is the compensating control and the reason this is not F-030. What is unbounded is the number of keys under that prefix and the content type of each — the route's four-type check is not reproduced in the policy, so the bucket can host arbitrary content on the project's domain.

**Affected paths.**

- `.planning/audit/storage/buckets.json` lines avatars row — allowed_mime_types null
- `.planning/audit/storage/storage-review.md` lines 168

**Evidence.** [`storage/storage-review.md#st-03`](./storage/storage-review.md#st-03)

**Reproduction.**

1. Read .planning/audit/storage/buckets.json — the avatars row has null allowed_mime_types.
2. Upload a non-image file under the caller's own prefix through the Storage REST API; it is accepted.

**Recommended fix.** Set allowed_mime_types on avatars to the same four types the upload route validates, and set a file_size_limit. Reproduce the route's validation in the policy layer.

**Validation criterion.** A test asserting a direct Storage API upload of a non-image content type under the caller's own avatars prefix is rejected.

**Related.** [F-031](#f-031)

---

### F-033 — The banners INSERT policy tests the bucket only, while its sibling UPDATE and DELETE policies test path-prefix ownership

**Severity:** Medium · **Category:** authz · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Permits key pre-emption under another user's prefix — a caller can create an object at a key another user will later expect to own. Overwrite of live content is still blocked, because UPDATE does test the prefix, which is the compensating control that keeps this below F-030. The asymmetry between the three policies on one bucket is what makes it a defect rather than a design.

**Affected paths.**

- `.planning/audit/storage/storage-policies.json` lines banners INSERT policy
- `.planning/audit/storage/storage-review.md` lines 169

**Evidence.** [`storage/storage-review.md#st-04`](./storage/storage-review.md#st-04)

**Reproduction.**

1. Read .planning/audit/storage/storage-policies.json — the banners INSERT policy predicate names bucket_id only; the UPDATE and DELETE policies additionally test the path prefix.

**Recommended fix.** Add the same path-prefix ownership predicate to the INSERT policy that the UPDATE and DELETE policies already carry. The correct expression is three directories away in the same file.

**Validation criterion.** A test asserting that an authenticated caller cannot INSERT an object under another user's banners prefix.

**Related.** [F-030](#f-030)

---

### F-034 — A bucket-agnostic USING (true) read policy on storage.objects becomes a cross-tenant read the day a private bucket exists

**Severity:** Medium · **Category:** authz · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Latent hazard, which is the SLA's own Medium definition: grants nothing today because all four buckets are public, grants everything the day a private bucket is created. No compensating control would stand in the way at that point, because the policy does not name a bucket.

**Affected paths.**

- `.planning/audit/storage/storage-review.md` lines 170
- `.planning/audit/storage/storage-policies.json` lines Allow public read access 1oj01fe_0

**Evidence.** [`storage/storage-review.md#st-05`](./storage/storage-review.md#st-05)

**Reproduction.**

1. Read .planning/audit/storage/storage-policies.json — the policy applies USING (true) for authenticated across every bucket with no bucket_id predicate.
2. Create a private bucket in a non-production project and confirm an authenticated non-owner can read its objects.

**Recommended fix.** Add a bucket_id IN (...) predicate naming the buckets intended to be publicly readable, so the policy's scope is declared rather than unbounded.

**Validation criterion.** A test creating a private bucket and asserting an authenticated non-owner cannot read its objects.

**Related.** [F-024](#f-024)

---

### F-035 — Three of four storage buckets and thirteen object policies exist only in production, declared by no migration or config file

**Severity:** Medium · **Category:** schema-drift · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Schema drift on the storage layer: avatars, banners and club-logos exist in production and nowhere in the repository. supabase/config.toml's [storage.buckets.*] block is entirely commented out and only event-images has a migration. A rebuilt environment has a materially different storage layer, which invalidates any certification run against it — and it means no review of the repository could have found F-030 through F-034.

**Affected paths.**

- `supabase/config.toml` lines [storage.buckets.*] block, entirely commented out
- `.planning/audit/storage/storage-review.md` lines drift table

**Evidence.** [`storage/buckets.json`](./storage/buckets.json)

**Reproduction.**

1. Read .planning/audit/storage/buckets.json — the declared_in_migration flag is false for avatars, banners and club-logos.
2. Read supabase/config.toml and confirm the storage bucket block is commented out.
3. Read .planning/audit/schema/drift.md consequence 5 for the same fact reached from the schema side.

**Recommended fix.** Declare all four buckets and all fifteen object policies in migrations, with the corrected predicates from F-030 through F-034 applied at the same time, so the first schema-as-code version of the storage layer is the fixed one rather than the current one.

**Validation criterion.** A fresh `supabase db reset` followed by a bucket and policy census that matches the production catalog exactly.

**Related.** [F-012](#f-012), [F-042](#f-042), [F-043](#f-043)

---

### F-037 — Two dead cron handlers duplicate live pg_cron functions with four behavioural divergences

**Severity:** Medium · **Category:** config · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Correctness and maintenance defect with a compensating control: nothing triggers the handlers, proved three independent ways, so the divergence is dormant rather than live. The hazard is that scheduling them — the obvious reading of 'the cron route has no trigger' — would activate four divergences against the pg_cron implementations and send duplicate notifications to real users. The route is separately a live security defect as F-002.

**Affected paths.**

- `src/app/api/cron/send-reminders/route.ts` lines whole handler — no trigger from any of six sources
- `src/app/api/cron/send-feedback-requests/route.ts` lines whole handler — returns 500 to every caller
- `.planning/audit/async/cron-webhook-inventory.md` lines § 2.5 four-point divergence

**Evidence.** [`async/cron-webhook-inventory.md#cw-01`](./async/cron-webhook-inventory.md#cw-01)

**Reproduction.**

1. Read .planning/audit/async/cron-job.json — three pg_cron jobs, all invoking a public. function directly; none issues an HTTP request.
2. Read .planning/audit/raw/vercel/project.json — zero cron definitions on the deployment platform.
3. Read .planning/audit/async/vercel-crons.md for the three mechanical negatives.
4. Read .planning/audit/async/cron-webhook-inventory.md § 2.5 for the four divergences between the handler and send_event_reminders().

**Recommended fix.** Delete both handlers. The live implementation is the pg_cron function; two implementations of one workflow, one of them unreachable and divergent, is worse than one. Deleting them also closes F-002 without needing a guard.

**Validation criterion.** A grep asserting src/app/api/cron/ is empty or contains only handlers with a confirmed trigger, plus a check that the pg_cron run history continues to show zero failures after the deletion.

**Related.** [F-002](#f-002), [F-038](#f-038), [F-042](#f-042)

---

### F-041 — user_event_scores holds exactly zero rows, so personalized recommendations always take the popularity fallback

**Severity:** Medium · **Category:** config · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** A Validated capability that does not happen in production. compute_user_scores() runs on schedule with zero failures and the table is empty, so every recommendation request falls through to the popularity-ranked feed. Held at Medium rather than High because the fallback is a working product experience rather than an outage, and because the defect is discoverable only by counting rows — n_live_tup would not have shown it. Compounded by F-017: the A/B framework meant to measure recommendation quality is also degraded.

**Affected paths.**

- `src/app/api/recommendations/route.ts` lines the user_event_scores read and its fallback branch
- `.planning/audit/raw/prod/exact-counts.json` lines user_event_scores_exact_rows: 0

**Evidence.** [`raw/prod/exact-counts.json`](./raw/prod/exact-counts.json)

**Reproduction.**

1. Read .planning/audit/raw/prod/exact-counts.json — user_event_scores_exact_rows is 0, taken with count(*) rather than n_live_tup.
2. Read .planning/audit/async/cron-job.json — compute-user-scores is active with 3 of 3 runs succeeded.
3. Read src/app/api/recommendations/route.ts and follow the empty-result branch to the popularity fallback.

**Recommended fix.** Determine why compute_user_scores() writes no rows — it succeeds, so the likely causes are an empty input set (F-009's interaction table, or the tag-affinity source) or a filter that excludes everyone. Then add an alert on the table being empty after a scheduled run, so 'succeeded and wrote nothing' is not reported as success.

**Validation criterion.** A check asserting user_event_scores is non-empty after a scheduled compute_user_scores() run, and an integration test asserting a user with interaction history receives a personalized ordering distinct from the popularity ordering.

**Related.** [F-017](#f-017), [F-009](#f-009), [F-038](#f-038)

---

### F-042 — All three pg_cron jobs exist only in production; the repository's sole trace is a commented-out schedule line in a never-applied migration

**Severity:** Medium · **Category:** schema-drift · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Three live scheduled jobs mutating production data every 15, 30 and 360 minutes, none of them schema-as-code. A rebuilt environment runs nothing. Held at Medium because the jobs are working correctly — 97 successful runs, zero failures in the captured window — so the defect is reproducibility rather than behaviour. It is the same class as F-012 and F-035 and should be fixed in the same slice.

**Affected paths.**

- `supabase/migrations/20260313000002_recommendation_engine.sql` lines the commented-out cron.schedule(...) line, in a never-applied migration
- `.planning/audit/async/cron-job.json` lines three jobs: send-event-reminders, compute-user-scores, send-feedback-requests

**Evidence.** [`async/cron-job.json`](./async/cron-job.json)

**Reproduction.**

1. Read .planning/audit/async/cron-job.json — three active jobs with their schedules and run tallies.
2. Grep supabase/migrations for cron.schedule — the only occurrence is commented out, in a file whose version was never applied (.planning/audit/schema/drift.md consequence 6).

**Recommended fix.** Declare all three jobs in a migration, alongside the function bodies they call, so a rebuilt environment schedules the same work. Sequenced behind F-043.

**Validation criterion.** A fresh `supabase db reset` followed by a cron.job census matching the production job list exactly.

**Related.** [F-012](#f-012), [F-035](#f-035), [F-043](#f-043), [F-037](#f-037)

---

### F-045 — Production reports 45 applied migration versions against 44 files in the repository

**Severity:** Medium · **Category:** schema-drift · **Status:** Open · **Closes in phase:** 03

**Exposure rationale.** The counts disagree and the direction matters: production has applied something the repository does not contain, or has recorded a version the repository names differently. Held at Medium because it is a bookkeeping discrepancy with no direct exposure, but it is a hard blocker on the F-043 renumbering, which cannot be done safely against a migration table whose contents are not understood.

**Affected paths.**

- `supabase/migrations` lines 44 .sql files, all tracked
- `.planning/audit/schema/migration-list.prod.txt` lines 45 applied versions

**Evidence.** [`schema/migration-list.prod.txt`](./schema/migration-list.prod.txt)

**Reproduction.**

1. `ls supabase/migrations/*.sql | wc -l` returns 44.
2. Read .planning/audit/raw/prod/migrations-applied.json — 45 applied versions.
3. Diff the two version sets and identify the applied version with no corresponding file.

**Recommended fix.** Diff the applied set against the file set, identify the orphan version, and either recover the file from history or record a deliberate reconciliation entry. Do this before F-043's renumbering, not after.

**Validation criterion.** The applied version set and the repository file version set are identical, asserted by a CI check.

**Related.** [F-043](#f-043), [F-063](#f-063)

---

### F-046 — Seventy-six of 288 reconciled schema rows are out of sync across production, migrations and types.ts

**Severity:** Medium · **Category:** schema-drift · **Status:** Open · **Closes in phase:** 03

**Exposure rationale.** The aggregate drift picture: 39 rows exist in production with no migration declaring them, 22 are declared by a migration and absent from production, and 15 exist only in types.ts. No single row is individually dangerous, which is why this is Medium and the named consequences are separate findings — but the aggregate means the three sources cannot be used interchangeably, and any reasoning that treats types.ts or the migration set as the schema is wrong 26% of the time.

**Affected paths.**

- `.planning/audit/schema/drift.md` lines the drift table: 212 in-sync, 39 prod-only, 22 migrations-only, 15 types-only
- `src/lib/supabase/types.ts` lines 15 types-only rows

**Evidence.** [`schema/drift.md`](./schema/drift.md)

**Reproduction.**

1. Read .planning/audit/schema/drift.json and tally the drift_class field: 212 in-sync, 39 prod-only, 22 migrations-only, 0 type-mismatch, 15 types-only, 288 total.

**Recommended fix.** Reconcile in three passes, in this order: adopt the 39 prod-only rows into migrations (they are live), decide per row whether each of the 22 migrations-only rows should be applied or deleted, and regenerate types.ts from the live schema so the 15 types-only rows disappear. Add a CI check that regenerates types.ts and fails on a diff.

**Validation criterion.** The drift generator reports zero rows outside in-sync, and a CI job regenerating types.ts produces no diff.

**Related.** [F-043](#f-043), [F-044](#f-044), [F-047](#f-047), [F-048](#f-048), [F-049](#f-049)

---

### F-047 — users.is_admin is declared only by the one migration file the CLI silently skips

**Severity:** Medium · **Category:** schema-drift · **Status:** Open · **Closes in phase:** 03

**Exposure rationale.** 008b_add_is_admin_to_users.sql does not parse as <version>_<name>.sql, so the CLI prints 'Skipping' and continues with exit status 0 — a failure that reports success. On a fresh replay the column is absent, and 009_user_roles.sql guards its DROP COLUMN is_admin behind a DO $$ ... IF EXISTS block precisely because of this. Medium because production has the column; the defect is that no rebuilt environment does, and the skip is silent.

**Affected paths.**

- `supabase/migrations/008b_add_is_admin_to_users.sql` lines filename
- `supabase/migrations/009_user_roles.sql` lines the DO $$ ... IF EXISTS guard around DROP COLUMN is_admin

**Evidence.** [`schema/drift.md#consequence-2`](./schema/drift.md#consequence-2)

**Reproduction.**

1. Run `supabase db reset` and observe the Skipping line for 008b with exit status 0.
2. Read supabase/migrations/009_user_roles.sql and note the existence guard, which only makes sense if the column may be absent.

**Recommended fix.** Rename the file to a parseable unique version as part of the F-043 renumbering. Add a CI check asserting every file in supabase/migrations parses as <version>_<name>.sql, so a silent skip becomes a build failure.

**Validation criterion.** A CI check asserting every migration filename parses, run green, plus a fresh reset producing a users table whose columns match production.

**Related.** [F-043](#f-043), [F-046](#f-046)

---

### F-048 — user_engagement_summary is created by a migration and does not exist in production

**Severity:** Medium · **Category:** schema-drift · **Status:** Open · **Closes in phase:** 03

**Exposure rationale.** 005_user_engagement.sql creates the table; production has no such relation, and eleven of the 22 migrations-only rows are its columns. Medium because nothing reads it in production — but a rebuilt environment has a table the live system lacks, which is the opposite direction of drift from F-044 and just as invalidating for a certification run.

**Affected paths.**

- `supabase/migrations/005_user_engagement.sql` lines whole file — creates a relation absent from production
- `.planning/audit/schema/drift.md` lines named consequence 4

**Evidence.** [`schema/drift.md#consequence-4`](./schema/drift.md#consequence-4)

**Reproduction.**

1. Read .planning/audit/schema/drift.json and filter for table user_engagement_summary — 11 columns plus the table row, all migrations-only.
2. Read .planning/audit/raw/prod/tables.json and confirm the relation is absent.

**Recommended fix.** Decide whether the table is wanted. If yes, apply it; if no, delete the migration as part of the F-043 squash rather than leaving a creation statement that has never taken effect.

**Validation criterion.** The drift report shows no migrations-only rows for user_engagement_summary — either because it exists in production or because the migration is gone.

**Related.** [F-046](#f-046)

---

### F-053 — swagger-ui-react and two companion packages are installed, vulnerable and imported by nothing

**Severity:** Medium · **Category:** dependency · **Status:** Open · **Closes in phase:** 03

**Exposure rationale.** Dead weight carrying 6 High advisory rows. The reachability question is closed with a citable module path: the module graph cruises exactly five modules from /docs, and swagger-ui-react appears in none of them — the page reaches redoc and next-swagger-doc instead. Unreachable code cannot be exploited, which is the compensating control holding this below the reachable redoc path.

**Affected paths.**

- `package.json` lines 43
- `.planning/audit/quality/depcruise.reaches-apidocs.json` lines the five-module closure, which does not include swagger-ui-react

**Evidence.** [`quality/depcruise.reaches-apidocs.json`](./quality/depcruise.reaches-apidocs.json)

**Reproduction.**

1. Read .planning/audit/quality/depcruise.reaches-apidocs.json — five modules: src/app/docs/page.tsx to src/components/redoc/RedocUI.tsx to redoc, and src/app/docs/page.tsx to src/lib/swagger.ts to next-swagger-doc.
2. Grep src/ for swagger-ui-react: zero matches.

**Recommended fix.** Remove swagger-ui-react, @types/swagger-ui-react and @swagger-api/apidom-ns-openapi-3-1 from package.json, and delete the stale version claim in .claude/CLAUDE.md:79 in the same change rather than correcting it.

**Validation criterion.** npm audit --omit=dev reports no advisory path rooted at swagger-ui-react, and knip reports no unused production dependency.

**Related.** [F-052](#f-052), [F-054](#f-054), [F-063](#f-063)

---

### F-054 — /docs is an anonymous public route that publishes the full API surface through a shipped rendering package

**Severity:** Medium · **Category:** authz · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Anonymous-reachable information disclosure, confirmed by two independent checks: find over src/app/docs returns exactly one file, so no layout auth ring exists, and /docs is absent from the eight-entry PROTECTED_ROUTES. The reachable package (redoc) additionally carries three advisories on a path that takes first-party input, fixed by 2.5.2 to 2.5.4. Held at Medium because the disclosed content is an API description rather than data — it is reconnaissance, and reconnaissance of endpoints that are separately findings here.

**Affected paths.**

- `src/app/docs/page.tsx` lines whole file — the only file under src/app/docs, so no layout ring
- `src/middleware.ts` lines 113-114

**Evidence.** [`quality/dependency-report.md#d-3`](./quality/dependency-report.md#d-3)

**Reproduction.**

1. `find src/app/docs -type f` returns one file — there is no layout.tsx and therefore no layout auth ring.
2. Read src/middleware.ts:114 — /docs is absent from the eight PROTECTED_ROUTES entries.
3. Request /docs with no cookies; redoc renders the API surface.

**Recommended fix.** Gate /docs behind an authenticated (preferably admin) check implemented as a layout guard, not only as a PROTECTED_ROUTES entry — the middleware ring is itself environment-conditional (F-003), so a middleware-only fix evaporates when a variable is unset. Upgrade redoc to 2.5.4 in the same change.

**Validation criterion.** A test asserting an anonymous request to /docs redirects or returns 404, and that an authenticated non-admin also does not receive the API description.

**Related.** [F-003](#f-003), [F-053](#f-053), [F-029](#f-029)

---

### F-055 — The Content-Security-Policy allows both 'unsafe-inline' and 'unsafe-eval'

**Severity:** Medium · **Category:** config · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** A weakened CSP does not itself disclose or grant anything; it removes the second line of defence against an injected script. Compensating control: the header is present and the rest of the policy is restrictive, and no injection finding exists in this register. Recorded because it was noticed while dispositioning a Next.js advisory whose mitigation assumes nonce-based CSP, which this configuration cannot provide.

**Affected paths.**

- `next.config.js` lines the headers() CSP directive

**Evidence.** [`quality/dependency-report.md#d-6`](./quality/dependency-report.md#d-6)

**Reproduction.**

1. Read the headers() block in next.config.js and observe 'unsafe-inline' and 'unsafe-eval' in the script-src directive.
2. Request any page and inspect the Content-Security-Policy response header.

**Recommended fix.** Move to a nonce-based CSP, which Next.js supports through middleware, and drop both unsafe directives. This also restores the mitigation path that one of the next advisories in F-051 assumes.

**Validation criterion.** A test asserting the CSP response header contains neither 'unsafe-inline' nor 'unsafe-eval', and that the application still renders without console CSP violations.

**Related.** [F-051](#f-051)

---

### F-058 — Twenty-two of ninety-four route files have no error handling, and no route on any path carries request correlation or rate limiting

**Severity:** Medium · **Category:** observability · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Operational blindness rather than a direct exposure. Three measured integers: 22 route files with no try/catch, 0 request-correlation callsites across the whole codebase, and 0 rate-limiting callsites on administrative paths. The consequence is that every other finding here is harder to detect in production and impossible to attribute to a request. The absence of rate limiting on /api/admin/* is what makes F-001 and F-002 unbounded rather than merely open.

**Affected paths.**

- `.planning/audit/quality/error-observability.md` lines the five integers with their derivations
- `src/app/api` lines 22 of 94 route.ts files with no try/catch

**Evidence.** [`quality/error-observability.md`](./quality/error-observability.md)

**Reproduction.**

1. Read .planning/audit/quality/error-observability.md — routes_without_try_catch 22, request_correlation_callsite_count 0, with the exact commands that re-derive each.
2. Re-run the published scan with command grep to reproduce both integers.

**Recommended fix.** Adopt a shared route wrapper that supplies try/catch, a request id propagated into every log line, and a rate limiter, then apply it to all 94 handlers. Doing it per handler will leave the same 22 behind.

**Validation criterion.** A check asserting every file under src/app/api/**/route.ts exports handlers wrapped by the shared wrapper, and a test asserting an admin route returns 429 after the configured request budget.

**Related.** [F-059](#f-059), [F-060](#f-060), [F-001](#f-001)

---

### F-059 — Twenty-two route files return internal error text to the caller across forty sites

**Severity:** Medium · **Category:** observability · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Information disclosure across the anonymous trust boundary: Supabase error messages carry table names, column names and constraint names into response bodies. Held at Medium because the disclosure is schema reconnaissance rather than data, and because the count excludes server-side logging and throw sinks, which are correct — only text that crosses into the response body is counted. Five catch (error: any) clauses, all in /api/health, are the widest of them.

**Affected paths.**

- `.planning/audit/quality/error-observability.md` lines routes_leaking_internal_error_text 22 files, 40 sites
- `src/app/api/health/route.ts` lines the five catch (error: any) clauses

**Evidence.** [`quality/error-observability.md`](./quality/error-observability.md)

**Reproduction.**

1. Read .planning/audit/quality/error-observability.md for the per-file list and the verbatim scan command.
2. Trigger a constraint violation on any of the 22 routes and read the response body.

**Recommended fix.** Return a fixed error code and a generic message to the caller, log the internal text server-side with the request id from F-058. Type the catch clauses as unknown rather than any, so the compiler forces the narrowing that currently does not happen.

**Validation criterion.** A grep asserting no route handler interpolates a caught error's message into a NextResponse body, and a test asserting a constraint violation returns a generic body.

**Related.** [F-058](#f-058), [F-029](#f-029)

---

### F-061 — Twenty-two admin handlers answer an anonymous caller with 403 where the contract says 401

**Severity:** Medium · **Category:** validation · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** A systemic contract defect: verifyAdmin() has no user == null branch distinct from the role failure, so 'not signed in' and 'signed in without the role' are indistinguishable to a caller and to any test. No data crosses a boundary, which holds it at Medium — but it means no test can assert the difference, and a client cannot know whether to prompt for sign-in.

**Affected paths.**

- `src/lib/admin.ts` lines verifyAdmin — no distinct null-user branch
- `.planning/audit/inventory/classification-rules.md` lines § 6 row D-4

**Evidence.** [`inventory/classification-rules.md#d-4`](./inventory/classification-rules.md#d-4)

**Reproduction.**

1. Request any /api/admin/* route with no cookies and observe 403.
2. Read src/lib/admin.ts and confirm both failure modes return the same status.

**Recommended fix.** Add an explicit null-user branch to verifyAdmin() returning 401, leaving 403 for an authenticated caller without the role. Update the expected_status column in inventory/endpoints.json in the same change so the contract and the code agree.

**Validation criterion.** A test asserting an anonymous request to an admin route returns 401 and an authenticated non-admin request returns 403.

**Related.** [F-028](#f-028), [F-062](#f-062)

---

### F-062 — The ban ring answers JSON API calls with a 307 redirect to an HTML page, on ninety-two routes

**Severity:** Medium · **Category:** validation · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** A systemic contract defect affecting nearly every route: a banned user's API call receives a redirect to an HTML page rather than a JSON error, so any client parsing the response gets HTML where it expects JSON. No boundary is crossed and no data leaks — the ban is enforced — but the enforcement is unusable by the API's own consumers and untestable as a JSON contract.

**Affected paths.**

- `src/middleware.ts` lines the ban-check redirect branch
- `.planning/audit/inventory/classification-rules.md` lines § 6 row D-5

**Evidence.** [`inventory/classification-rules.md#d-5`](./inventory/classification-rules.md#d-5)

**Reproduction.**

1. As a banned user, request any of the 92 affected API routes and observe a 307 with a Location header pointing at an HTML page.

**Recommended fix.** Branch on the request path in the ban check: redirect page requests, return 403 with a JSON body for anything under /api/.

**Validation criterion.** A test asserting a banned user's request to an /api/ route returns 403 with a JSON content type, and that the same user's request to a page still redirects.

**Related.** [F-061](#f-061)

---

### F-004 — The auth callback grants the admin role from an ADMIN_EMAILS allowlist read at request time

**Severity:** Low · **Category:** authz · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Fails closed today: ADMIN_EMAILS is not configured in production, so the empty allowlist promotes nobody. Registered rather than dismissed because the same block is the only automatic privilege-grant path in the codebase — a future edit to the allowlist is a privilege escalation, not a configuration tweak, and it runs on a service-role client. The onboarding half of the same block fails open, skipping profile sync entirely when the variable is absent.

**Affected paths.**

- `src/app/auth/callback/route.ts` lines 22-29
- `src/app/auth/callback/route.ts` lines 162-199

**Evidence.** [`authz/fail-open-register.md#fo-05`](./authz/fail-open-register.md#fo-05)

**Reproduction.**

1. Read src/app/auth/callback/route.ts:22-29 for the allowlist parse and :187-193 for the role grant.
2. Confirm ADMIN_EMAILS is absent from .planning/audit/raw/vercel/env-names.json, so the parsed list is empty.
3. Observe that line 164 constructs a service-role client for the profile-sync block, which is skipped wholesale on the same condition.

**Recommended fix.** Move administrative role assignment out of the sign-in path entirely: grant admin through an audited, logged administrative action that writes admin_audit_log, not through an environment variable read on every callback. Separate the onboarding profile sync from the role grant so the two do not share a failure condition.

**Validation criterion.** A test asserting that completing sign-in never writes to users.roles regardless of the ADMIN_EMAILS value, and a test asserting profile sync runs even when ADMIN_EMAILS is unset.

**Related.** [F-007](#f-007), [F-040](#f-040)

---

### F-018 — 61 of 101 policies carry no TO clause; 39 rely on an auth.uid()-bearing predicate rather than role targeting to exclude anon

**Severity:** Low · **Category:** authz · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** Hygiene with a real latent edge. The 39 are genuinely shut today because auth.uid() is NULL for anon, so no data is exposed — but the mechanism is accidental rather than declared, and a future predicate rewrite that drops the auth.uid() reference silently opens the policy to anonymous callers. There is no TO anon policy anywhere, which is the reason the current state holds.

**Affected paths.**

- `.planning/audit/rls/rls-review.md` lines 273-322
- `.planning/audit/rls/rls-flags.json` lines no-to-clause flag class

**Evidence.** [`rls/rls-review.md#4`](./rls/rls-review.md#4)

**Reproduction.**

1. Read .planning/audit/rls/pg_policies.json and count rows where roles = {public}: 61.
2. Read .planning/audit/rls/rls-review.md § 4a for the breakdown of what actually holds each of them shut.

**Recommended fix.** Add an explicit TO clause to every policy, so role targeting is declared rather than inferred from the predicate. This is mechanical and safe: for the 39, TO authenticated preserves current behaviour exactly.

**Validation criterion.** A query asserting that no policy in the public schema has roles = {public} unless it is deliberately registered as a public-read policy in a documented allowlist.

**Related.** [F-023](#f-023)

---

### F-019 — 68 unwrapped auth.uid() occurrences across 59 policies are re-evaluated per row

**Severity:** Low · **Category:** performance · **Status:** Open

**Exposure rationale.** Pure performance hygiene with no exposure. Exactly 1 of 101 policies wraps the call as (select auth.uid()); the rest pay a function call per candidate row. Cost is invisible at current table sizes and grows linearly with them.

**Affected paths.**

- `.planning/audit/rls/rls-review.md` lines 298-322
- `.planning/audit/rls/rls-flags.json` lines unwrapped-auth-uid flag class

**Evidence.** [`rls/rls-flags.json`](./rls/rls-flags.json)

**Reproduction.**

1. Read .planning/audit/rls/pg_policies.json and count occurrences of auth.uid() not preceded by a select: 68 across 59 policies.

**Recommended fix.** Rewrite every auth.uid() reference in a policy predicate as (select auth.uid()) so Postgres evaluates it once per statement rather than once per row. Mechanical, behaviour-preserving.

**Validation criterion.** A query asserting that no policy expression contains auth.uid() outside a subselect.

**Related.** [F-015](#f-015), [F-020](#f-020)

---

### F-020 — Four policy-referenced columns on featured_events and moderation_reviews have no index

**Severity:** Low · **Category:** performance · **Status:** Open

**Exposure rationale.** Performance hygiene on low-traffic administrative and curation paths. Partly anonymous-reachable through featured_events, but the table is small and the read is not on the hot feed path, so the cost is bounded.

**Affected paths.**

- `.planning/audit/rls/policy-column-indexes.json` lines featured_events and moderation_reviews rows
- `.planning/audit/rls/rls-review.md` lines 403-448

**Evidence.** [`rls/policy-column-indexes.json`](./rls/policy-column-indexes.json)

**Reproduction.**

1. Read .planning/audit/rls/policy-column-indexes.json and filter for rows with a null index name; four remain once events.status (F-015) is excluded.

**Recommended fix.** Add the four indexes in the same slice that fixes F-015, so the policy-column index set is complete rather than partially corrected.

**Validation criterion.** A query asserting that every column referenced by a policy predicate in the public schema is covered by an index.

**Related.** [F-015](#f-015)

---

### F-021 — event_popularity_scores carries two byte-identical permissive USING (true) SELECT policies

**Severity:** Low · **Category:** authz · **Status:** Open

**Exposure rationale.** Anonymous-reachable but grants nothing beyond what a single policy grants — permissive policies are OR-ed. The hazard is a maintenance trap: revoking public read requires dropping both, and dropping one appears to change nothing, which is exactly how the other survives a cleanup.

**Affected paths.**

- `.planning/audit/rls/rls-review.md` lines 255-256

**Evidence.** [`rls/rls-review.md#3c`](./rls/rls-review.md#3c)

**Reproduction.**

1. Read .planning/audit/rls/pg_policies.json for `Allow public read access to event_popularity_scores` and `Anyone can view popularity scores` — both SELECT, both USING (true), on the same table.

**Recommended fix.** Drop one of the two policies. Do it in the same slice as F-010 so the table's whole policy set is decided at once rather than in two passes.

**Validation criterion.** A query asserting that no table in the public schema has two permissive SELECT policies with identical qual expressions.

**Related.** [F-010](#f-010)

---

### F-022 — Pending and rejected clubs are publicly readable, because the club read policy ignores the status column

**Severity:** Low · **Category:** authz · **Status:** Open

**Exposure rationale.** Anonymous-reachable, but the content is a club directory entry that is intended to be public once approved — the disclosure is of pre-approval existence, not of private data. The asymmetry with events, whose anonymous read policy correctly filters on status = 'approved', is what makes this a defect rather than a design.

**Affected paths.**

- `.planning/audit/rls/rls-review.md` lines 253
- `.planning/audit/rls/rls-review.md` lines 254

**Evidence.** [`rls/rls-review.md#3c`](./rls/rls-review.md#3c)

**Reproduction.**

1. Read .planning/audit/rls/pg_policies.json for `clubs :: Anyone can read clubs` — SELECT, {public}, USING (true), with no status predicate.
2. With no session, GET /rest/v1/clubs?status=eq.pending ; rows are returned.

**Recommended fix.** Qualify the policy to `USING (status = 'approved')`, matching the events policy. Do the same for featured_clubs, whose read policy publishes unpublished curation while the sibling featured_events policy is correctly time-scoped.

**Validation criterion.** A pgTAP test asserting that an anon SELECT on clubs returns no row whose status is not 'approved'.

**Related.** [F-008](#f-008)

---

### F-023 — Twelve policies inline the admin EXISTS subquery instead of calling is_admin(); only six call the helper

**Severity:** Low · **Category:** authz · **Status:** Open

**Exposure rationale.** Hygiene with a correctness edge: twelve copies of a privilege predicate across eleven tables means a change to the definition of 'admin' must be applied twelve times, and a missed copy is a silent authorization divergence. No current exposure — all twelve are equivalent today.

**Affected paths.**

- `.planning/audit/rls/rls-review.md` lines 376-402
- `.planning/audit/rls/rls-flags.json` lines inlined-admin-exists flag class

**Evidence.** [`rls/rls-review.md#4d`](./rls/rls-review.md#4d)

**Reproduction.**

1. Read .planning/audit/rls/pg_policies.json and count predicates containing the literal EXISTS (SELECT 1 FROM users ... 'admin'::user_role = ANY(users.roles)): 12, against 6 calls to is_admin().

**Recommended fix.** Replace all twelve inline subqueries with is_admin(). One definition, one place to change, one place to test.

**Validation criterion.** A query asserting that no policy expression in the public schema contains an inline admin EXISTS subquery.

**Related.** [F-018](#f-018)

---

### F-024 — Any authenticated user can read every object in every storage bucket

**Severity:** Low · **Category:** authz · **Status:** Open

**Exposure rationale.** Grants nothing today because all four buckets are already public, so the policy adds no exposure a URL does not already give. Registered because it becomes an immediate cross-tenant read the day a private bucket is created — the latent-hazard shape the SLA's Medium definition anticipates, held at Low only because no private bucket exists.

**Affected paths.**

- `.planning/audit/storage/storage-review.md` lines 170
- `.planning/audit/storage/storage-policies.json` lines Allow public read access 1oj01fe_0

**Evidence.** [`storage/storage-review.md#st-05`](./storage/storage-review.md#st-05)

**Reproduction.**

1. Read .planning/audit/storage/storage-policies.json for `Allow public read access 1oj01fe_0` — USING (true) for authenticated, with no bucket_id predicate.
2. Confirm in .planning/audit/storage/buckets.json that all four buckets have public = true, so the policy is currently redundant.

**Recommended fix.** Scope the policy to the buckets that are intended public by adding a bucket_id predicate, so creating a private bucket does not silently inherit universal authenticated read.

**Validation criterion.** A test creating a private bucket and asserting that an authenticated caller who does not own an object in it cannot read that object.

**Related.** [F-030](#f-030), [F-034](#f-034)

---

### F-036 — event-images carries two byte-identical permissive SELECT policies

**Severity:** Low · **Category:** config · **Status:** Open

**Exposure rationale.** Hygiene with a maintenance trap identical in shape to F-021: revoking public read requires dropping both, and dropping only the migration-declared one leaves the bucket open while appearing closed. No current exposure beyond what the public bucket flag already grants.

**Affected paths.**

- `.planning/audit/storage/storage-review.md` lines 172
- `.planning/audit/storage/storage-policies.json` lines the two event-images SELECT policies

**Evidence.** [`storage/storage-review.md#st-07`](./storage/storage-review.md#st-07)

**Reproduction.**

1. Read .planning/audit/storage/storage-policies.json and compare the two event-images SELECT policies — identical predicates, one declared in a migration and one not.

**Recommended fix.** Drop the undeclared duplicate, keeping the migration-declared policy so the repository remains the source of truth.

**Validation criterion.** A query asserting no bucket has two permissive SELECT policies with identical predicates.

**Related.** [F-021](#f-021), [F-035](#f-035)

---

### F-049 — events_tests exists only in types.ts — created out of band, dropped out of band, its cleanup migration never applied

**Severity:** Low · **Category:** schema-drift · **Status:** Open

**Exposure rationale.** Dead schema surface with no exposure: the relation does not exist in production and is not created by any migration. All fifteen types-only rows are its columns plus its table row. The only migration mentioning it is a DROP TABLE IF EXISTS in a file whose version was never applied. Hygiene, but a clear record of a table that was created and dropped entirely outside the migration system.

**Affected paths.**

- `src/lib/supabase/types.ts` lines the events_tests table type — 14 columns
- `supabase/migrations/20260316000004_fk_indexes_and_cleanup.sql` lines DROP TABLE IF EXISTS events_tests, in a never-applied file

**Evidence.** [`schema/drift.md#consequence-3`](./schema/drift.md#consequence-3)

**Reproduction.**

1. Read .planning/audit/schema/drift.json and filter for drift_class types-only: all 15 rows belong to events_tests.
2. Grep supabase/migrations for events_tests: the only match is the DROP in a never-applied file.

**Recommended fix.** Regenerate types.ts from the live schema; the entry disappears. Handle the never-applied cleanup migration as part of F-046.

**Validation criterion.** A regenerated types.ts contains no events_tests entry, asserted by a CI diff check.

**Related.** [F-046](#f-046)

---

### F-050 — Five source locations reference event_date and event_time columns that do not exist on the events table

**Severity:** Low · **Category:** dead-code · **Status:** Open

**Exposure rationale.** No production exposure — the authoritative columns are start_date and end_date, confirmed from information_schema.columns. The hazard is that two of the five are test fixtures that make their tests pass for the wrong reason: they supply event_date to routes that select start_date, leaving start_date undefined while the assertions look elsewhere. A third is invisible because *.test.ts is excluded from tsconfig.json. Two are comments, one of which additionally asserts that club_id and status are absent from events, which the column census disproves.

**Affected paths.**

- `src/hooks/useEvents.test.ts` lines 17-18
- `src/__tests__/api/clubs/analytics.test.ts` lines 166-168
- `src/__tests__/api/events/analytics.test.ts` lines 95,112,140
- `src/lib/tagMapping.ts` lines 98
- `supabase/functions/events-webhook/index.ts` lines 99

**Evidence.** [`schema/events-date-columns.md`](./schema/events-date-columns.md)

**Reproduction.**

1. Read .planning/audit/schema/events-date-columns.md for the verdict and the five locations with line numbers.
2. Read .planning/audit/schema/information-schema-columns.json and confirm events carries start_date and end_date and neither event_date nor event_time.

**Recommended fix.** Correct the three fixtures to supply start_date, which will surface whatever the assertions were actually not testing. Correct the two comments. Separately, stop excluding test files from tsconfig.json (F-066), which is what made the first fixture's excess-property error invisible.

**Validation criterion.** A grep asserting no occurrence of event_date or event_time outside a migration's historical DDL, and the three analytics tests still passing after the fixtures are corrected.

**Related.** [F-039](#f-039), [F-066](#f-066)

---

### F-056 — tailwindcss-animate in dependencies drags the Tailwind build toolchain into the production tree

**Severity:** Low · **Category:** dependency · **Status:** Open

**Exposure rationale.** Packaging hygiene with no exposure — a build-time package in the runtime dependency set inflates the installed tree and the advisory surface without adding a reachable code path. Same class as F-052 at much smaller scale.

**Affected paths.**

- `package.json` lines tailwindcss-animate under dependencies
- `.planning/audit/quality/dependency-report.md` lines § 7 candidate D-5

**Evidence.** [`quality/dependency-report.md#d-5`](./quality/dependency-report.md#d-5)

**Reproduction.**

1. Read .planning/audit/quality/npm-ls-prod.json and follow the tailwindcss-animate path into the production tree.

**Recommended fix.** Move tailwindcss-animate to devDependencies alongside tailwindcss itself.

**Validation criterion.** npm ls --omit=dev shows no tailwindcss packages in the production tree.

**Related.** [F-052](#f-052)

---

### F-057 — A Windows remote-code-execution critical is dispositioned 'not applicable' on an unverified assumption about the host OS

**Severity:** Low · **Category:** dependency · **Status:** Open

**Exposure rationale.** An evidence gap rather than a vulnerability. GHSA-p293-qw3h-jr36 was ruled out on the assumption that the production runtime is Linux — which is almost certainly correct and was not confirmed by any capture in this phase. Recorded so the assumption is visible and cheap to close, rather than silently inherited by the next reviewer.

**Affected paths.**

- `.planning/audit/quality/dependency-report.md` lines § 3, the GHSA-p293-qw3h-jr36 row

**Evidence.** [`quality/dependency-report.md#d-7`](./quality/dependency-report.md#d-7)

**Reproduction.**

1. Read .planning/audit/quality/dependency-report.md § 3 and find the GHSA-p293-qw3h-jr36 disposition, which names the assumption explicitly.

**Recommended fix.** Confirm the production runtime OS from the deployment platform and record it, then either close the advisory with evidence or reopen it at its published severity.

**Validation criterion.** The dependency report's GHSA-p293 row cites a captured runtime-OS fact rather than an assumption.

**Related.** [F-051](#f-051)

---

### F-060 — One hundred and sixty-two console calls across sixty files, with no logger declared anywhere

**Severity:** Low · **Category:** observability · **Status:** Open

**Exposure rationale.** Hygiene with an operational cost and no exposure — console output in a serverless runtime is unstructured, unsearchable and unattributable. It is the reason F-058's zero correlation callsites matter: there is nothing to correlate into.

**Affected paths.**

- `.planning/audit/quality/error-observability.md` lines console_call_count 162 across 60 files
- `package.json` lines dependencies — no logging library declared

**Evidence.** [`quality/error-observability.md`](./quality/error-observability.md)

**Reproduction.**

1. Read .planning/audit/quality/error-observability.md for the count and the derivation command, which uses command grep because the shell grep is a ugrep shim honouring .gitignore.

**Recommended fix.** Adopt a structured logger, wire it into the shared route wrapper from F-058 so every line carries the request id, and add a lint rule banning bare console calls in src/app/api/.

**Validation criterion.** A lint rule failing on console usage under src/app/api/, run green.

**Related.** [F-058](#f-058)

---

### F-063 — Seven documented facts about the codebase are contradicted by the working tree

**Severity:** Low · **Category:** dead-code · **Status:** Open · **Closes in phase:** 02

**Exposure rationale.** Documentation drift with one dangerous instance and six benign ones. The dangerous one is CLAUDE.md:50 documenting six protected routes where src/middleware.ts:114 has eight — the drift runs in the direction where an auditor trusting the document marks two genuinely protected routes as public, which is exactly the mistake this phase was built to avoid. The rest (92 vs 94 handlers, 45 vs 44 migrations, Next.js 14 vs 16, React Hooks vs Zustand, a Vitest suite that does not exist, a swagger-ui-react version that is wrong twice over) are onboarding noise. None is exploitable, hence Low.

**Affected paths.**

- `CLAUDE.md` lines 50
- `.planning/PROJECT.md` lines 41
- `.claude/CLAUDE.md` lines 34,43-44,79,109
- `README.md` lines 17,21

**Evidence.** [`quality/dead-code.md#4`](./quality/dead-code.md#4)

**Reproduction.**

1. Read .planning/audit/quality/dead-code.md § 4 — twelve rows, each with the stale claim, the verified reality, the command that proves it, and a disposition.
2. Read .planning/audit/baseline/versions.txt, which re-derives every count from the working tree and is the only count authority in this phase.

**Recommended fix.** Correct the four documents against baseline/versions.txt. Row 8 (45 vs 44 migrations) needs no in-repo fix — PROJECT.md:109 already says 44 and only the out-of-repo brief is stale, recorded here so the next reader does not 'fix' a correct number. Row 4's swagger-ui-react line should be deleted rather than corrected, because the package is being removed (F-053).

**Validation criterion.** A CI check comparing every count claim in CLAUDE.md, PROJECT.md and README.md against baseline/versions.txt, run green.

**Related.** [F-045](#f-045), [F-053](#f-053), [F-064](#f-064), [F-069](#f-069)

---

### F-064 — Four tracked files and one npm script are residue of tooling that is not installed

**Severity:** Low · **Category:** dead-code · **Status:** Open · **Closes in phase:** 02

**Exposure rationale.** Dead configuration with no exposure. vitest.config.ts and vitest.setup.ts are tracked and referenced by nothing; test-results/.last-run.json is a tracked Playwright marker asserting status 'failed' from a framework that is not installed; and package.json's check:feedback script points at scripts/check-feedback-loop.mjs, which does not exist, so the command fails immediately. Each teaches a future reader something false about the project.

**Affected paths.**

- `vitest.config.ts` lines whole file — tracked, referenced by nothing
- `vitest.setup.ts` lines whole file — tracked, referenced by nothing
- `test-results/.last-run.json` lines whole file — tracked Playwright marker, Playwright not installed
- `package.json` lines 9

**Evidence.** [`quality/dead-code.md#4`](./quality/dead-code.md#4)

**Reproduction.**

1. `git ls-files | grep -i vitest` returns both config files; `grep -n vitest tsconfig.json` shows vitest.config.ts is explicitly excluded.
2. `ls node_modules/@playwright` is absent and `grep -c playwright package.json` returns 0, while test-results/.last-run.json is tracked.
3. `test -f scripts/check-feedback-loop.mjs` fails; `npm run check:feedback` errors immediately.

**Recommended fix.** Delete both vitest files and test-results/.last-run.json, add test-results/ to .gitignore, and either delete the check:feedback script entry or restore the missing file if the feedback-loop check is still wanted.

**Validation criterion.** A check asserting every npm script's entry point exists on disk, and that no tracked file references a package absent from package.json.

**Related.** [F-063](#f-063), [F-065](#f-065)

---

### F-065 — CI runs lint, type-check and build but never runs the tests, and pins a Node version that cannot run the project's own tooling

**Severity:** Low · **Category:** config · **Status:** Open · **Closes in phase:** 02

**Exposure rationale.** Process gap rather than a code defect. Twenty-one Jest suites exist and CI executes none of them; package.json declares no test script at all, so npm test errors with Missing script. Separately, CI pins Node 20 while the local toolchain is 24.16.0, and Node 20 cannot run dependency-cruiser@18.3.0 (engines ^22||^24||>=26) — so a CI-hosted re-run of this audit's own tooling would fail. No exposure, but it is why every other finding here had to be found by hand.

**Affected paths.**

- `.github/workflows/ci.yml` lines the job steps — lint, tsc, build; no test step; Node pinned to 20
- `package.json` lines scripts — no test entry

**Evidence.** [`baseline/test-runner-decision.md`](./baseline/test-runner-decision.md)

**Reproduction.**

1. Read .github/workflows/ci.yml and confirm no step invokes jest.
2. `npm test` errors with 'Missing script: "test"'.
3. Read .planning/audit/baseline/versions.txt for node_version 24.16.0 and ci_node_major 20.

**Recommended fix.** Add a test script and a CI step invoking npx jest --ci, after deciding what the gate means given five suites are currently skipped (F-066). Resolve the Node split by bumping CI to 22 or 24; the documentation follows the decision rather than leading it.

**Validation criterion.** A CI run that executes the Jest suite and fails the build on a test failure, plus a successful CI-hosted run of the audit tooling.

**Related.** [F-066](#f-066), [F-064](#f-064)

---

### F-066 — Five of twenty-one Jest suites are skipped, for two different reasons needing two different fixes

**Severity:** Low · **Category:** config · **Status:** Open · **Closes in phase:** 02

**Exposure rationale.** Test-coverage gap with no exposure. Four suites are blocked by an uninstalled @testing-library/react and would revive on an install; the fifth, src/app/api/events/route.test.ts, is blocked by contract drift — the route it tests no longer implements cursor pagination, so no install will revive it. Conflating the two is why the skip count has stayed constant. Compounded by tsconfig.json excluding all 21 test files, which is what made F-050's excess-property error invisible.

**Affected paths.**

- `src/app/api/events/route.test.ts` lines whole file — skipped for contract drift, not for a missing package
- `tsconfig.json` lines exclude — all 21 test files are outside the type-check

**Evidence.** [`baseline/test-runner-decision.md`](./baseline/test-runner-decision.md)

**Reproduction.**

1. Read .planning/audit/baseline/jest.txt — Test Suites 5 skipped, 16 passed, 16 of 21 total; Tests 36 skipped, 220 passed.
2. Read .planning/audit/baseline/test-runner-decision.md for the per-suite skip table and the two categories.

**Recommended fix.** Install @testing-library/react to revive four suites; rewrite or delete the fifth against the route's current contract. Stop excluding test files from tsconfig.json so fixture type errors surface.

**Validation criterion.** npx jest --ci reports zero skipped suites, and npx tsc --noEmit type-checks the test files with zero diagnostics.

**Related.** [F-050](#f-050), [F-065](#f-065)

---

### F-067 — The specified fail-open detector finds one of the four fail-open shapes that exist

**Severity:** Low · **Category:** observability · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** A method finding, recorded because a detector that reports one hit reads as 'one problem' rather than 'one problem found'. The regex the phase's own pattern document specifies matches FO-01 and nothing else: it cannot find FO-02 (no &&, the check degrades rather than disappearing), FO-03 (env values bound to locals first, operator is || over negations) or FO-05. Separately, the uses_service_client signal misses a 26th service-role construction because that handler builds its client inline rather than through the factory.

**Affected paths.**

- `.planning/audit/authz/fail-open-register.md` lines 306-310
- `.planning/audit/authz/service-role-register.md` lines the coverage caveat naming the 26th construction site

**Evidence.** [`authz/fail-open-register.md`](./authz/fail-open-register.md)

**Reproduction.**

1. Run the specified detector regex over src/ and observe one match.
2. Read .planning/audit/authz/fail-open-register.md § 3 for the three shapes it structurally cannot reach.

**Recommended fix.** Replace regex detection with a semantic check: add `import "server-only"` to the service-client factory and a lint rule banning direct reads of SUPABASE_SERVICE_ROLE_KEY anywhere else, so every construction must go through the factory and is therefore countable. For fail-open shapes, lint on the pattern 'authorization decision reads process.env' rather than on a specific operator.

**Validation criterion.** A lint rule that fails on any direct SUPABASE_SERVICE_ROLE_KEY read outside src/lib/supabase/service.ts, run green after F-001's inline client is removed.

**Related.** [F-001](#f-001), [F-068](#f-068)

---

### F-068 — A redaction sweep that reports zero can be false-clean, and was treated as authoritative until one fired

**Severity:** Low · **Category:** observability · **Status:** Open

**Exposure rationale.** A method finding about the audit's own process, with no exposure. The bearer-token sweep returned 3 rather than 0 in one plan, and the correct handling — classify each hit mechanically without printing it, then re-sweep with a tightened residual pattern — was only established because it fired. Recorded so the classification step becomes the standard rather than an improvisation, and so the two known benign strings are documented as classified rather than quietly excluded.

**Affected paths.**

- `.planning/audit/redaction/01-10.md` lines § 6.1 — 1 x 'Bearer undefined', 2 x unexpanded template, 0 unclassified
- `.planning/audit/REDACTION.md` lines the self-reference caveat and the phase-gate sweep patterns

**Evidence.** [`redaction/01-10.md`](./redaction/01-10.md)

**Reproduction.**

1. Run the five phase-gate sweep patterns over .planning/audit/ and observe that pattern 4 matches files containing the literal 'Bearer undefined' and the unexpanded template string.
2. Apply the residual check — Bearer followed by sixteen or more token characters — and observe zero.

**Recommended fix.** Make classification a required step of the sweep rather than an exception: every non-zero count must be resolved into classified-benign or scrubbed, with the residual pattern re-run afterwards, and the counts recorded. A ledger that says 'clean' without that step is an unverified claim.

**Validation criterion.** The consolidated REDACTION.md records, for every pattern, either a zero count or a classification with a residual re-sweep at zero.

**Related.** [F-067](#f-067), [F-070](#f-070)

---

### F-069 — Page protection cannot be read from the middleware list alone — the single-ring model is wrong in both directions

**Severity:** Low · **Category:** config · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** A method finding with a demonstrated cost on both sides. Fourteen pages are protected by a layout ring the middleware list cannot see, so a middleware-only reading marks them unprotected; and one page has a guard mechanism present yet is genuinely unprotected (F-005), so a mechanism-present reading marks it protected. Both errors occurred in this audit before the two-ring model was adopted. No exposure of its own; it is the reason F-005 was nearly missed.

**Affected paths.**

- `.planning/audit/inventory/pages.json` lines layout_guard and effective_protection columns
- `.planning/audit/inventory/classification-rules.md` lines § 6 row D-13

**Evidence.** [`inventory/classification-rules.md#d-13`](./inventory/classification-rules.md#d-13)

**Reproduction.**

1. Read .planning/audit/inventory/pages.json — 9 pages are middleware_protected, 14 carry a layout guard, and effective_protection differs from both.
2. Compare the middleware PROTECTED_ROUTES list against the effective_protection column and count the disagreements in each direction.

**Recommended fix.** Treat effective protection as a derived verdict over three inputs (middleware entry, layout guard, page guard) and record the derivation, as inventory/pages.json now does. Add a test asserting every page classified auth or admin actually redirects an anonymous request, so the verdict is checked rather than reasoned.

**Validation criterion.** An automated sweep requesting every page route anonymously and asserting the observed behaviour matches the effective_protection column.

**Related.** [F-005](#f-005), [F-003](#f-003), [F-063](#f-063)

---

### F-070 — The client-bundle secret sweep is INCONCLUSIVE, not clean — the build that produced it ran without the real key

**Severity:** Low · **Category:** authz · **Status:** Open · **Closes in phase:** 05

**Exposure rationale.** An evidence gap recorded so a zero is not misread as a negative. All seven sweep patterns returned 0 over .next/static and public/, which proves the service-role key was absent from that build environment, not that a build holding it would not inline it. The artifact records ENVSTATE: INCONCLUSIVE-key-absent-from-build-env rather than a clean verdict, and every reachable_from_client_bundle answer in the service-role register repeats the caveat. Low because no leak is known; it is the confidence that is unearned, not the result.

**Affected paths.**

- `.planning/audit/security/client-bundle-sweep.md` lines the ENVSTATE line and the seven zero counts
- `.planning/audit/authz/service-role-register.md` lines the reachable_from_client_bundle answers, each carrying the caveat

**Evidence.** [`security/client-bundle-sweep.md`](./security/client-bundle-sweep.md)

**Reproduction.**

1. Read .planning/audit/security/client-bundle-sweep.md — ENVSTATE: INCONCLUSIVE-key-absent-from-build-env, with zero counts for all seven patterns.
2. Re-run the sweep against a build produced with the real key present to obtain a conclusive result.

**Recommended fix.** Re-run the build with the production environment populated and re-sweep, then record a conclusive verdict. Independently, add `import "server-only"` to the service-client factory (F-067) so the question becomes unanswerable-by-construction rather than answered-by-sweep.

**Validation criterion.** A sweep over .next/static and public/ from a build with the real key present, recording ENVSTATE conclusive and zero matches for all seven patterns.

**Related.** [F-067](#f-067), [F-068](#f-068)

---

## Tempting One-Liners

Every fix below looked trivial while the audit was running and was **deliberately not applied**. This list is the written record that the baseline was preserved on purpose, and it is the first Stage 3 slice. A read-only audit that quietly fixed things would have no way to prove what the codebase actually looked like when it started.

| Finding | The one-liner, and why it was not applied |
|---|---|
| [F-001](#f-001) | Change `if (expectedKey && ...)` to `if (!expectedKey) return 401`. One line, one file, closes a live Critical — and it is a source change, which this phase forbids absolutely. Applying it would also have destroyed the evidence that the gate was ever open. |
| [F-002](#f-002) | Replace the template literal with a presence check, copying the sibling handler four directories away. Two lines. Not applied: same source-change prohibition, and the handler may be deleted instead (see F-037), which is a product decision this phase cannot take. |
| [F-026](#f-026) | Narrow the `vercel.json` `/api/(.*)` cache rule. A config edit, not a source edit — still forbidden, and still wrong to do blind: 13 routes legitimately want the shared cache and the correct scope comes from `cache/cache-matrix.csv`, not from a hunch. |
| [F-054](#f-054) | Add `/docs` to `PROTECTED_ROUTES`. One array element. Not applied: the middleware ring is itself env-conditional (F-003), so the one-liner would have produced protection that evaporates when a variable is unset — a fix that reads as done and is not. |
| [F-063](#f-063) | Correct `CLAUDE.md:50` from six protected routes to eight, and `PROJECT.md:41` from 92 handlers to 94. Pure documentation, zero risk — and explicitly out of scope: this phase files the contradictions, the phase-completion step applies them. |
| [F-064](#f-064) | Delete `vitest.config.ts`, `vitest.setup.ts`, `test-results/.last-run.json`, and the broken `check:feedback` script entry. Four deletions, nothing references any of them. Not applied: deletions outside `.planning/` are exactly what the read-only gate exists to prove did not happen. |
| [F-051](#f-051) | Run `npm update next`. The fix is inside the declared `^16.0.3` range. Not applied: it rewrites `package-lock.json`, whose SHA-256 is one of the three checks in `tools/readonly-guard.sh`. |
| [F-052](#f-052) | Move `vercel` from `dependencies` to `devDependencies` — one line in `package.json`, retires 7 of 24 High/Critical advisory rows. Not applied: same lockfile and manifest prohibition. |
| [F-016](#f-016) | Apply the already-written migration that declares the invitee policies. The fix is in the repository, unapplied, and club-invitation acceptance is broken in production right now. Not applied: this phase issues no database write of any kind, and applying an unreplayable migration history (F-043) is not a one-liner. |

---

## Blocked Items — what a later credentialed pass must close

A gap and an omission are different things. Each row below is a deliberate gap with a named blocking input and the exact command that closes it.

| Item | Blocking input | Retry command |
|---|---|---|
| AUDIT-01 — staging schema snapshot | credential for the staging project not supplied | `supabase db dump --schema public,storage,extensions --project-ref <STAGING-REF> > .planning/audit/schema/staging.schema.sql` |
| AUDIT-01 — local schema snapshot | the migration history aborts the replay at the 12th of 44 files (F-043); Docker was available, the repository was not replayable | `supabase db reset   # blocked until F-043 is fixed, then: supabase db dump --local --schema public,storage > .planning/audit/schema/local.schema.sql` |
| AUDIT-08 — two-session cache probe | COOKIE_A / COOKIE_B never exported into the executing shell; no cookie value entered this machine | `export PROD_HOST=https://universeapp.ca COOKIE_A='<account A sb-*-auth-token cookies>' COOKIE_B='<account B>' CLUB_ID='<public club id>'; bash .planning/audit/tools/cache-probe.sh && node .planning/audit/tools/gen-cache-matrix.mjs && node .planning/audit/tools/validate.mjs --check cache` |
| AUDIT-16 — client bundle sweep | the build that produced `.next/static` ran without the real service-role key, so a zero count is INCONCLUSIVE rather than clean | `SUPABASE_SERVICE_ROLE_KEY=<real key> npm run build && <re-run the sweep recorded in security/client-bundle-sweep.md>` |
| AUDIT-11 — GoTrue auth hook configuration | dashboard state; the HTTP hook form is not readable through any read-only capture used in this phase | `supabase projects api-keys --project-ref <PROD-REF>   # then read Authentication → Hooks in the dashboard` |

---

## Coverage Statement

This gate is a coverage argument, not a list. The question a reviewer should be able to answer is not "how many findings" but "what was looked at, and what was deliberately left".

### Examined

- All **94** API route handlers, classified for authorization requirement, role, RLS reliance, service-role justification, personalization, cache policy, input validation, test presence and liveness (`inventory/endpoints.json`).
- All **43** pages, classified for middleware protection, layout guard, page guard and *effective* protection (`inventory/pages.json`).
- All **101** live row-level policies over **38** relations, against six flag classes, plus the full table × command × role grid (`rls/rls-review.md`, `rls/rls-heatmap.csv`).
- All **25** service-role construction sites against four justification questions; every `getSession()` callsite; every environment-conditional authorization shape (`authz/`).
- All **4** storage buckets and **15** object policies; all **6** classes of asynchronous entry point plus GitHub Actions (`storage/`, `async/`).
- **288** schema rows reconciled across production, migrations and `types.ts`; the migration replay attempted from zero (`schema/drift.md`, `schema/local-reset.txt`).
- **680** production dependencies audited with a reachability judgment on every High/Critical; the module graph cruised for API-documentation reachability (`quality/`).
- **15** routes probed live for shared-cache behaviour, three requests each, with a positive control that fired (`cache/`).
- The test, type-check, lint and build baseline captured verbatim with exit codes (`baseline/`).

### Deliberately not examined

- **Cross-session cache retrieval.** The mechanism is proven — personalized responses are stored and the cache key ignores the session — but no request carrying account B's cookies was observed receiving account A's entry. `COOKIE_A`/`COOKIE_B` were never supplied. Retry command in `cache/curl-summary.json`. This is why F-025 is `Critical` with an honest `latent-hazard` verdict rather than a stronger label.
- **Staging and local schema snapshots.** `schema/staging.schema.sql` and `schema/local.schema.sql` are BLOCKED stubs. The local replay aborts on the repository's own migration history (F-043); staging needs a credential not supplied. `validate.mjs --check schema-snapshots` is red for exactly this reason and was not weakened.
- **GoTrue auth hook configuration.** The `pg-functions://` form is ruled out by the function catalog; the HTTP form is dashboard state and is not capturable read-only.
- **The client bundle with a real service-role key in the build environment.** `security/client-bundle-sweep.md` records `ENVSTATE: INCONCLUSIVE-key-absent-from-build-env`. Its seven zero counts prove the key was absent from *that* build, not that a build holding it would not inline it.
- **The production host operating system**, which leaves one dependency advisory (`GHSA-p293-qw3h-jr36`, Windows RCE) dispositioned on an assumption rather than a fact — recorded as F-057 rather than silently closed.
- **Anything requiring a write.** No source file, config, dependency, migration, policy or database row was changed by any plan in this phase. That invariant, not the finding count, is the phase's exit criterion.

---

*Generated by `tools/gen-foundation-audit.mjs` from `findings.json`. Do not edit this file.*
*Phase: 01-read-only-foundation-audit · Plan: 01-13 · Requirement: AUDIT-20*
