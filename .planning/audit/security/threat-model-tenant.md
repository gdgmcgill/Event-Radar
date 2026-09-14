# Threat Model 2 — Authenticated Student → Another Tenant's Data

**Requirement:** AUDIT-17 · **Plan:** 01-13 · **Boundary:** a signed-in McGill student reaching another student's personal data, or a club's private state they do not belong to.

> **The boundary in one sentence.** The caller has a valid session and is therefore past authentication entirely; what stands between them and someone else's row is a per-row predicate, a per-object path prefix, or a hand-rolled membership check inside a handler.

This is a **coverage argument**, not a findings list. Depth lives in `findings.json`.

---

## Assets on the protected side

| Asset | Why it matters |
|---|---|
| Another user's `users` row (`email`, `interest_tags`, `visibility`) and their own `roles` array | Personal data, and the array that decides administrative capability |
| Another club's `club_members`, `club_invitations`, analytics, logo and banner objects | The club is the tenant; membership is the boundary |
| `rsvps`, `saved_events`, `notifications`, `recommendation_feedback` per account | Per-user state with no legitimate cross-account read |
| `event_popularity_scores`, `user_event_scores`, `user_interactions` | Shared ranking state any tenant can poison |
| Storage objects under another tenant's key prefix | Overwrite is tampering, not just disclosure |

## Entry points that cross this boundary — quantified

| Surface | Count | Source |
|---|---|---|
| Handlers classified `auth_requirement: authenticated` | 40 of 94 | `inventory/endpoints.json` |
| Handlers marked `personalized: true` | 27 of 94 | `inventory/endpoints.json` |
| Handlers relying on RLS as their only authorization ring | majority of club/user-scoped routes | `inventory/endpoints.json` (`rls_reliance`) |
| Service-role callsites (RLS-bypassing) | 25 — 10 justified, 14 `needs-decision`, 1 `unjustified` | `authz/service-role-register.md` |
| …plus one construction the detector could not see | 1 (`createAdminClient()` inline) | `authz/service-role-register.md` |
| Live policies with `USING (true)` / `WITH CHECK (true)` | 12 / 9 of 101 | `rls/rls-review.md` |
| Storage buckets, and object policies over them | 4 buckets, 15 policies | `storage/storage-review.md` |

---

## STRIDE threat table

| # | Threat (STRIDE) | Control that should stop it | Exists today? | Evidence | Findings |
|---|---|---|---|---|---|
| T-1 | **Elevation of privilege** — a student sets their own `users.roles` to `admin`, crossing every tenant boundary at once | A `WITH CHECK` on the self-update policy, a column-scoped `UPDATE` grant, or a trigger | **No.** `USING (auth.uid() = id)` with **no `WITH CHECK`**, a table-level `UPDATE` grant covering every column, no `CHECK` on `roles`, no trigger. It is a direct PostgREST write, so no handler-level control applies | `rls/rls-review.md:345`, `rls/rls-heatmap.csv` | F-006 |
| T-2 | **Tampering** — a student overwrites another club's logo or banner object | An ownership predicate in the storage object policy | **No.** `club-logos` INSERT/UPDATE test only `bucket_id` and `auth.role()`. Both upload routes *do* check `club_members` ownership — and are bypassed by addressing the Storage REST API directly with the caller's own token | `storage/storage-review.md:166` | F-030 |
| T-3 | **Tampering** — a student pre-empts a key under another user's prefix in `banners` | Path-prefix ownership on INSERT, matching the sibling UPDATE/DELETE policies | **Partially.** UPDATE and DELETE test the prefix; INSERT tests the bucket only | `storage/storage-review.md:169` | F-033 |
| T-4 | **Tampering** — a student rewrites or deletes any popularity score, controlling everyone's ranking | Role targeting via `TO`, and a caller-bound predicate | **No.** `cmd = ALL` with the role check inside the predicate; covers INSERT, UPDATE and DELETE for every authenticated caller | `rls/rls-review.md:333`, `rls/rls-heatmap.csv` | F-010 |
| T-5 | **Tampering** — a student inserts a self-approved event with a forged `created_by`, bypassing moderation | `WITH CHECK (auth.uid() = created_by AND status = 'pending')` | **No.** `WITH CHECK (true)` for `{authenticated}` | `rls/rls-review.md:166` | F-008 |
| T-6 | **Information disclosure** — a service-role handler takes a user-supplied identifier straight into a filter | An ownership check before the bypassing client is constructed | **Mixed.** 14 of 25 callsites are `needs-decision` pending the policy facts; 1 is `unjustified` and anonymous-reachable | `authz/service-role-register.md`, `authz/service-role-register.json` | F-005 |
| T-7 | **Information disclosure** — account A's personalized response served to account B from the shared cache | A session-varying cache key, or `private` on personalized responses | **No.** Every `vary` observed read `accept-encoding` and nothing else; 8 personalized routes cached with non-zero `age`. Mechanism proven; the cross-session retrieval step is unmeasured | `cache/cache-matrix.csv`, `cache/curl-summary.json` | F-025 |
| T-8 | **Information disclosure** — 37 auth-gated routes storable under the same blanket directive | Path-scoped cache headers rather than a blanket `/api/(.*)` rule | **No.** The header is attached by path, not by response — the anonymous 401s on `/api/notifications` carried it too | `cache/cache-matrix.csv` | F-026 |
| T-9 | **Repudiation** — membership checks written by hand, per handler, rather than centralised | One shared club-authorization helper, mirrored in RLS | **No.** Ownership logic is spread across handlers; the storage layer does not mirror it at all, which is exactly what T-2 exploits | `storage/storage-review.md`, `authz/service-role-register.md` | F-030, F-012 |
| T-10 | **Denial of service / correctness** — the row-level ring diverging from what the repository declares | Policies declared in migrations and applied | **No.** 41 live policies are declared by no migration; 24 migration-declared policies are absent from production | `rls/rls-review.md:475`, `rls/rls-review.md:498` | F-012, F-016, F-017 |

---

## What held

- **The heatmap is complete.** `rls/rls-heatmap.csv` covers all 38 `public` + `storage` relations × command × role, with `rls-heatmap-notes.csv` tracing every `allow` cell back to the policies that produced it. The grid transcribes directly into Stage 4 pgTAP assertions.
- **32 policies that look caller-independent are in fact shut**, because `auth.uid()` is `NULL` for `anon`; a further 7 are shut one level down inside the admin `EXISTS` subquery (`rls/rls-review.md:295`).
- **`avatars` confines writes to the caller's own prefix.** The ownership shape the audit wanted exists in one bucket, which is what makes its absence in `club-logos` a defect rather than a design (`storage/storage-review.md`).
- **Both club upload routes perform a genuine `club_members` owner check.** Ring 2 is correct; the finding is that Ring 3 does not mirror it.
- **Exactly one `getSession()` callsite exists repo-wide and it is non-gating** — the destructured binding is never referenced again, so a forged cookie changes nothing (`authz/getsession-register.md`).

## Coverage statement

**Examined:** all 101 live policies against six flag classes, the full table × command × role grid, all 25 service-role callsites against four justification questions, all 4 buckets and 15 object policies, the cross-club persona column of the endpoint expectation matrix, and 15 routes probed for shared-cache behaviour.

**Deliberately not examined:** the cross-session cache retrieval itself (blocked on two accounts' cookies); whether any GoTrue auth hook is configured in the dashboard (dashboard state, not capturable read-only); staging and local schema snapshots (`schema/` — blocked, see `BLOCKING-INPUTS.md`); and administrative capability, which is the subject of `threat-model-escalation.md`.

---

*Phase: 01-read-only-foundation-audit · Plan: 01-13*
