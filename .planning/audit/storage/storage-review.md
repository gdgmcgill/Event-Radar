# AUDIT-18 — Storage bucket and object-policy review

**Requirement:** AUDIT-18 &nbsp;·&nbsp; **Plan:** 01-10 &nbsp;·&nbsp; **Phase:** 01-read-only-foundation-audit
**Evidence:** [`buckets.json`](./buckets.json) (4 rows) and [`storage-policies.json`](./storage-policies.json) (15 rows), both derived from the production captures `raw/prod/storage-buckets.json` and `raw/prod/storage-policies.json` taken 2026-09-14T18:31:13Z through the SELECT-only Management API transport.
**Read-only:** nothing in `supabase/`, `src/` or any bucket was modified. No object was uploaded, downloaded, listed or deleted; this review reads the **catalog**, never the contents.

---

## 0. Why this review covers four buckets and not two

The requirement names two. The live catalog returns **four**, and that gap is the first result: the requirement was written from the repository, and the repository knows about one of them. Reviewing only the two named would have missed the bucket that carries this plan's highest-severity finding.

> **Three facts that govern every judgment below, stated once.**
>
> 1. **`public = true` makes the SELECT policies decorative for anonymous reads.** A bucket marked public is served from `/storage/v1/object/public/<bucket>/<path>` without a session and without consulting row-level security at all. All four buckets are public, so every `SELECT` policy in the capture governs only the authenticated `/object/<bucket>/<path>` route and the listing API — not the URL the application actually renders.
> 2. **Permissive policies OR together, so the weakest one governs.** All 15 captured policies are `PERMISSIVE`. Where a general policy and a bucket-specific policy both apply to the same command, a write is allowed if **either** passes. Three of the four buckets have a bucket-specific write policy that is weaker than the general one, and in each case the weaker policy is the operative rule. Reading the strong policy and stopping is the single easiest way to get this review wrong.
> 3. **An API route's ownership check is not a storage control.** Every upload path in `src/app/api/**` runs on the caller's own session through `@/lib/supabase/server`, which means the caller holds a token that can call the Supabase Storage REST API directly. Any check the route performs and the policy does not is bypassed by not using the route.

---

## 1. Summary — every bucket the capture returned

| Bucket | Read visibility | Size limit | MIME allow-list | Path-prefix ownership on writes | Declared by a migration? | Proposed severity |
|---|---|---|---|---|---|---|
| `avatars` | `public = true`, so public read by anyone holding the path | size limit 5 MiB | **no MIME allow-list** — any content type | path-prefix ownership **enforced** on INSERT, UPDATE and DELETE | **no** | Medium |
| `banners` | `public = true`, so public read by anyone holding the path | size limit 8 MiB | MIME allow-list of 3 image types | path-prefix ownership **enforced on UPDATE and DELETE, absent on INSERT** | **no** | Medium |
| `club-logos` | `public = true`, so public read by anyone holding the path | **no size limit at all** | **no MIME allow-list** — any content type | **no path-prefix ownership on any write command** — cross-tenant overwrite | **no** | **High** |
| `event-images` | `public = true`, so public read by anyone holding the path | size limit 5 MiB | MIME allow-list of 4 image types | writes use a flat key with no path prefix, so ownership is unenforceable by construction | yes (`011_event_images_bucket.sql`) — but its limits are not | Low |

**Headline:** the requirement's two named buckets are the two *least* interesting rows in this table. The bucket that exists in no migration, has no size limit, has no type allow-list, and lets any authenticated user overwrite any other organisation's object is the one nobody thought to ask about.

---

## 2. Per-bucket review

Each section answers the three questions AUDIT-18 asks, in order: read visibility against how the application uses the bucket, path-prefix ownership on writes, and limits.

### Bucket `avatars`

| | |
|---|---|
| Created | 2026-02-08 — the oldest of the four |
| Public | `true` |
| Size limit | `5242880` (5 MiB) |
| Allowed content types | `null` — no allow-list |
| Bucket-specific policies in the capture | **none at all** |

**Read visibility.** Public. The application renders profile pictures to signed-out visitors on club and event pages, so a public bucket matches the use. The consequence worth recording is not that the images are public — it is that they are **enumerable rather than merely guessable**. `src/app/api/profile/avatar/route.ts` writes the fixed key `${user.id}/avatar.${ext}`, and user ids are returned by the public user endpoints, so the full object path of every user's avatar is derivable from data the API already hands out. There is no signed-URL path anywhere in the codebase, and an object remains readable after the profile row stops referencing it — the upload uses `upsert: true` on a fixed key, so the previous image is replaced rather than orphaned, but nothing deletes the object when an account is removed.

**Path-prefix ownership.** **Enforced, and this bucket is the positive control for the other three.** No policy in the capture names this bucket, so the only policies that apply are the three general ones — `Allow authenticated upload to own folder` (INSERT), `Allow authenticated update in own folder` (UPDATE) and `Allow authenticated delete from own folder` (DELETE). All three carry the predicate `(auth.uid())::text = (storage.foldername(name))[1]` on the row being written, so a caller can only write, overwrite or remove an object whose first path segment is their own user id. That is exactly the key shape the route writes. **A user cannot write into another user's prefix here.** Recorded as a negative finding: having *no* bucket-specific policy is what makes this bucket correct, because there is no weaker permissive alternative for the OR to fall through to.

**Limits.** 5 MiB per object, and **no content-type allow-list**. `route.ts` restricts uploads to four image types and to 5 MiB, but that check lives in the route and the storage policy does not reproduce it, so a caller using their own session against the Storage REST API can place an object of **any content type** — HTML, JavaScript, an archive — at any key under their own prefix, and it is then served publicly with the content type they chose. The ownership predicate bounds *where* but not *what* or *how many*: the prefix is the user's own, but the number of distinct keys under it is unbounded. **Upload-abuse finding candidate, and an arbitrary-content-hosting candidate.**

**Proposed severity: Medium.** Requires authentication, does not cross a tenant boundary, and the content is served from the storage domain rather than the application's own origin — which bounds the cross-site-scripting angle. It is a latent hazard under `SEVERITY_SLA.md`'s Medium clause: adding the allow-list is a one-line dashboard change, and not having it is indistinguishable from having decided not to.

### Bucket `banners`

| | |
|---|---|
| Created | 2026-03-16 — the newest of the four |
| Public | `true` |
| Size limit | `8388608` (8 MiB) |
| Allowed content types | `image/jpeg`, `image/png`, `image/webp` |
| Bucket-specific policies in the capture | 4 — one SELECT, one INSERT, one UPDATE, one DELETE |

**Read visibility.** Public, and the same enumerability argument applies: `src/app/api/profile/banner/route.ts` writes the fixed key `${user.id}/banner.${ext}`. Two SELECT policies now cover this bucket — the bucket-specific one for role `public`, and the general `USING (true)` one for role `authenticated` discussed in § 3 — but both are moot for the public URL the application renders. Matches the use.

**Path-prefix ownership.** **Enforced on UPDATE and DELETE, absent on INSERT.** `Users can update their own banners` and `Users can delete their own banners` both carry `(storage.foldername(name))[1] = (auth.uid())::text` alongside the bucket test, so an existing object under another user's prefix cannot be modified or removed. `Authenticated users can upload banners`, by contrast, has `with_check` of exactly `(bucket_id = 'banners'::text)` — **the bucket and nothing else.** Because policies OR, that weaker INSERT rule overrides the general own-folder INSERT rule, and any authenticated caller may create an object at any key in this bucket, including under another user's prefix.

The exploitable shape is narrow but real: an attacker cannot *overwrite* a victim's existing banner, because overwriting is an UPDATE and UPDATE is ownership-checked. They can **pre-empt** a key the victim has not used yet — writing `<victim-uuid>/banner.jpg` before the victim ever uploads one. The victim can still overwrite it afterwards (their own uid matches the predicate), so this is object squatting and storage consumption attributed to another account rather than defacement of live content. Recorded as a cross-user write finding with its blast radius stated honestly rather than inflated.

The inconsistency is the more durable point: the same bucket's three write commands were written by two different hands, and only the INSERT one omits the predicate its siblings carry.

**Limits.** 8 MiB and a three-type allow-list — **the only bucket of the four whose declared limits match what its route enforces** (`ALLOWED_TYPES` and `MAX_FILE_SIZE` in the banner route are the same three types and the same 8 MiB). No upload-abuse finding on limits for this bucket.

**Proposed severity: Medium.** Authenticated-only, crosses a user boundary but in the pre-emption direction only, and the ownership predicate is already present in two of the three write policies — so the fix is to copy the predicate from the sibling policy, exactly as it was for FO-02 in `authz/fail-open-register.md`.

### Bucket `club-logos`

| | |
|---|---|
| Created | 2026-03-15 |
| Public | `true` |
| Size limit | `null` — **no limit** |
| Allowed content types | `null` — no allow-list |
| Bucket-specific policies in the capture | 3 — one SELECT, one INSERT, one UPDATE. **No DELETE policy.** |

**Read visibility.** Public. Club logos and club banners are rendered on public club pages, so public read matches the use. Paths are `${clubId}/...` — again enumerable, since club ids are returned by `/api/clubs`. Nothing sensitive is intended to live here, and nothing in the write policies prevents something sensitive from being put here by someone else (see below).

**Path-prefix ownership.** **Absent on every write command, and this is the finding of the plan.**

- `Authenticated users can upload club logos` — INSERT, `with_check` is `((bucket_id = 'club-logos'::text) AND (auth.role() = 'authenticated'::text))`. Bucket plus "is logged in". No club, no ownership, no path constraint.
- `Authenticated users can update club logos` — UPDATE, `qual` is the same expression and `with_check` is `null`, which Postgres resolves by applying the `USING` expression to the new row as well (recorded as `with_check_defaulted_from_using` in the artifact so the `null` is not misread as "unchecked"). Same story: bucket plus "is logged in".
- No DELETE policy names this bucket, so deletion falls to the general own-folder rule, whose predicate compares `auth.uid()` against a first path segment that is a **club** id. It never matches, so objects here cannot be deleted by a normal caller at all — an accidental control, and the only thing standing between this bucket and full takeover.

Consequence, stated concretely: **any one of the 37 authenticated users can overwrite the logo or banner of any of the 222 clubs.** Both `src/app/api/clubs/logo/route.ts` and `src/app/api/clubs/banner/route.ts` — the latter also writes into this bucket, despite its name — perform a genuine owner check against `club_members` with `role = 'owner'` and return 403 to everybody else. That check is in the route. The storage policy does not reproduce any part of it, and the caller holds a session token that can address the Storage REST API directly, so **the owner check is bypassed by not using the route.** Both routes also upload with `upsert: true`, which confirms overwrite is the intended operation on this key space.

This crosses the club authorization boundary — the same boundary Stage 3's club-authorization slice exists to defend — and there is no compensating control at the storage layer.

**Limits.** **Neither a size limit nor a content-type allow-list.** The two routes enforce 2 MiB (logo) and 5 MiB (banner) and three image types, and neither constraint exists in the bucket. A caller going directly to the Storage API faces no declared object-size ceiling and no type restriction in anything this audit captured. `supabase/config.toml` sets `file_size_limit = "50MiB"` under `[storage]`, but that file configures the **local** stack only and is not evidence about production; the production project-wide ceiling is a dashboard setting that was not captured, and is recorded here as a known gap rather than assumed. **Upload-abuse finding candidate: this is the least-bounded write surface in the project.**

**Proposed severity: High.** Under `SEVERITY_SLA.md`, High covers a defect that "requires authentication but crosses a trust boundary". Authentication is McGill-email-gated, which is the only thing keeping this off the Critical line; crossing from any student account to any club's branding is a tenant-boundary crossing by the definition Stage 3 uses; and the compensating control a reader would reach for — the route's owner check — is precisely the control this bypasses. The absent DELETE policy bounds it to defacement rather than destruction.

### Bucket `event-images`

| | |
|---|---|
| Created | 2026-02-14 |
| Public | `true` |
| Size limit | `5242880` (5 MiB) |
| Allowed content types | `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| Bucket-specific policies in the capture | 4 — **two identical SELECT policies**, two INSERT |

**Read visibility.** Public, matching the use: event imagery is rendered to signed-out visitors on the discovery feed. Two SELECT policies — `Public read access for event images` (from migration 011) and `Anyone can view event images` (added out of band) — are byte-identical in effect: same role `public`, same `USING (bucket_id = 'event-images'::text)`. A redundant permissive pair is not a security defect, but it is a maintenance hazard: revoking public read here requires finding and dropping **both**, and a reviewer who drops the migration-declared one will believe the bucket is closed while it is still open. Recorded as a Low hygiene finding.

**Path-prefix ownership.** **Unenforceable by construction, and that turns out to be safe here.** `src/app/api/events/upload-image/route.ts` writes a **flat** key — `${Date.now()}-${random}.${ext}` with no folder segment at all — so there is no prefix for an ownership predicate to test. The general own-folder policies still apply, and on a flat key `storage.foldername(name)` yields an empty array, `[1]` is `NULL`, and the comparison to `auth.uid()` evaluates to `NULL` rather than true. UPDATE and DELETE are therefore denied to every ordinary caller, and no bucket-specific policy re-opens them. The route uploads with `upsert: false`, consistent with a key space that is append-only in practice.

What remains open is INSERT: `Authenticated users can upload event images` permits any authenticated caller to add objects, bounded by the bucket's own type and size limits. No cross-user overwrite exposure exists in this bucket, because no object here is addressable by another user for modification.

**Limits.** 5 MiB and a four-type allow-list, and these match the route's own `MAX_FILE_SIZE` and `ALLOWED_MIME_TYPES` exactly. **But neither limit is declared anywhere in source.** Migration `011_event_images_bucket.sql` inserts only `(id, name, public)`; both the size limit and the type allow-list were applied in the dashboard afterwards. A database rebuilt from `supabase/migrations/` produces this bucket with `file_size_limit = null` and `allowed_mime_types = null` — that is, with the limits `club-logos` has today. See § 4.

**Proposed severity: Low.** Authenticated-only insert into a type- and size-bounded public bucket, no overwrite path, no cross-user exposure. The duplicate SELECT pair and the undeclared limits are the recorded items.

---

## 3. One policy that belongs to no bucket

`Allow public read access 1oj01fe_0` — SELECT, role `authenticated`, `USING (true)`, **every bucket**.

Its name is a contradiction on its face: it is called *public read access* and it is granted to `authenticated`, not to `public`. The `1oj01fe_0` suffix is the Supabase dashboard's generated policy-name discriminator, so this was created by hand in the dashboard and exists in no migration.

**Today it grants nothing that is not already granted**, because all four buckets are public and their contents are readable by anyone with the path regardless of any policy. That is exactly why it deserves a row rather than a shrug: the moment anyone creates the project's first **private** bucket — for verification documents, moderation evidence, a club's member roster export — every authenticated account can read every object in it from the first second of its existence, and nothing in the new bucket's own policy set will show why. A reviewer auditing that future bucket will find its policies correct.

**Proposed severity: Medium (latent).** This is the `SEVERITY_SLA.md` Medium clause almost verbatim — "a latent hazard that becomes High after a plausible future change" — and the plausible future change here is "add a private bucket", which is the normal next step for every application of this kind.

---

## 4. Drift — what exists in production and in no declarative source

Cross-referenced with the drift table produced by plan 01-08 (`../schema/drift.md` § `storage.buckets`, rows `avatars`, `banners`, `club-logos`, all classed `prod-only`), and extending it with a row that table does not carry.

| Object | In production | Declared in `supabase/migrations/` | Declared in `supabase/config.toml` | Survives a replay from migrations? |
|---|---|---|---|---|
| bucket `avatars` | yes | **no** | no — the `[storage.buckets.*]` block is commented out in full | **no** |
| bucket `banners` | yes | **no** | no — same | **no** |
| bucket `club-logos` | yes | **no** | no — same | **no** |
| bucket `event-images` | yes | yes, `011_event_images_bucket.sql` | no | yes |
| `event-images` size limit + MIME allow-list | yes | **no** — the migration inserts `(id, name, public)` only | no | **no** |
| 13 of the 15 `storage.objects` policies | yes | **no** — migration 011 declares 2 | n/a | **no** |

Three of four buckets and thirteen of fifteen object policies exist **only because somebody created them in the dashboard**. The verification is direct: `command grep -rn "storage.buckets\|storage.objects" supabase/migrations/` returns six lines, all in `011_event_images_bucket.sql`, declaring one bucket and two policies.

Two consequences are worth separating, because they have different owners:

1. **A rebuilt database is not this database.** A fresh local or staging environment has one bucket, two policies, and no limits. Every AUDIT-18 judgment above is therefore a statement about production and about nothing else, and any Stage 4 certification run against a rebuilt database would exercise a storage layer that does not resemble the one users touch. This is the same class of defect as the `compute_user_scores` schedule recorded in `../async/cron-webhook-inventory.md`.
2. **Even the declared bucket has undeclared limits.** `event-images` appears in a migration, so it looks covered. Its two actual protections — the size ceiling and the type allow-list — are not in that migration. "Declared in a migration" is therefore not the same as "reproducible", and the drift table's per-bucket boolean, which this review reads from the live capture rather than from the migration, is the reason the difference is visible.

**Schema-drift finding candidate and REFAC-01 input.** Proposed severity **Medium**, on the reproducibility clause rather than on exposure — no attacker benefits from the drift itself; what it costs is every guarantee the later stages want to make about an environment they did not capture.

---

## 5. Consolidated finding candidates

| # | Bucket / object | Class | Proposed severity | Exposure rationale |
|---|---|---|---|---|
| ST-01 | `club-logos` | Cross-tenant overwrite (Tampering, T-01-10-02) | **High** | Any authenticated user may INSERT or UPDATE any object in the bucket. The route-level club-owner check is bypassed by addressing the Storage REST API with the caller's own session token. Crosses the club authorization boundary. Bounded below Critical by McGill-gated authentication and by the accidental absence of a DELETE policy. |
| ST-02 | `club-logos` | Upload abuse (DoS, T-01-10-04) | Medium | No size limit and no content-type allow-list on a bucket any authenticated user can write to. Production's project-wide ceiling was not captured and is recorded as a gap, not assumed. |
| ST-03 | `avatars` | Upload abuse / arbitrary content hosting (T-01-10-04) | Medium | No content-type allow-list; the route's four-type check is not reproduced in the policy. Writes are confined to the caller's own prefix, but the number of keys under it and the content type of each are unbounded. |
| ST-04 | `banners` | Cross-user write (Tampering, T-01-10-02) | Medium | The INSERT policy tests the bucket only, while the sibling UPDATE and DELETE policies test path-prefix ownership. Permits key pre-emption under another user's prefix; overwrite of live content is still blocked. |
| ST-05 | `storage.objects` — `Allow public read access 1oj01fe_0` | Information disclosure, latent (T-01-10-03) | Medium (latent) | `USING (true)` for `authenticated` across every bucket. Grants nothing today because all four buckets are public; grants everything the day a private bucket is created. |
| ST-06 | 3 buckets + `event-images` limits + 13 policies | Schema drift (Repudiation, T-01-10-06) | Medium | Exists in production and in no migration or config file. A rebuilt environment has a materially different storage layer, which invalidates any certification run against it. |
| ST-07 | `event-images` | Hygiene | Low | Two byte-identical permissive SELECT policies. Revoking public read requires dropping both; dropping only the migration-declared one leaves the bucket open while appearing closed. |

**Not a finding, recorded deliberately as the negative:** `avatars` enforces path-prefix ownership correctly on all three write commands, and it does so *because* it has no bucket-specific policy for the permissive OR to fall through to. `event-images` has no cross-user overwrite exposure, because its flat key space makes every ownership predicate evaluate to `NULL` and therefore deny. Both are stated so a reader can tell that the four rows above were reached by examination rather than by assuming the worst everywhere.

**Read visibility produced no finding for any bucket.** All four are public, all four hold content the application renders to signed-out visitors, and public read matches the use in every case. That answer took the same work as a finding would have, and recording it is what stops the next reviewer from re-deriving it.

---

## 6. Reproduction

```bash
# the two live captures this review is derived from (already committed; do not re-query)
node -e "console.log(JSON.parse(require('fs').readFileSync('.planning/audit/raw/prod/storage-buckets.json','utf8')).rows.length)"    # 4
node -e "console.log(JSON.parse(require('fs').readFileSync('.planning/audit/raw/prod/storage-policies.json','utf8')).rows.length)"   # 15

# every write policy that lacks an ownership predicate — the ST-01/ST-04 population
node -e "JSON.parse(require('fs').readFileSync('.planning/audit/storage/storage-policies.json','utf8')).filter(p=>p.write_without_ownership_predicate).forEach(p=>console.log(p.cmd,p.policyname,p.bucket_scope))"

# every bucket with an absent limit — the ST-02/ST-03 population
node -e "JSON.parse(require('fs').readFileSync('.planning/audit/storage/buckets.json','utf8')).filter(b=>!b.has_size_limit||!b.has_mime_allowlist).forEach(b=>console.log(b.id,b.file_size_limit,b.allowed_mime_types))"

# the drift claim, verified against the tree rather than asserted
command grep -rn "storage.buckets\|storage.objects" supabase/migrations/   # 6 lines, all in 011_event_images_bucket.sql
command grep -n "storage.buckets" supabase/config.toml                     # line 113, commented out

# the gate
node .planning/audit/tools/validate.mjs --check storage
bash .planning/audit/tools/readonly-guard.sh
```

---

*Requirement AUDIT-18 · phase 01-read-only-foundation-audit · plan 01-10 · verified 2026-09-14*
