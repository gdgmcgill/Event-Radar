# AUDIT-07 — Service-Role Callsite Register

**25 callsites: 10 justified, 1 unjustified, 14 needs-decision.**

| | |
|---|---|
| Requirement | AUDIT-07 |
| Produced by | plan 01-07, Task 1 |
| Machine-readable source | `.planning/audit/authz/service-role-register.json` |
| Row set derived from | `.planning/audit/inventory/endpoints.json` → `signals.uses_service_client === true` (22 route handlers) plus 3 non-route callsites added explicitly |
| Reconciled against | `.planning/audit/baseline/versions.txt` → `service_client_file_count=25` |
| Read-only | this plan reads `src/` and writes only under `.planning/`; `git diff --exit-code -- src/` is clean |

**This file is generated from the JSON.** Do not hand-edit it — edit the JSON and re-render,
so the machine-readable register and the human view cannot drift. The two commands in §2
and §3 reproduce those sections byte-for-byte from the JSON.

---

## 1. How the row set was derived

The register is **not** a fresh grep. Re-grepping would produce a second, silently different
population from the one `endpoints.json` already carries, and the cross-reference check in
`validate.mjs --check service-role` exists precisely to stop that.

```bash
# the 22 route handlers — read from the inventory signal, not from source
node -e 'const r=JSON.parse(require("fs").readFileSync(".planning/audit/inventory/endpoints.json","utf8"));console.log(r.filter(x=>x.signals.uses_service_client===true).length)'
# -> 22

# the three non-route callsites, added explicitly
#   src/app/users/[id]/page.tsx   — the single page component
#   src/lib/audit.ts              — the admin audit-logging library module
#   src/lib/supabase/service.ts   — the factory itself

# reconciliation: 22 + 3 must equal service_client_file_count in the baseline
command grep -n '^service_client_file_count=' .planning/audit/baseline/versions.txt
# -> service_client_file_count=25     (agrees; a disagreement means a missed callsite)
```

The generator throws rather than writing a file if that reconciliation fails.

### Convention for the four answers

Each of the four AUDIT-07 questions is answered as a **sentence beginning `yes`, `no`,
`partly`, `unclear`, `n/a` or an explicit negative**, never as a bare boolean. A boolean
`true` for `rls_bypass_required` would record the claim without the reason, and the reason
is the whole point of the requirement. All four are non-null on all 25 rows, which is what
`validate.mjs --check service-role` asserts.

### Verdict rubric

| verdict | meaning |
|---|---|
| justified | the caller is authenticated **and** authorized to the exact scope *before* the client is constructed, the bypass is genuinely required, and no request input widens the scope past what that authorization granted |
| needs-decision | the bypass is plausibly required, but the callsite sits outside the documented admin/cron restriction, **or** the authorization decision is made after construction (or using data read through the bypass), **or** it is unclear the bypass is needed at all |
| unjustified | no authorization gate covers the construction, or the bypass demonstrably is not required |

`needs-decision` is not a softer `unjustified`. It marks rows where the missing input is a
**policy fact** (`rls/pg_policies.json`, plan 01-09) or a **product decision**, not more reading.

---

## 2. Register

```bash
node -e 'const r=JSON.parse(require("fs").readFileSync(".planning/audit/authz/service-role-register.json","utf8"));console.log("| file | route | construction lines | verdict |");console.log("|---|---|---|---|");for(const x of r)console.log("| "+x.file+" | "+(x.route??"—")+" | "+x.construction_lines.join(", ")+" | "+x.verdict+" |")'
```

| file | route | construction lines | verdict |
|---|---|---|---|
| src/app/api/admin/clubs/[id]/route.ts | /api/admin/clubs/[id] | 58 | justified |
| src/app/api/admin/events/[id]/edits/route.ts | /api/admin/events/[id]/edits | 35 | justified |
| src/app/api/admin/events/[id]/status/route.ts | /api/admin/events/[id]/status | 25 | justified |
| src/app/api/admin/organizer-requests/[id]/route.ts | /api/admin/organizer-requests/[id] | 27 | justified |
| src/app/api/admin/organizers/route.ts | /api/admin/organizers | 15 | justified |
| src/app/api/admin/reports/[id]/route.ts | /api/admin/reports/[id] | 24 | justified |
| src/app/api/admin/reports/route.ts | /api/admin/reports | 20 | justified |
| src/app/api/admin/users/[id]/ban/route.ts | /api/admin/users/[id]/ban | 53, 256 | justified |
| src/app/api/clubs/[id]/appeal/route.ts | /api/clubs/[id]/appeal | 34 | needs-decision |
| src/app/api/clubs/[id]/route.ts | /api/clubs/[id] | 203 | needs-decision |
| src/app/api/clubs/[id]/transfer/route.ts | /api/clubs/[id]/transfer | 48 | needs-decision |
| src/app/api/clubs/route.ts | /api/clubs | 91 | needs-decision |
| src/app/api/cron/send-feedback-requests/route.ts | /api/cron/send-feedback-requests | 16 | justified |
| src/app/api/cron/send-reminders/route.ts | /api/cron/send-reminders | 13 | needs-decision |
| src/app/api/events/[id]/appeal/route.ts | /api/events/[id]/appeal | 34 | needs-decision |
| src/app/api/moderation/reviews/[targetType]/[targetId]/route.ts | /api/moderation/reviews/[targetType]/[targetId] | 25 | needs-decision |
| src/app/api/profile/avatar/route.ts | /api/profile/avatar | 86 | needs-decision |
| src/app/api/profile/banner/route.ts | /api/profile/banner | 74 | needs-decision |
| src/app/api/recommendations/batch/route.ts | /api/recommendations/batch | 13 | justified |
| src/app/api/users/[id]/route.ts | /api/users/[id] | 184 | needs-decision |
| src/app/api/users/me/suggestions/route.ts | /api/users/me/suggestions | 24 | needs-decision |
| src/app/auth/callback/route.ts | /auth/callback | 122, 164 | needs-decision |
| src/app/users/[id]/page.tsx | — | 35, 63 | unjustified |
| src/lib/audit.ts | — | 30 | needs-decision |
| src/lib/supabase/service.ts | — | 9, 10, 11, 12, 13 | needs-decision |

---

## 3. Per-callsite justification

```bash
node -e 'const r=JSON.parse(require("fs").readFileSync(".planning/audit/authz/service-role-register.json","utf8"));for(const x of r){console.log("### "+x.file+(x.route?" — \u0060"+x.route+"\u0060":""));console.log();console.log("- **verdict:** "+x.verdict);console.log("- **constructed at:** line"+(x.construction_lines.length>1?"s":"")+" "+x.construction_lines.join(", "));for(const k of ["rls_bypass_required","caller_authenticated_first","user_input_used_as_filter","reachable_from_client_bundle"])console.log("- **"+k+":** "+x[k]);if(x.notes)console.log("- **notes:** "+x.notes);console.log();}'
```

### src/app/api/admin/clubs/[id]/route.ts — `/api/admin/clubs/[id]`

- **verdict:** justified
- **constructed at:** line 58
- **rls_bypass_required:** yes — an admin moderating an arbitrary club row needs writes that the clubs RLS policies scope to the owner, so the cookie client cannot perform them.
- **caller_authenticated_first:** yes — verifyAdmin() at line 12 with a 403 return at lines 13-15, before construction at line 58.
- **user_input_used_as_filter:** yes — the path parameter `id` reaches .eq("id", id) at lines 63 and 92; the caller is already proven admin, so the widened scope matches the granted authority.
- **reachable_from_client_bundle:** no — route handler, server-only module graph; AUDIT-16 sweep (security/client-bundle-sweep.md) found 0 hits in .next/static, but its ENVSTATE is INCONCLUSIVE-key-absent-from-build-env.
- **notes:** Canonical shape: verifyAdmin() → early 403 → construct → act. This is the pattern the other 24 rows are measured against.

### src/app/api/admin/events/[id]/edits/route.ts — `/api/admin/events/[id]/edits`

- **verdict:** justified
- **constructed at:** line 35
- **rls_bypass_required:** yes — approving or rejecting a pending edit writes the events row on behalf of a moderator who is not its owner, which RLS denies.
- **caller_authenticated_first:** yes — verifyAdmin() at line 12 with a 403 return at lines 13-15, before construction at line 35.
- **user_input_used_as_filter:** yes — the path parameter `id` reaches .eq("id", id) at lines 40, 68 and 111, within the admin scope already granted.
- **reachable_from_client_bundle:** no — route handler, server-only module graph; AUDIT-16 sweep (security/client-bundle-sweep.md) found 0 hits in .next/static, but its ENVSTATE is INCONCLUSIVE-key-absent-from-build-env.
- **notes:** This file is also one of the 22 handlers with no try/catch at all (AUDIT-14, quality/error-observability.md).

### src/app/api/admin/events/[id]/status/route.ts — `/api/admin/events/[id]/status`

- **verdict:** justified
- **constructed at:** line 25
- **rls_bypass_required:** yes — the moderation transition pending → approved/rejected writes an events row the moderator does not own.
- **caller_authenticated_first:** yes — verifyAdmin() at line 12 with a 403 return at lines 13-15, before construction at line 25.
- **user_input_used_as_filter:** yes — the path parameter `id` reaches .eq("id", id) at lines 31 and 93, within the admin scope already granted.
- **reachable_from_client_bundle:** no — route handler, server-only module graph; AUDIT-16 sweep (security/client-bundle-sweep.md) found 0 hits in .next/static, but its ENVSTATE is INCONCLUSIVE-key-absent-from-build-env.
- **notes:** Pairs with lib/audit.ts: the moderation action is recorded through logAdminAction rather than an inline insert.

### src/app/api/admin/organizer-requests/[id]/route.ts — `/api/admin/organizer-requests/[id]`

- **verdict:** justified
- **constructed at:** line 27
- **rls_bypass_required:** yes — granting an organizer request mutates another user's `roles` array and a club row, both denied to a non-owner under RLS.
- **caller_authenticated_first:** yes — verifyAdmin() at line 11 with a 403 return at lines 12-14, before construction at line 27.
- **user_input_used_as_filter:** yes — the path parameter `id` reaches .eq("id", id) at lines 32 and 56; the downstream user and club filters are read from the fetched row, not from the request.
- **reachable_from_client_bundle:** no — route handler, server-only module graph; AUDIT-16 sweep (security/client-bundle-sweep.md) found 0 hits in .next/static, but its ENVSTATE is INCONCLUSIVE-key-absent-from-build-env.
- **notes:** Role-granting callsite. Elevation happens here by design and is admin-gated; contrast with api.clubs and auth.callback, which elevate without an admin gate.

### src/app/api/admin/organizers/route.ts — `/api/admin/organizers`

- **verdict:** justified
- **constructed at:** line 15
- **rls_bypass_required:** yes — the listing joins club_members and users across every club, which no single caller can read under RLS.
- **caller_authenticated_first:** yes — verifyAdmin() at line 6 with a 403 return at lines 7-9, before construction at line 15.
- **user_input_used_as_filter:** yes — the `search` and `status` query parameters (lines 12-13) shape the listing query, within the admin scope already granted.
- **reachable_from_client_bundle:** no — route handler, server-only module graph; AUDIT-16 sweep (security/client-bundle-sweep.md) found 0 hits in .next/static, but its ENVSTATE is INCONCLUSIVE-key-absent-from-build-env.
- **notes:** One of the 22 handlers with no try/catch (AUDIT-14).

### src/app/api/admin/reports/[id]/route.ts — `/api/admin/reports/[id]`

- **verdict:** justified
- **constructed at:** line 24
- **rls_bypass_required:** yes — resolving a report writes a row the resolving admin did not create.
- **caller_authenticated_first:** yes — verifyAdmin() at line 11 with a 403 return at lines 12-14, before construction at line 24.
- **user_input_used_as_filter:** yes — the path parameter `id` reaches .eq("id", id) at lines 29 and 50, within the admin scope already granted.
- **reachable_from_client_bundle:** no — route handler, server-only module graph; AUDIT-16 sweep (security/client-bundle-sweep.md) found 0 hits in .next/static, but its ENVSTATE is INCONCLUSIVE-key-absent-from-build-env.

### src/app/api/admin/reports/route.ts — `/api/admin/reports`

- **verdict:** justified
- **constructed at:** line 20
- **rls_bypass_required:** yes — the moderation queue must read every report row regardless of reporter, which RLS scopes per user.
- **caller_authenticated_first:** yes — verifyAdmin() at line 7 with a 403 return at lines 8-11, before construction at line 20.
- **user_input_used_as_filter:** yes — the `status` and `event_id` query parameters (lines 13-14) reach .eq() at lines 34 and 38, within the admin scope already granted.
- **reachable_from_client_bundle:** no — route handler, server-only module graph; AUDIT-16 sweep (security/client-bundle-sweep.md) found 0 hits in .next/static, but its ENVSTATE is INCONCLUSIVE-key-absent-from-build-env.
- **notes:** One of the 22 handlers with no try/catch (AUDIT-14).

### src/app/api/admin/users/[id]/ban/route.ts — `/api/admin/users/[id]/ban`

- **verdict:** justified
- **constructed at:** lines 53, 256
- **rls_bypass_required:** yes — banning writes another user's row and cascades status changes to that user's events; both are denied to a non-owner under RLS.
- **caller_authenticated_first:** yes — verifyAdmin() at line 13 (POST) and line 249 (DELETE), each with a 403 return on the following lines, before the constructions at lines 53 and 256.
- **user_input_used_as_filter:** yes — the path parameter `id` reaches .eq("id", id) and .eq("created_by", id) at lines 64, 102, 116, 127, 140, 171, 262 and 283, within the admin scope already granted.
- **reachable_from_client_bundle:** no — route handler, server-only module graph; AUDIT-16 sweep (security/client-bundle-sweep.md) found 0 hits in .next/static, but its ENVSTATE is INCONCLUSIVE-key-absent-from-build-env.
- **notes:** Two constructions, one per exported handler; both are gated identically.

### src/app/api/clubs/[id]/appeal/route.ts — `/api/clubs/[id]/appeal`

- **verdict:** needs-decision
- **constructed at:** line 34
- **rls_bypass_required:** yes (probable) — a rejected or suspended club is expected to be invisible to its own owner under the clubs RLS policies, so the appellant cannot read it or reset its status through the cookie client. Confirm against rls/pg_policies.json when plan 01-09 lands.
- **caller_authenticated_first:** partly — checkBanStatus() at line 11 and getUser() at line 17 with a 401 at lines 19-21 run before construction at line 34, but the *authorization* decision (club.created_by !== user.id → 403) is at lines 46-48, after construction, and it compares against a row read through the bypass at lines 36-40.
- **user_input_used_as_filter:** yes — the path parameter `id` reaches .eq("id", id) at lines 39 and 79 before ownership is established; the read at line 39 returns any club row in the database.
- **reachable_from_client_bundle:** no — route handler, server-only module graph; AUDIT-16 sweep (security/client-bundle-sweep.md) found 0 hits in .next/static, but its ENVSTATE is INCONCLUSIVE-key-absent-from-build-env.
- **notes:** Outside the admin/cron restriction documented in CLAUDE.md and PROJECT.md. The ownership check is present and correct today, but it is downstream of an unrestricted read, so a future early-return regression leaks arbitrary club rows rather than failing closed. Also leaks internal error text at lines 69 and 84 (AUDIT-14).

### src/app/api/clubs/[id]/route.ts — `/api/clubs/[id]`

- **verdict:** needs-decision
- **constructed at:** line 203
- **rls_bypass_required:** yes — the write is an admin_audit_log insert, a table no end user may write under RLS.
- **caller_authenticated_first:** yes — getUser() at line 162 with a 401 at lines 163-165 and an owner check at lines 168-177 (403), all before construction at line 203.
- **user_input_used_as_filter:** no — the insert payload is built from `user.id` and the already-validated `clubId`; no request value selects a row.
- **reachable_from_client_bundle:** no — route handler, server-only module graph; AUDIT-16 sweep (security/client-bundle-sweep.md) found 0 hits in .next/static, but its ENVSTATE is INCONCLUSIVE-key-absent-from-build-env.
- **notes:** Two structural deviations rather than an authorization gap. (1) The factory is pulled in via a dynamic `await import("@/lib/supabase/service")` at line 202, so a static import-boundary lint rule would not see this callsite. (2) It hand-rolls an admin_audit_log insert instead of calling logAdminAction() from lib/audit.ts, and writes action "club_deleted", which is not a member of the AuditAction union in lib/audit.ts:3-18.

### src/app/api/clubs/[id]/transfer/route.ts — `/api/clubs/[id]/transfer`

- **verdict:** needs-decision
- **constructed at:** line 48
- **rls_bypass_required:** yes (probable) — transferring ownership rewrites two club_members rows including another user's, which the owner cannot do under a per-user RLS policy. Confirm against rls/pg_policies.json when plan 01-09 lands.
- **caller_authenticated_first:** yes — getUser() at line 12 with a 401 at lines 13-15, an owner check at lines 25-27 (403) and a target-membership check at lines 43-45 (400), all on the cookie client and all before construction at line 48.
- **user_input_used_as_filter:** yes — the body field `newOwnerId` (line 29) selects the target member, but it is validated against club_members on the *cookie* client at lines 37-41 before the bypass is constructed.
- **reachable_from_client_bundle:** no — route handler, server-only module graph; AUDIT-16 sweep (security/client-bundle-sweep.md) found 0 hits in .next/static, but its ENVSTATE is INCONCLUSIVE-key-absent-from-build-env.
- **notes:** Outside the documented admin/cron restriction, but the strongest non-admin shape in the register: every authorization fact is established on the RLS-respecting client first, and the bypass is used only for the write. Also one of the 22 handlers with no try/catch (AUDIT-14).

### src/app/api/clubs/route.ts — `/api/clubs`

- **verdict:** needs-decision
- **constructed at:** line 91
- **rls_bypass_required:** partly — the clubs insert and the club_members owner insert plausibly need it, but the third write is a `roles` array mutation on the caller's own users row (lines 145-150), which is a privilege grant rather than a data write.
- **caller_authenticated_first:** yes — checkBanStatus() at line 42 and getUser() at line 46 with a 401 at lines 47-50, before construction at line 91.
- **user_input_used_as_filter:** yes — the body field `name` reaches .ilike("name", name.trim()) at line 98 for the duplicate check; the role mutation filters on `user.id`, not on request input.
- **reachable_from_client_bundle:** no — route handler, server-only module graph; AUDIT-16 sweep (security/client-bundle-sweep.md) found 0 hits in .next/static, but its ENVSTATE is INCONCLUSIVE-key-absent-from-build-env.
- **notes:** SELF-ELEVATION PATH. Any authenticated, non-banned McGill account that POSTs a club receives the club_organizer role at lines 145-150, written through the RLS-bypassing client, with no moderation step — the club itself is created with status "pending" but the role is granted immediately. Whether that is intended is a product decision, which is why this is needs-decision and not a finding on its own; plan 01-13 should raise it against the persona matrix.

### src/app/api/cron/send-feedback-requests/route.ts — `/api/cron/send-feedback-requests`

- **verdict:** justified
- **constructed at:** line 16
- **rls_bypass_required:** yes — a machine caller has no user session at all, so every read and write in the handler depends on the bypass.
- **caller_authenticated_first:** yes, and fail-closed — line 8 returns 500 when CRON_SECRET is unset, then line 12 compares the Authorization header, both before construction at line 16.
- **user_input_used_as_filter:** no — the event window is computed from getESTNow(); nothing from the request body or query string reaches a filter.
- **reachable_from_client_bundle:** no — route handler, server-only module graph; AUDIT-16 sweep (security/client-bundle-sweep.md) found 0 hits in .next/static, but its ENVSTATE is INCONCLUSIVE-key-absent-from-build-env.
- **notes:** The reference fail-closed shape. authz/fail-open-register.md names this route as the recommended fix for its sibling, api.cron.send-reminders.

### src/app/api/cron/send-reminders/route.ts — `/api/cron/send-reminders`

- **verdict:** needs-decision
- **constructed at:** line 13
- **rls_bypass_required:** yes — a machine caller has no user session, so the reminder sweep depends on the bypass.
- **caller_authenticated_first:** degenerate — line 9 compares the Authorization header against `Bearer ${process.env.CRON_SECRET}`, with no preceding check that CRON_SECRET is set. When it is unset the comparison is against the fixed literal "Bearer undefined", so a caller who guesses that string passes and reaches the bypass constructed at line 13.
- **user_input_used_as_filter:** no — the reminder windows are computed from getESTNow(); nothing from the request reaches a filter.
- **reachable_from_client_bundle:** no — route handler, server-only module graph; AUDIT-16 sweep (security/client-bundle-sweep.md) found 0 hits in .next/static, but its ENVSTATE is INCONCLUSIVE-key-absent-from-build-env.
- **notes:** Cross-referenced to authz/fail-open-register.md finding FO-02 (guessable-open, High). The bypass itself is justified for a cron path; what is not settled is the gate in front of it. Fixing is out of scope for this phase.

### src/app/api/events/[id]/appeal/route.ts — `/api/events/[id]/appeal`

- **verdict:** needs-decision
- **constructed at:** line 34
- **rls_bypass_required:** yes (probable) — a rejected or suspended event is expected to be invisible to its own creator under the events RLS policies, so the appellant cannot read it or reset its status through the cookie client. Confirm against rls/pg_policies.json when plan 01-09 lands.
- **caller_authenticated_first:** partly — checkBanStatus() at line 11 and getUser() at line 17 with a 401 at lines 19-21 run before construction at line 34, but the *authorization* decision (event.created_by !== user.id → 403) is at lines 46-48, after construction, and it compares against a row read through the bypass at lines 36-40.
- **user_input_used_as_filter:** yes — the path parameter `id` reaches .eq("id", id) at lines 39, 79 and 116 before ownership is established; the read at line 39 returns any event row in the database.
- **reachable_from_client_bundle:** no — route handler, server-only module graph; AUDIT-16 sweep (security/client-bundle-sweep.md) found 0 hits in .next/static, but its ENVSTATE is INCONCLUSIVE-key-absent-from-build-env.
- **notes:** Structurally identical to api.clubs.id.appeal, including the internal-error-text leak at lines 69 and 84 (AUDIT-14). The two should be dispositioned together.

### src/app/api/moderation/reviews/[targetType]/[targetId]/route.ts — `/api/moderation/reviews/[targetType]/[targetId]`

- **verdict:** needs-decision
- **constructed at:** line 25
- **rls_bypass_required:** yes (probable) — moderation_reviews is a moderator-facing table and an appellant must still read their own thread; both sides are denied by a single per-user policy. Confirm against rls/pg_policies.json when plan 01-09 lands.
- **caller_authenticated_first:** no for authorization — getUser() at line 13 with a 401 at lines 15-17 establishes identity before construction at line 25, but the admin determination itself is read *through* the bypassing client at lines 27-33, and the owner fallback at lines 37-45 also reads through it.
- **user_input_used_as_filter:** yes — the path parameters `targetType` and `targetId` reach .eq() at lines 40, 51 and 52; `targetType` is allow-listed to event|club at lines 21-23, `targetId` is not constrained before the read at line 40.
- **reachable_from_client_bundle:** no — route handler, server-only module graph; AUDIT-16 sweep (security/client-bundle-sweep.md) found 0 hits in .next/static, but its ENVSTATE is INCONCLUSIVE-key-absent-from-build-env.
- **notes:** The authorization input (the caller's `roles` array) is obtained through the client whose use that input is supposed to authorize. Functionally equivalent to verifyAdmin() today, but it bypasses the one shared helper (lib/admin.ts) the rest of the admin surface uses, so a future RLS change to `users` cannot restrict it. Also one of the 22 handlers with no try/catch and it returns error.message to the caller at line 56 (AUDIT-14).

### src/app/api/profile/avatar/route.ts — `/api/profile/avatar`

- **verdict:** needs-decision
- **constructed at:** line 86
- **rls_bypass_required:** unclear — the write is a self-scoped users update filtered by user.id (line 90). The inline comment at lines 84-85 justifies it as "the server client's DB update can fail silently with cookie-based auth", which describes a symptom, not a required bypass. If a self-update RLS policy exists, the cookie client suffices and this is an unnecessary bypass.
- **caller_authenticated_first:** yes — getUser() at line 21 with a 401 at lines 23-28, before construction at line 86.
- **user_input_used_as_filter:** no — the filter is `user.id` from the verified session; the uploaded file name and URL are payload, not filter.
- **reachable_from_client_bundle:** no — route handler, server-only module graph; AUDIT-16 sweep (security/client-bundle-sweep.md) found 0 hits in .next/static, but its ENVSTATE is INCONCLUSIVE-key-absent-from-build-env.
- **notes:** The comment records a silent-failure workaround. The silent failure is itself worth diagnosing — an RLS-denied update returns success with zero rows, which is exactly what the comment describes. Resolve with rls/pg_policies.json from plan 01-09 before deciding.

### src/app/api/profile/banner/route.ts — `/api/profile/banner`

- **verdict:** needs-decision
- **constructed at:** line 74
- **rls_bypass_required:** unclear — self-scoped users update filtered by user.id (line 78); same shape as api.profile.avatar and probably resolvable by the same self-update RLS policy.
- **caller_authenticated_first:** yes — getUser() at line 21 with a 401 at lines 23-25, before construction at line 74.
- **user_input_used_as_filter:** no — the filter is `user.id` from the verified session.
- **reachable_from_client_bundle:** no — route handler, server-only module graph; AUDIT-16 sweep (security/client-bundle-sweep.md) found 0 hits in .next/static, but its ENVSTATE is INCONCLUSIVE-key-absent-from-build-env.
- **notes:** Copy of api.profile.avatar without the explanatory comment. Disposition the two together.

### src/app/api/recommendations/batch/route.ts — `/api/recommendations/batch`

- **verdict:** justified
- **constructed at:** line 13
- **rls_bypass_required:** yes — batch scoring writes precomputed scores for every user, which no per-user policy can permit.
- **caller_authenticated_first:** yes — verifyAdmin() at line 8 with a 403 at lines 9-11, before construction at line 13.
- **user_input_used_as_filter:** no — POST takes no arguments (line 5); the handler operates over the whole user set.
- **reachable_from_client_bundle:** no — route handler, server-only module graph; AUDIT-16 sweep (security/client-bundle-sweep.md) found 0 hits in .next/static, but its ENVSTATE is INCONCLUSIVE-key-absent-from-build-env.
- **notes:** Admin-gated but outside the /api/admin path prefix, so a path-based import boundary would miss it. Returns error.message to the caller at line 20 (AUDIT-14).

### src/app/api/users/[id]/route.ts — `/api/users/[id]`

- **verdict:** needs-decision
- **constructed at:** line 184
- **rls_bypass_required:** unclear — the update is self-scoped (.eq("id", id) at line 188, where id is already proven equal to user.id). Same open question as the two profile upload routes.
- **caller_authenticated_first:** yes — getUser() at line 18 with a 401 at lines 20-25 and a self-ownership check at lines 30-35 returning 403 when user.id !== id, both before construction at line 184.
- **user_input_used_as_filter:** yes — the path parameter `id` reaches .eq("id", id) at line 188, but line 30 has already proven id === user.id, so the filter cannot widen beyond the caller.
- **reachable_from_client_bundle:** no — route handler, server-only module graph; AUDIT-16 sweep (security/client-bundle-sweep.md) found 0 hits in .next/static, but its ENVSTATE is INCONCLUSIVE-key-absent-from-build-env.
- **notes:** Authorization is airtight; the open question is only whether the bypass is needed at all. Note the payload includes `onboarding_completed` and `visibility`, so if the self-ownership check at line 30 ever regresses, the bypass turns a 403 into an arbitrary profile rewrite.

### src/app/api/users/me/suggestions/route.ts — `/api/users/me/suggestions`

- **verdict:** needs-decision
- **constructed at:** line 24
- **rls_bypass_required:** yes — friend suggestion scans read other users' rows and the follow graph, which per-user RLS policies are designed to withhold.
- **caller_authenticated_first:** yes — getUser() at line 18 with a 401 at lines 19-21, before construction at line 24.
- **user_input_used_as_filter:** no — GET takes no arguments (line 12); every filter derives from `user.id` or from the fetched profile.
- **reachable_from_client_bundle:** no — route handler, server-only module graph; AUDIT-16 sweep (security/client-bundle-sweep.md) found 0 hits in .next/static, but its ENVSTATE is INCONCLUSIVE-key-absent-from-build-env.
- **notes:** Outside the documented admin/cron restriction, and the widest-reading non-admin bypass in the register. It does filter candidates on .eq("visibility", "public") at lines 168, 197 and 227, so the privacy intent is expressed in application code rather than in a policy — exactly the class of control that RLS exists to hold. Worth a dedicated review against rls/pg_policies.json in plan 01-09.

### src/app/auth/callback/route.ts — `/auth/callback`

- **verdict:** needs-decision
- **constructed at:** lines 122, 164
- **rls_bypass_required:** yes — the profile upsert runs in the seam where the auth.users row exists but no public.users row does, and the comment at lines 146-147 records that the anon client's upsert fails silently under RLS. The auth admin deleteUser() call at line 126 additionally requires the service role by definition.
- **caller_authenticated_first:** yes — exchangeCodeForSession() and getUser() at line 101 with a redirect at lines 103-108 precede both constructions at lines 122 and 164; the McGill-domain check at line 113 precedes the second one.
- **user_input_used_as_filter:** no — every filter uses `user.id` from the verified session; the `code` and `next` query parameters never reach a filter.
- **reachable_from_client_bundle:** no — route handler, server-only module graph; AUDIT-16 sweep (security/client-bundle-sweep.md) found 0 hits in .next/static, but its ENVSTATE is INCONCLUSIVE-key-absent-from-build-env.
- **notes:** The single anonymous-reachable route in the register, and it grants the admin role. Three things to disposition: (1) a SECOND service-role construction at lines 122-125 that does NOT go through createServiceClient(), so signals.uses_service_client would have missed this file had it not also used the factory at line 164 — see the coverage caveat in the .md; (2) admin auto-promotion at lines 187-193 driven by the ADMIN_EMAILS env var, registered as FO-03 in authz/fail-open-register.md (it fails closed, but it is env-conditional role assignment on a bypassing client); (3) the whole profile-sync block is wrapped in `if (process.env.SUPABASE_SERVICE_ROLE_KEY)` at line 162 and a try/catch at lines 163-196 that only console.errors, so a failed upsert leaves a signed-in user with no profile row.

### src/app/users/[id]/page.tsx

- **verdict:** unjustified
- **constructed at:** lines 35, 63
- **rls_bypass_required:** partly — the page body (line 63) reads a public profile the viewer may not be able to see under the users RLS policy, which is a defensible reason. generateMetadata (line 35) reads only `name` for a <title>, which does not require a bypass at all.
- **caller_authenticated_first:** NO for generateMetadata — the construction at line 35 runs inside generateMetadata({ params }), which executes before and independently of the page body and performs no getUser() and no session read whatsoever. For the page body the answer is yes: getUser() at line 56 precedes the construction at line 63 — but that call only redirects self-views to /profile at lines 58-60; it never returns 401, so an anonymous request still reaches line 63.
- **user_input_used_as_filter:** yes — the path parameter `id` is passed straight to .eq("id", id) at line 39 and .eq("id", targetId) at line 67. The select at line 66 includes `email`, `visibility` and `interest_tags`, and the `visibility` value is read but not used to gate the service-role read itself.
- **reachable_from_client_bundle:** not proven safe — this is a page component, which compiles toward the client boundary, and the factory it imports carries no "server-only" marker (see lib.supabase.service below). The AUDIT-16 sweep (security/client-bundle-sweep.md) found 0 hits in .next/static, but its ENVSTATE is INCONCLUSIVE-key-absent-from-build-env; the sweep therefore proves the key was absent from that build, not that it would not be inlined by a build that had it. Treat as UNRESOLVED.
- **notes:** HIGHEST-RISK ROW IN THE REGISTER, and the only unjustified one. Two independent problems. (1) generateMetadata at lines 33-48 constructs the RLS-bypassing client with no authentication of any kind and filters it on an attacker-supplied path parameter — that is the exact caller-not-authenticated-before-construction combination this register exists to surface, and it is an elevation-of-privilege finding candidate for plan 01-13. (2) A page component is the one place in the codebase where the "server-only" assumption is not enforced by the framework's route boundary, and AUDIT-16 cannot currently discharge it. pages.json records effective_protection "auth" via page_guard "getUser" for this route, which overstates the guard: the getUser() at line 56 has no unauthenticated branch.

### src/lib/audit.ts

- **verdict:** needs-decision
- **constructed at:** line 30
- **rls_bypass_required:** yes — admin_audit_log is append-only infrastructure that no end-user role may write; a bypass is the intended mechanism.
- **caller_authenticated_first:** NOT DETERMINABLE AT THIS CALLSITE — logAdminAction() takes adminUserId as a plain parameter (line 23) and performs no verification of it. Every caller happens to call verifyAdmin() first today, but the module enforces nothing: a caller that passed an attacker-supplied id would write a forged audit row with no error.
- **user_input_used_as_filter:** no — the call is an insert (line 31); there is no filter. The inserted values are entirely caller-supplied, which is the concern here rather than filtering.
- **reachable_from_client_bundle:** no in practice — imported only by route handlers; the module carries no "server-only" marker of its own, so the guarantee rests on the import graph rather than on a mechanism. AUDIT-16 sweep (security/client-bundle-sweep.md) found 0 hits in .next/static, but its ENVSTATE is INCONCLUSIVE-key-absent-from-build-env.
- **notes:** The audit log is the control that makes every other admin action reviewable, and its integrity currently depends on caller discipline rather than on a check. Also note the `(supabase as any)` cast at line 31, which suppresses the type error that would otherwise reveal admin_audit_log drift against lib/supabase/types.ts.

### src/lib/supabase/service.ts

- **verdict:** needs-decision
- **constructed at:** lines 9, 10, 11, 12, 13
- **rls_bypass_required:** n/a — this is the factory itself (lines 9-13); it is where SUPABASE_SERVICE_ROLE_KEY is read and the bypassing client is built. It is in the register because a reviewer asking "where is the RLS-bypassing client constructed" must be shown the construction, not only its callers.
- **caller_authenticated_first:** n/a — a factory cannot authenticate; the obligation is discharged (or not) by each of the 24 callsites above.
- **user_input_used_as_filter:** no — the function takes no arguments (line 9); both values come from process.env at lines 11-12.
- **reachable_from_client_bundle:** NOT MECHANICALLY PREVENTED — the module has no import "server-only" statement, no "use server" directive and no ESLint import-boundary rule; nothing stops a client component from importing it, and the failure mode would be silent at author time. Both env reads use non-null assertions (lines 11-12), so a missing key produces a client that fails at request time rather than at construction. AUDIT-16 sweep (security/client-bundle-sweep.md) found 0 hits in .next/static, but its ENVSTATE is INCONCLUSIVE-key-absent-from-build-env.
- **notes:** The single highest-leverage remediation surface in this register: adding import "server-only" here converts the page-component risk above from an audit judgment into a build error. Recording it as needs-decision rather than justified because "no guard is possible at a factory" is a statement about this implementation, not about factories.

---

## 4. Coverage caveat — one service-role construction this register does not contain

The row set is derived from `signals.uses_service_client`, which detects the shared factory
`createServiceClient()`. **A handler that builds a service-role client inline is invisible to
that signal**, and one does:

```bash
command grep -rn 'SUPABASE_SERVICE_ROLE_KEY' src/
```

| file | line | in the register? | why |
|---|---|---|---|
| `src/lib/supabase/service.ts` | 12 | yes | the factory |
| `src/app/auth/callback/route.ts` | 124 | yes, but for a different reason | inline `createClient(url, SERVICE_ROLE_KEY)` at lines 122-125 for `auth.admin.deleteUser()`; the file is in the register only because it *also* uses the factory at line 164 |
| `src/app/auth/callback/route.ts` | 162 | yes | the `if (process.env.SUPABASE_SERVICE_ROLE_KEY)` feature gate around the profile-sync block |
| `src/app/api/admin/calculate-popularity/route.ts` | 17 | **NO** | local `createAdminClient()` at lines 15-29 builds the RLS-bypassing client without the factory, so `signals.uses_service_client` is `false` for this route |

`/api/admin/calculate-popularity` is therefore a **26th service-role construction site**. It is
excluded from the JSON deliberately: the register's contract, asserted by
`validate.mjs --check service-role`, is *rows == inventory signal + 3*, and quietly adding a
row the signal does not produce would break the cross-reference the check exists to enforce.
It is recorded here instead, and registered in full — with both handlers, line ranges and a
Critical severity proposal — in `.planning/audit/authz/fail-open-register.md` (FO-01), because
its authorization gate is the one that dissolves when `ADMIN_API_KEY` is unset.

**This is itself a finding for plan 01-13:** the detection signal is factory-shaped, so any
future inline construction is invisible to AUDIT-07 by construction. The recommended fix is the
same one that closes the page-component risk — make the factory the only way to obtain the key
(`import "server-only"` plus a lint rule banning direct `SUPABASE_SERVICE_ROLE_KEY` reads
outside `src/lib/supabase/service.ts`).

---

## 5. Finding candidates for plan 01-13

Every non-`justified` row, with the file and the line numbers a finding needs:

| file | construction lines | verdict | one-line reason |
|---|---|---|---|
| `src/app/api/clubs/[id]/appeal/route.ts` | 34 | needs-decision | Outside the admin/cron restriction documented in CLAUDE. |
| `src/app/api/clubs/[id]/route.ts` | 203 | needs-decision | Two structural deviations rather than an authorization gap. |
| `src/app/api/clubs/[id]/transfer/route.ts` | 48 | needs-decision | Outside the documented admin/cron restriction, but the strongest non-admin shape in the register: every authorization fact is established on the RLS-respecting client first, and the bypass is used only for the write. |
| `src/app/api/clubs/route.ts` | 91 | needs-decision | SELF-ELEVATION PATH. |
| `src/app/api/cron/send-reminders/route.ts` | 13 | needs-decision | Cross-referenced to authz/fail-open-register. |
| `src/app/api/events/[id]/appeal/route.ts` | 34 | needs-decision | Structurally identical to api. |
| `src/app/api/moderation/reviews/[targetType]/[targetId]/route.ts` | 25 | needs-decision | The authorization input (the caller's `roles` array) is obtained through the client whose use that input is supposed to authorize. |
| `src/app/api/profile/avatar/route.ts` | 86 | needs-decision | The comment records a silent-failure workaround. |
| `src/app/api/profile/banner/route.ts` | 74 | needs-decision | Copy of api. |
| `src/app/api/users/[id]/route.ts` | 184 | needs-decision | Authorization is airtight; the open question is only whether the bypass is needed at all. |
| `src/app/api/users/me/suggestions/route.ts` | 24 | needs-decision | Outside the documented admin/cron restriction, and the widest-reading non-admin bypass in the register. |
| `src/app/auth/callback/route.ts` | 122, 164 | needs-decision | The single anonymous-reachable route in the register, and it grants the admin role. |
| `src/app/users/[id]/page.tsx` | 35, 63 | unjustified | HIGHEST-RISK ROW IN THE REGISTER, and the only unjustified one. |
| `src/lib/audit.ts` | 30 | needs-decision | The audit log is the control that makes every other admin action reviewable, and its integrity currently depends on caller discipline rather than on a check. |
| `src/lib/supabase/service.ts` | 9, 10, 11, 12, 13 | needs-decision | The single highest-leverage remediation surface in this register: adding import "server-only" here converts the page-component risk above from an audit judgment into a build error. |

### The three classes plan 01-07 was asked to watch for

**1. The page component.** `src/app/users/[id]/page.tsx` is the only `unjustified` row.
`generateMetadata()` constructs the bypassing client at line 35 with **no authentication of any
kind** and filters it on an attacker-supplied path parameter at line 39. The page body's
`getUser()` at line 56 does not help: its only branch redirects a self-view to `/profile`
(lines 58-60), so an anonymous request still reaches the second construction at line 63.
`pages.json` records `effective_protection: "auth"` with `page_guard: "getUser"` for
`/users/[id]`, which overstates the guard — that column should be revisited by plan 01-11.
Client-bundle reachability is **unresolved, not clean**: `security/client-bundle-sweep.md`
carries `ENVSTATE: INCONCLUSIVE-key-absent-from-build-env`, so its zero hits prove the key was
absent from that build, not that it would not be inlined by a build that had it.

**2. Caller not authenticated before construction.** One callsite:
`src/app/users/[id]/page.tsx:35` (`generateMetadata`). Three further callsites authenticate
first but **decide authorization afterwards, using rows read through the bypass** —
`/api/clubs/[id]/appeal`, `/api/events/[id]/appeal` and
`/api/moderation/reviews/[targetType]/[targetId]`. The checks are correct today; the shape is
what is registered, because an early-return regression in any of them degrades to arbitrary
row disclosure rather than to a 403. `src/lib/audit.ts` is a fourth, distinct case: it cannot
authenticate at all, because it accepts `adminUserId` as a parameter.

**3. Outside the documented admin/cron paths.** `CLAUDE.md` § Architecture and the factory's
own doc comment (`src/lib/supabase/service.ts:4-8`) restrict this client to "admin routes, cron
jobs". Eleven route callsites are outside that rule:
`/api/clubs`, `/api/clubs/[id]`, `/api/clubs/[id]/appeal`, `/api/clubs/[id]/transfer`,
`/api/events/[id]/appeal`, `/api/moderation/reviews/[targetType]/[targetId]`,
`/api/profile/avatar`, `/api/profile/banner`, `/api/recommendations/batch`,
`/api/users/[id]`, `/api/users/me/suggestions` — plus `/auth/callback` and the page component.
`/api/recommendations/batch` is the benign case (admin-gated, merely outside the path prefix)
and is the reason the rule should be restated in terms of *the gate*, not *the path*. The
documented rule and the code have diverged far enough that one of them is wrong; recording
which is a plan 01-13 decision.

---

## 6. What this register still needs

| open question | rows affected | resolved by |
|---|---|---|
| Does a self-update policy on `users` exist? If so, three bypasses are unnecessary | `/api/profile/avatar`, `/api/profile/banner`, `/api/users/[id]` | `rls/pg_policies.json` — plan 01-09 |
| Are rejected/suspended `clubs`/`events` rows invisible to their own owner? If not, both appeal bypasses are unnecessary | `/api/clubs/[id]/appeal`, `/api/events/[id]/appeal` | `rls/pg_policies.json` — plan 01-09 |
| Is the `users` table readable enough that the suggestions scan does not need a bypass? | `/api/users/me/suggestions` | `rls/pg_policies.json` — plan 01-09 |
| Would the service-role key be inlined by a build that actually had it in its environment? | `src/app/users/[id]/page.tsx`, `src/lib/supabase/service.ts` | a re-run of the AUDIT-16 sweep with `ENVSTATE: real-secrets-present` |
| Is immediate `club_organizer` self-grant on club creation intended? | `/api/clubs` | product decision — plan 01-13 persona matrix |

---

*Requirement AUDIT-07 · phase 01-read-only-foundation-audit · plan 01-07 · generated 2026-09-14*
