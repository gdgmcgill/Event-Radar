# Elevated Operations Register

**Phase:** 03 · **Plan:** 03-03 · **Requirement:** REFAC-05

Every operation that reaches for the service-role client gets a row here. The
service-role key bypasses every row-level security policy, so an elevated
operation is a standing exception to the database's own access control. An
exception that nobody wrote down is indistinguishable from an oversight.

## The register

| Operation | Calling module | Why RLS cannot express it | Phase added |
| --------- | -------------- | ------------------------- | ----------- |
| Upsert and read the signing-in user's own public.users row at sign-in | `src/app/auth/callback/route.ts` | The row may not exist yet, the upsert writes email (withheld from authenticated by the F-006 column grant) and INSERT on users is revoked from authenticated by DEC-47; the callback is the only writer | 05 |
| Owner edits club details or soft-deletes the club | `src/app/api/clubs/[id]/route.ts` | clubs has no owner UPDATE policy; an owner policy needs status immutability and is deferred to Phase 7's per-table RLS work (DEC-41); the handler's column whitelist keeps status, created_by and id unwritable | 05 |
| Owner changes a member's role or transfers ownership | `src/app/api/clubs/[id]/members/role/route.ts`, `src/app/api/clubs/[id]/transfer/route.ts` | club_members UPDATE is admin-only; an owner UPDATE policy is deferred with the clubs policy (DEC-41) | 05 |
| Record a club deletion or ownership transfer in admin_audit_log | `src/app/api/clubs/[id]/route.ts`, `src/app/api/clubs/[id]/transfer/route.ts` | after F-007 no client role may insert audit rows; the door is the only writer | 05 |
| Recompute event popularity scores (rpc update_event_popularity) | `src/app/api/admin/calculate-popularity/route.ts` | writes event_popularity_scores, which are service-role-only by design (F-010); invoked on behalf of an admin, not a row owner | 05 |
| Change another user's roles or name as an admin | `src/app/api/admin/users/[id]/route.ts` | users has no admin UPDATE policy and the F-006 column grant withholds roles from authenticated; the change is an audited admin action (F-004, F-091) | 05 |
| Insert admin_audit_log rows for every moderation action | `src/lib/audit.ts` (logAdminAction) | after F-007 no client role may insert; the door is the only writer, so the record cannot be forged by the actor it records | 05 |
| Notify another user (notifications insert) | `src/app/api/admin/clubs/[id]/route.ts`, `src/app/api/admin/events/[id]/edits/route.ts`, `src/app/api/admin/events/[id]/status/route.ts`, `src/app/api/admin/organizer-requests/[id]/route.ts`, `src/app/api/admin/users/[id]/ban/route.ts`, `src/app/api/clubs/[id]/appeal/route.ts`, `src/app/api/events/[id]/appeal/route.ts`, `src/app/api/events/create/route.ts` (club follower fanout), `src/app/api/events/[id]/invite/route.ts` (invitees), `src/app/api/users/[id]/follow/route.ts` (new follower / new friend) | notifications INSERT is granted to service_role only; a notification for another user cannot be a caller-scoped policy (the last three added by REVIEW-05 WR-10: on the cookie client they never delivered) | 05 |
| Set another user's roles on approval (club_organizer) | `src/app/api/admin/clubs/[id]/route.ts`, `src/app/api/admin/organizer-requests/[id]/route.ts` | users has no admin UPDATE policy and the F-006 grant withholds roles | 05 |
| Ban or unban a user (banned_at, ban_expires_at, ban_reason) | `src/app/api/admin/users/[id]/ban/route.ts` | users has no admin UPDATE policy; the ban columns are withheld from authenticated by the F-006 grant | 05 |
| Club appeal: reset a rejected club to pending | `src/app/api/clubs/[id]/appeal/route.ts` | clubs has no owner UPDATE policy (DEC-41) | 05 |
| Read another user's name for appeals and review listings (the admins to notify of an appeal; review authors' names) | `src/app/api/clubs/[id]/appeal/route.ts`, `src/app/api/events/[id]/appeal/route.ts`, `src/app/api/moderation/reviews/[targetType]/[targetId]/route.ts` | users has own-row and admin SELECT policies only; a cross-user name read would need a public-read policy that also exposes email and ban columns | 05 |
| Create a club with its owner membership and the creator's organizer role | `src/app/api/clubs/route.ts` (POST) | clubs INSERT is admin-only, club_members has no self-owner insert, and roles is withheld by the F-006 grant | 05 |
| Batch score computation (rpc compute_user_scores) | `src/app/api/recommendations/batch/route.ts` | a privileged batch write over every user (F-075 revokes its public EXECUTE in Phase 6) | 05 |
| Friend suggestions read other users' profiles and memberships | `src/app/api/users/me/suggestions/route.ts` | users has own-row and admin reads only, and club_members shows another user's membership only to that club's owner. Attendance-based suggestions were removed for F-011; no elevated RSVP reads remain. The caller's own rows and the world-readable follow tables are read on the cookie client | 05 |
| Public profile of another user | `src/app/users/[id]/page.tsx` | users has no public-read policy; adding one would expose email, roles and ban columns at row level; the select is narrowed and anonymous viewers of private profiles get 404 (DEC-48). The target's saved events, created events, friends and memberships are read through the same door, because each is readable under RLS only by the target | 05 |
| A/B experiment reads and the caller's own variant assignment | `src/app/api/recommendations/route.ts` | experiments and experiment_variants carry admin-only policies; assignment is a server decision keyed by the authenticated caller's id, never a request value (F-017) | 06 |
| Record recommendation analytics with server-owned experiment attribution | `src/app/api/recommendations/feedback/route.ts` | running experiment/variant reads are admin-only; client-role writes to recommendation_feedback are revoked so direct Data API requests cannot bypass the server attribution decision. The authenticated, onboarded caller supplies neither subject nor variant; explicit thumbs feedback stays on the cookie client | M0 / WR-07 |
| Record validated interactions and trigger popularity recomputation | `src/app/api/interactions/route.ts` | client interaction writes are revoked to prevent forged user_id; the cookie event lookup retains event RLS and the server binds identity to the session or null. Its service-role INSERT runs the existing invoker trigger to update server-only popularity scores | M0 / F-009, F-010 |
| Read aggregate recommendation feedback for administrators | `src/app/api/recommendations/analytics/route.ts`, `src/app/api/admin/experiments/[id]/results/route.ts` | recommendation_feedback has own-row SELECT only; these cross-user analytics reads follow active-user and admin guards and select only metrics fields. Other tables retain their cookie-client authorization | M0 / WR-07 follow-through |
| Count attendee saves and bucket attendee interactions for club analytics | `src/app/api/events/[id]/analytics/route.ts`, `src/app/api/clubs/[id]/analytics/route.ts` | saved_events and user_interactions expose only the caller's own rows. The existing cookie-client club membership guard precedes elevation; reads are restricted to the authorized event or the event IDs loaded from the authorized club. Selects contain only an exact save count, event_id, or created_at; responses contain aggregate counts and time buckets, never attendee identities | M0 / CERT-08 workflow 10 |
| Atomic ownership transfer and organizer-request review | `src/app/api/clubs/[id]/transfer/route.ts`, `src/app/api/admin/organizer-requests/[id]/route.ts` | service-only invoker RPCs commit memberships/roles, decision, notifications and audit together; existing cookie authorization precedes the RPC and database locks recheck owner/pending state, preventing concurrent partial transfers or duplicate reviews | M0 / DI-62 |
| Approve or reject the displayed pending-edit version atomically | `src/app/api/admin/events/[id]/edits/route.ts` | service-only invoker RPC locks the event, compares the exact reviewed JSON snapshot, applies only title/image_url and commits notification/audit together after active-admin authorization | M0 / DI-68 |
| Health diagnostics: cron job status and the newest scraper-sourced insert | `src/app/api/health/route.ts` | cron is not an API schema and service_role lacks USAGE on it, so a service-only SECURITY DEFINER function reads it (C4); pending instagram events are visible only to admins through RLS | 06 |

Rows added from Phase 5 (05-05 onward).

**Rows are now added per migration.** Plan 03-03 built the seam and applied it
to **zero** routes (REFAC-05, ROADMAP SC3), so the register was empty through
Phases 3 and 4, by design. From Phase 5 each legacy service-role callsite that
moves to `getElevatedClient()` adds its row above in the same commit, and the
callsites not yet migrated stay held by the generated allow-list in
`eslint.elevated-allowlist.mjs`, which may only shrink. Plan 05-05 migrated the
auth callback (both of its service-role uses), so the ratchet counts one legacy
entry fewer than the committed list; the list itself is regenerated once, in
05-15 (DEC-49). Plan 05-10 moved the club owner writes onto the door (F-087,
DEC-41), retiring `src/app/api/clubs/[id]/route.ts` (its dynamic import of the
service module) and `src/app/api/clubs/[id]/transfer/route.ts` from the live
census, so the ratchet counts three entries fewer than the committed list. Plan
05-14 moved `src/app/api/admin/calculate-popularity/route.ts` onto the door
(its inline service-key client is deleted, F-001), so the ratchet counts four
entries fewer; the same plan moved `src/lib/audit.ts` onto the door (F-073),
so it counts five fewer. Plan 05-15 split the eight admin write and read
routes between the caller's cookie client (every operation an admin policy
already permits) and the door (notifications, another user's roles, the ban
columns); `admin/organizers`, `admin/reports` and `admin/reports/[id]` need no
door at all. The same plan moved the non-admin sites: `profile/avatar`,
`profile/banner` and the `users/[id]` self-update run on the cookie client
only, and the appeals, club creation, review listing, batch scoring and friend
suggestions keep only the rows above on the door. The public profile page
reads through the door with a narrowed column list and one visibility gate
(F-005). The allow-list was then regenerated once (DEC-49) to exactly the two
cron routes Phase 6 owns.

### The audit writer

`src/lib/audit.ts` (`logAdminAction`), counted by both controls as a legacy
caller from plan 04-03 until plan 05-14, now writes through the door and has
its row above.

An empty register with a stated reason is a control. An absent register is an
omission. The distinction is the whole point of writing this file now rather
than when the first row arrives.

## Adding a row

1. Establish that the operation genuinely cannot be expressed as an RLS policy.
   "It was easier" is not a reason; "the operation must read rows belonging to a
   user other than the caller, on behalf of a cron job with no caller at all" is.
2. Call `getElevatedClient()` from `@/server/db/elevated`. Do not import the
   service-role factory from `src/lib/supabase/` directly — the boundary rule
   rejects that anywhere under `src/**` outside the two sanctioned homes, and
   this module exists so that there is
   exactly one place to audit.
3. Add the row, naming the calling module and the reason.
4. Delete the corresponding entry from `eslint.elevated-allowlist.mjs` when the
   migration retires a legacy callsite. The list may only shrink;
   `scripts/check-elevated-ratchet.mjs` enforces that.

| Validated self-profile onboarding and affiliation transition | `src/app/api/users/[id]/route.ts` | DI-72 revokes client UPDATE on onboarding_completed; P1-02 also keeps university/provenance writes server-owned; active-user and exact self-id checks plus the profile schema precede elevation. Payload is whitelisted and filtered to the authenticated subject. Ordinary profile writes remain on the cookie client. University IDs must name active catalog rows; provenance is assigned by the server, never accepted from metadata. | M0 |

| Display name in a newly established friendship notification | `src/app/api/users/[id]/follow/route.ts` | DI-65: after a successful new follow and reciprocal-follow check, read only the exact peer's name for the caller's notification. No profile details or arbitrary target enumeration. | M0 |

### M2 editorial discovery

| Caller | Operations | Guard / reason |
| --- | --- | --- |
| `src/server/opportunities/admin.ts` | Private opportunity + university joins; duplicate candidates | Called only after `adminContext` verifies active admin; public column grants deliberately exclude draft and review notes. |
| `src/app/api/admin/opportunities/route.ts` | Bounded private list; `curate_opportunity` create | Active admin; server-derived actor; named curator check controls Pick changes; transaction writes audit. |
| `src/app/api/admin/opportunities/[id]/route.ts` | `curate_opportunity` edit/publish/archive/merge | Active admin plus expected version; actor rechecked by RPC; only configured curator can change Picks. |
| `src/app/api/admin/events/[id]/discovery/route.ts` | Event editorial metadata and duplicate reads; `curate_event_discovery`, `merge_event_discovery` | Active admin; expected version; RPC rechecks actor and commits audit atomically. |

### M3 authored resources

| Caller | Operations | Guard / reason |
| --- | --- | --- |
| `src/server/resources/service.ts` | Public `open` target resolution: reads the private `file_path`/`file_name` of a published template and issues a short signed URL from the private `resource-files` bucket; records `resource_actions` | The published check runs first against the cookie client (RLS-scoped, public columns only); `file_path` is never publicly granted, so a signed download needs the door. A failed action-log insert is logged and never blocks the redirect. |
| `src/server/resources/admin.ts` | Private resource reads (draft/archived included); resource file upload to the private `resource-files` bucket | Called only after `adminContext` verifies active admin; public column grants exclude `file_path` and `status`. |
| `src/app/api/admin/resources/route.ts` | Bounded private list; `curate_resource` create | Active admin; server-derived actor; RPC writes the audit row in the same transaction. |
| `src/app/api/admin/resources/[id]/route.ts` | `curate_resource` edit/publish/archive | Active admin plus expected version; actor rechecked by the RPC. |
| `src/app/api/admin/resources/[id]/file/route.ts` | Storage upload, then `curate_resource` edit with the resulting `file_path`/`file_name`/`file_size` | Active admin; size/type/content-sniff checks precede the upload; expected version guards the follow-up edit. |

### M3 public intake and moderation queue

| Caller | Operations | Guard / reason |
| --- | --- | --- |
| `src/server/intake/service.ts` | `intake_submission`, `intake_listing_report` | Public intake: server-fixed pending status, salted client hash, DB quotas. Discovery gate, strict contract and honeypot run first; the RPCs have no status/editorial parameter; a user id is attached only for an active user; reports reach only publicly visible targets (P0002 otherwise). |
| `src/server/intake/admin.ts` | Private submission reads (including contact fields); listing-report reads with target titles | Called only after `adminContext` verifies active admin; browser roles have no table grant beyond the admin-only RLS read; the client hash and reporter id are never selected. |
| `src/app/api/admin/submissions/[id]/route.ts` | `review_submission` convert/reject/spam | Active admin plus expected version; actor rechecked by the RPC; convert creates only a draft (unchecked) and never copies contact data; a retried convert returns the same target; audit row in the same transaction. |
| `src/app/api/admin/listing-reports/[id]/route.ts` | `resolve_listing_report` resolve/dismiss | Active admin; actor rechecked by the RPC; only open reports change; audit row in the same transaction. |

### M3 ingestion observability and image persistence

| Caller | Operations | Guard / reason |
| --- | --- | --- |
| `src/server/ingestion/summary.ts` | Reads `ingestion_deliveries` (newest delivery, success, failure), the newest `instagram` event, pending and stale-pending counts, the stale pending list and recent deliveries | Called by `GET /api/health` only on its report arm (active admin or `HEALTH_TOKEN` bearer, which has no admin session, so RLS cannot answer it) and by `GET /api/admin/ingestion` after `adminContext`. Counts, timestamps, short codes and pending titles only; the delivery log holds no payload text. |
| `src/app/api/admin/ingestion/route.ts` | The three summary reads above | Active admin via `adminContext` before any read. |
| `src/server/ingestion/persistImages.ts` | Selects non-deleted `instagram` events in `pending`/`approved` with a CDN `image_url`; uploads to `event-images/ingest/<event id>.<ext>`; conditionally updates `events.image_url` (to the stored copy, or `NULL` on 403/404/410) | Admin-triggered only (`POST /api/admin/ingestion/images` after `adminContext`), host allow-listed (`*.cdninstagram.com`, `*.fbcdn.net`), private-address rejection on every redirect hop, bounded (≤10 per call, 5 MB, 10 s, 3 redirects), content-sniffed; writes only `event-images/ingest/*` and the `image_url` it fetched (compare-and-set). The service role is outside `events_guard_moderated_update`. |
| `src/app/api/admin/ingestion/images/route.ts` | `persistEventImages(limit)` | Active admin; strict `PersistImagesBody` (limit 1–10). |
