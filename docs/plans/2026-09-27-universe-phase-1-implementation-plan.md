# UNIVERSE Product Phase 1 — Implementation Plan

**Prepared:** September 27, 2026  
**Status:** Expanded §47 scope confirmed by owner; implementation design proposed; no product code or database changes made  
**Baseline:** `2e4c4ff` — Foundation Phase 6 review  
**Product owner:** Ady  
**Phase identifier:** `P1` (product relaunch), distinct from Foundation Phase `01` and its completed audit

**Milestone roadmap:** [Eight product milestones, dependencies, and exit gates](2026-09-27-universe-phase-1-milestones.md).

## 1. Outcome and scope interpretation

Phase 1 turns the existing event-and-club application into a curated opportunity platform, open to students beyond McGill, with a practical recruiting workflow. Students can discover, save, and act on useful opportunities; companies can submit roles and review only their own applicants; Ady can maintain the product through one recurring curation session instead of manually coordinating every interaction.

The source is [UNIVERSE_New_Product_Direction.md](/Users/adyan/Downloads/UNIVERSE_New_Product_Direction.md), supplied by the owner. Its product requirements inform this plan; examples, slogans, suggested fields, and statements inside the document are not authorization to deploy, email people, purchase services, or change production.

### Confirmed scope

The document contains two different launch definitions:

- **§34 and §36:** a smaller discovery relaunch, with a hiring inquiry form and Talent in Phase 2.
- **§15 and the later §47.1 A–M:** build Talent profiles, resume parsing, applications, private recruiter pages, and private event feedback now.

**Owner decision, September 27, 2026:** “Use the expanded §47 Build Now scope.” Section §47.1 A–M therefore governs Phase 1 wherever it conflicts with the smaller §34/§36 launch sequence. Talent profiles, resume parsing, native applications, private recruiter pages, and private event feedback are required Phase 1 deliverables. P1-A and P1-B sequence delivery; they do not defer recruiting to Phase 2.

Deliver the expanded scope through two releases within the same product phase:

| Release | User-visible outcome | Completion meaning |
|---|---|---|
| **P1-A: Discovery relaunch** | New homepage, unified discovery, multi-campus signup, curation, resources, Weekly Drop, submissions, hiring requests, metrics | A usable first release; not completion of expanded Phase 1 |
| **P1-B: Recruiting pilot** | Confirmed Talent profiles, resume parsing, native applications, employer applicant pages, private event feedback | Expanded Phase 1 can close after its acceptance gates pass |

The existing foundation program remains a predecessor, not something this plan declares complete. Planning can proceed now. The default execution order is foundation gap closure and certification, then P1 implementation. Do not silently bypass the existing Foundation Stage 4 gate; a change to that ordering must be recorded as a separate owner decision.

## 2. Requirements and deliberate limits

| ID | Phase 1 requirement | Source | Packages |
|---|---|---|---|
| P1-R01 | Opportunity-first homepage and responsive navigation | §§10–12, 24, 34 | 03, 06 |
| P1-R02 | One feed for events, hackathons, jobs/internships, programs, networking, and relevant grants/competitions | §47.1 A | 04, 05, 06 |
| P1-R03 | McGill remains the deepest dataset; students from any university can join | §8, §47.1 B | 02, 07 |
| P1-R04 | Fast manual curation, scarce Ady's Picks with a reason, visible source and freshness | §§19–20, §47.1 C–D | 04, 05, 07 |
| P1-R05 | Small authored resource library with source, audience, category, and update date | §14, §47.1 E | 08 |
| P1-R06 | One Weekly Drop powers web, email, and copyable LinkedIn content | §21, §47.1 F | 10 |
| P1-R07 | Public opportunity/resource submission with manual moderation | §26, §47.1 G | 09 |
| P1-R08 | Structured company request; approved roles can be published | §§15.7, 30, §47.1 I/K | 09, 13 |
| P1-R09 | Explicit Talent opt-in; editable proof-of-work profile | §15.2, §47.1 H | 11, 12 |
| P1-R10 | Resume upload → structured draft → student confirmation | §15.3, §47.1 H | 12 |
| P1-R11 | Apply with existing profile/resume and up to three short role questions | §15.6, §47.1 I | 14 |
| P1-R12 | Private applicant pages restricted to recruiters assigned to that role | §15.8, §47.1 J | 13, 15 |
| P1-R13 | Simple internal recruiting lifecycle; direct external contact after application | §15.10, §47.1 K | 13, 15 |
| P1-R14 | Private post-event feedback; no public star ratings | §13.1, §47.1 L | 03, 16 |
| P1-R15 | Minimal discovery, subscription, recruiting, and repeat-use analytics | §39, §47.1 M | 17 |
| P1-R16 | Sustainable weekly operation, retries, freshness checks, and visible failures | §40, §47.6 | 07, 10, 12, 18 |
| P1-R17 | Founder attribution through useful picks/resources and an honest About page | §§6, 20, 32 | 06, 08, 10 |
| P1-R18 | Preserve existing accounts, saved events, event links, and necessary organizer workflows | Existing repo + revamp continuity | 02–07, 18 |

**Explicitly excluded:** public social posting, DMs, new followers/likes, public Talent directory, recruiter-wide candidate search, candidate quality scores, automated matching, ATS stages/notes/scheduling, community wiki, open builder uploads, monetization, native apps, paid scraping expansion, full organization account management, and a new ML recommendation engine.

Manual builder spotlights are optional later content, not a Phase 1 dependency. A newsletter edition need not contain a builder. No invented placement numbers, testimonials, partners, awards, or resource authorship may be used as launch content.

## 3. What exists and what changes

| Existing asset or constraint | Evidence in this checkout | Phase 1 treatment |
|---|---|---|
| Next.js App Router, React, TypeScript, Tailwind, SWR, Zustand | `package.json`, `src/app`, `src/hooks`, `src/store` | Keep the stack; no framework migration |
| Central contracts, auth guards, route wrapper, cache policy, logging | `src/contracts`, `src/server` | Reuse for every new endpoint |
| Central privileged client and registry | `src/server/db/elevated/` | Ordinary reads/writes use RLS; register justified privileged operations |
| McGill-only OAuth callback deletes non-McGill auth users | `src/app/auth/callback/route.ts:159–182` | Replace the restriction intentionally; do not retain deletion as a fallback |
| Global onboarding redirects and McGill-specific fields | `src/proxy.ts`, `OnboardingWizard.tsx` | Short student onboarding; recruiter access does not require student onboarding |
| Event feed, saves, RSVPs, clubs, calendars | `src/app/api/events`, `src/app/api/users/saved-events`, `src/app/calendar` | Preserve event storage and compatibility while broadening discovery |
| Signed event webhook with content-hash deduplication | `supabase/functions/events-webhook`, `functions/_shared` | Repair and retain; observe the actual external producer before claiming ingestion works |
| Webhook stores incoming `image_url` directly | `_shared/webhook-handler.ts` | Verify upstream persistence; add bounded persistence only where missing |
| Public database review reads | Baseline migration policy `Anyone can read reviews` | Remove public read access in the relaunch privacy migration, not just the UI |
| Existing reviews check start time, not event end | `src/app/api/events/[id]/reviews/route.ts` | New feedback eligibility uses event end and an explicit attendance declaration |
| Authenticated reviews API calculates star aggregates | Same route, `EventReviewsSection.tsx` | Retire public-facing rating presentation and aggregate response fields |
| Social navigation and event-heavy homepage | `navItems.ts`, `AppShell.tsx`, `src/app/page.tsx` | Replace primary navigation and homepage composition |
| Existing organizer/admin surfaces | `src/app/my-clubs`, `src/app/moderation` | Preserve essential operations; extend moderation instead of building a second CMS |
| Recommendation scoring and experiments | `src/lib/recommendations.ts`, recommendation routes | Repair relevant defects; do not make new discovery depend on inferred/social scoring |
| CI, Jest, pgTAP, Playwright, seeded personas | `.github/workflows/ci.yml`, `scripts/seed`, `e2e` | Extend with new entities and access boundaries |

No email delivery provider, resume parser, or runnable external scraper producer was established by this review. The `AI/` directory mentioned in older material is absent. These are explicit discovery tasks, not working integrations assumed by the estimate.

## 4. Foundation prerequisite F0

Use the existing review and verification records as the source of truth. Do not create a competing remediation ledger or mark issues closed based on this plan.

| Work | Required outcome before dependent product work |
|---|---|
| **DI-83 / REFAC-15** | Null webhook body, null array entry, and non-string tag return contracted 400 responses; Jest and Deno agree; valid signed requests and replay handling preserved |
| **WR-01** | Page-level authorization before docs/moderation data access; direct page and partial-render coverage |
| **WR-02 / WR-03** | Handled failures are observable; failed public reads cannot become shared cached empty successes |
| **WR-04** | Referrer query data scrubbed; later private recruiting/resume routes covered by the same scrub policy |
| **WR-05 / WR-06** | Recommendation profile select is valid; result count and reranking work bounded |
| **WR-07** | Experiment attribution resolved from trusted server assignment |
| Other review info and deferred items | Triage against new scope; close anything affecting a shipped workflow, including unsafe URLs, pagination, unbounded interaction payloads, and logging of private data |
| Foundation 7–8 | Complete the existing certification/sign-off process with evidence; distinguish inherited defects from intentional P1 behavior changes |
| Live configuration and deploy | Follow [Phase 6 completion §8](../../.planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/PHASE-6-COMPLETION.md): dependency decisions, distributed rate limiting, observability, migration-history repair, deployment and real-CDN checks |

Do not treat the handoff's “run the three human tests first” as a literal executable sequence: the live malformed-webhook check depends on DI-83 being fixed and deployed. Local fixes and tests precede that live verification. Production changes and messages are outside this planning task.

The previously recorded floor is 3,439 Jest passes, 269 Playwright passes, and 260 database assertions. Those are historical measurements, not fresh execution evidence. Record a fresh implementation baseline when F0 closes.

## 5. Product and architecture decisions

### 5.1 One discovery contract, incremental event migration

Introduce a shared `DiscoveryItem` contract for the product, backed by two existing/new storage sources:

1. Existing `events` remain authoritative for event dates, status, club association, and legacy IDs.
2. New `opportunities` store non-legacy listings: jobs, internships, programs, grants, and deadline-driven hackathons/competitions.
3. A `security_invoker` database view with explicit public columns normalizes approved, non-deleted records from both. Apply filtering, ordering, and keyset pagination in the database through an invoker function/query layer. Do not fetch two unbounded collections and sort them in JavaScript.
4. Stable discovery identity is `{ kind: "event" | "opportunity", id: UUID }`. Event detail URLs and existing saves remain valid. The identity is carried through tracking, reports, selections, and cursors.
5. New metadata for legacy events lives in a one-to-one `event_discovery_metadata` table. It stores relevance/eligibility, provenance review, optional deadline, curator note, and pick state, not copies of event title/date/status.
6. `saved_events` remains the event-save authority; `saved_opportunities` covers new listings. A shared save service dispatches by kind and exposes one saved-items screen. No double-writing event saves.

This is a compatibility boundary, not two separate products. It avoids rewriting event cron jobs, scoring functions, RSVPs, and scraper clients merely to rename their entity. A later event-to-opportunity physical migration is unnecessary for Phase 1.

Hackathons with an existing event record use that record plus metadata; manually curated application-first hackathons can be opportunities with both deadline and occurrence dates. Moderation must detect cross-source duplicates before publishing a second record. Canonical redirects resolve manually merged duplicate listings; do not deduplicate unrelated recurring editions solely by title.

### 5.2 Discovery behavior

- Launch type groups: Events, Hackathons, Jobs, Programs, Networking, Grants & competitions. Keep `job` versus `internship` and program subtype in structured metadata; do not create a large tag hierarchy.
- Five controls maximum: type, university relevance, date/deadline, field, and location/work mode. URL query parameters are shareable, validated, and reset pagination when changed.
- University **relevance**, organizer affiliation, and **eligibility** are separate. A McGill-organized event is not automatically McGill-only. Missing eligibility displays “Check eligibility with organizer,” not a fabricated promise.
- Default results include McGill and cross-campus opportunities. A student's university can preselect a visible filter; it never changes a shared cached response invisibly.
- Default sort: explicit editorial priority, next actionable date, publication time, stable identity. Define null handling and include all sort values plus a filter hash and fixed `as_of` in an opaque, versioned cursor.
- “This Week” contains occurrences in the week and application deadlines in the week, clearly labeled. America/Toronto is the display/week boundary; store instants in UTC with source timezone. Date-only deadlines retain precision and use the stated source timezone; show an assumption if the source provides none.
- Events leave upcoming discovery after their end. Deadline opportunities close after their deadline. Evergreen items have an explicit next review date; no deadline is not permission to remain live forever.
- Public detail pages remain accessible after expiry with a clear closed state and no misleading application CTA. Private/pending/suspended items return appropriate non-disclosing responses.
- Search uses bounded Postgres search initially. No external search service or new recommendation infrastructure.

### 5.3 Accounts, campus affiliation, and permissions

Any verified email account may use the platform, including non-university email. Retain Google OAuth; add email OTP for recruiters and users who cannot use Google. University and program are self-declared profile fields, never proof of institutional verification or permission to administer a club.

Keep existing admin and club authorization. Recruiter permission comes from an admin-approved role-access row bound to a verified user, not from user-editable metadata, email-domain similarity, company name, or knowing a URL. A person may be both student and recruiter.

Legacy users keep their accounts, roles, saves, and onboarding state. Backfill McGill affiliation only when supported by their historical verified email, label its basis, and allow correction. Do not force every existing user through onboarding again. New student onboarding requires name and university (including Other/prefer not to specify); interests/program/year are optional. Talent enrollment is a separate explicit action.

### 5.4 Recruiting workflow and consent

Two application modes are explicit on each role: `external` (outbound source/ATS link) and `universe` (native application). Native mode is enabled only after P1-B passes its access and privacy gates. P1-A can publish external roles and collect hiring requests without presenting an unfinished application product.

Talent profiles are private. Students can save drafts, upload a resume, confirm parsed fields, and opt in. Applying shows the company, role, exact profile/resume version, contact details being shared, and the role questions. Submission stores a confirmed snapshot, so later profile edits do not silently rewrite an application already reviewed by a company.

Default consent semantics:

- Joining Talent does not expose a profile to all companies and does not subscribe the student to marketing.
- Applying shares only that application with approved recruiters for that role.
- Direct-introduction consent is separate and defaults off; this phase does not automatically source or distribute profiles.
- Withdrawal revokes future recruiter access to the application and its resume. Downloaded copies cannot be recalled; say so in the application flow.
- Opting out of Talent stops new applications/introductions and, after an explicit warning, withdraws active applications. Keep a content-free receipt for the student; remove recruiter-accessible snapshots/files according to the deletion policy.
- Closing a role stops applications but does not immediately hide existing applicants. Proposed pilot retention: recruiter access expires 90 days after role closure; then purge application snapshots/resume references. Unsubmitted parse artifacts expire after 7 days. These are product defaults to confirm before handling real resumes, not legal conclusions.
- Deleting a resume used by an active application explains the impact and offers withdrawal; never silently leave a readable orphan copy.

Recruiters receive an authenticated route URL, not a permanent bearer link. A forwarded link without the assigned account grants no access. Invitation tokens are single-use, expire, are stored hashed, and are exchanged for role membership only after recipient email verification. Token-bearing requests are excluded from analytics/log payloads and redirected to a clean URL.

The internal display lifecycle is **New → Approved → Live → Applicants → Closed**. “Applicants” is derived from a live role having submitted applications; it is not a stage that stops new applicants. Rejected/withdrawn are terminal intake outcomes. Do not create interview stages or recruiter notes.

### 5.5 Resume processing

Launch with PDF uploads and manual profile entry as an equal fallback. Proposed limits: 5 MB, 10 pages, one parse in flight per user, explicit retry budget. DOCX, OCR, and scanned-resume recognition are later unless the first pilot proves them necessary.

Use a private Storage bucket and owner-bound upload authorization, then finalize/validate the actual object before it becomes available. Do not route a 5 MB multipart payload through the normal app request body without checking hosting limits; direct private Storage upload avoids that dependency. Verify bytes, size, type, ownership, and parsing limits. Never use the public image-upload flow for resumes.

A durable `resume_parse_jobs` row tracks queued/running/succeeded/failed/cancelled, attempts, lease expiry, and parser version. A bounded scheduled worker can recover abandoned leases; Next `after()` is insufficient as the only queue. Start with text extraction and conservative section parsing; evaluate PDF.js in P1-12 before adopting/pinning it. Do not introduce an LLM vendor or transmit resumes to one without an explicit provider/data decision.

Parsing produces suggestions in a draft. No field is authoritative before confirmation; missing fields stay missing. The student can complete the profile if parsing fails. Do not claim interpretation accuracy just because a PDF's text was extracted. The release gate includes measured field extraction against representative synthetic/consented resumes.

Recruiter resume access uses an authenticated download endpoint that checks active role membership and application visibility on every request. Responses are private/no-store, attachment downloads, with no public URLs or long-lived signed links. Student previews follow owner checks. Parser/download errors must not log document contents, original filenames, email, or extracted text.

### 5.6 Weekly Drop and delivery

One saved edition contains ordered references to opportunities/events/resources and editor-written notes. Render a web edition, email preview, and copyable LinkedIn text from that same edition. No automatic LinkedIn publishing.

Use a managed email provider behind a narrow delivery adapter. Provider choice and sender-domain access are a P1-00 decision; do not build an SMTP server. Double opt-in, unsubscribe, bounce/complaint suppression, webhook signature verification, and delivery idempotency are required. Newsletter consent is separate from authentication and Talent.

Publishing a web edition and sending email are separate explicit actions. Snapshot the content and eligible recipient set for a send. Persist a unique send/delivery key before calling the provider; use provider idempotency/reconciliation to prevent duplicates after a timeout. Recheck suppression at send time. A failed send must not leave Ady guessing which recipients received it. Transactional recruiting notices reuse the adapter but never include resumes or private candidate data.

## 6. Route and UX map

| Surface | Route | Behavior |
|---|---|---|
| Editorial home | `/` | Hero, This Week, scarce picks, category links, resources, Weekly Drop signup, company CTA |
| All discovery | `/discover` | Public feed, filters, honest empty/error states, pagination |
| New listing | `/opportunities/[id]` | Source, eligibility, deadline/date, last checked, save, external or native action |
| Existing event | `/events/[id]` | Existing canonical URL; updated presentation and source RSVP CTA |
| Resources | `/resources`, `/resources/[slug]` | Public authored guides/templates; no open wiki |
| Weekly Drop | `/weekly`, `/weekly/[slug]` | Signup, current issue, issue archive |
| Submission | `/submit` | Public type-selecting form; private contact details |
| Company intake | `/for-companies` | Value proposition and structured role request |
| Talent | `/talent`, `/talent/profile`, `/talent/applications` | Explanation, opt-in, private editor, submitted/withdrawn receipts |
| Application | `/opportunities/[id]/apply` | Authenticated preview, questions, consent, confirmation |
| Recruiter workspace | `/recruiting/roles/[id]` | Assigned recruiters only; own applicants, filters, downloads |
| Saved items | `/saved` | Unified event/opportunity saves; old `/my-events` remains compatible |
| Curation | `/moderation/opportunities`, `/moderation/resources`, `/moderation/weekly`, `/moderation/recruiting` | Extend existing admin shell and audit trail |
| Story and trust | `/about`, `/privacy`, `/terms` | Updated scope, real founder story, accurate data flows |

Primary navigation for P1-A: Discover, Resources, Weekly Drop, For Companies; Submit as a secondary action. Add Talent for the P1-B pilot when its backend is enabled. Saved/Profile are account actions. Clubs remain discoverable under Discover. Desktop and mobile share one navigation definition.

### Existing features: preserve, de-emphasize, or retire

| Feature | Phase 1 disposition |
|---|---|
| Event URLs, saves, calendars, existing exports | Preserve; no broken bookmarks or lost data |
| Native event RSVP | Preserve historical state and event compatibility; external registration takes primary CTA when present; do not equate an outbound click with an RSVP |
| Club directory and essential organizer editing | Keep through secondary navigation; no new club-management features |
| Friends feed, friend suggestions, public people discovery, inferred-tag toasts | Remove from relaunch navigation/homepage; do not expand. Existing private data/functions are not deleted in this phase |
| Public user profile URLs | Do not turn them into Talent profiles; retain existing visibility controls, remove promotion from new discovery, and keep Talent data physically separate |
| Public ratings | Remove stars/aggregates and revoke public database reads; old direct review APIs must not leak them |
| Legacy review records | Preserve as private historical records; do not fabricate new structured answers from old star values |
| `/landing` | Redirect to the new homepage after cutover; update internal links and sitemap |
| Existing recommendations/experiments | Leave behind compatibility routes after fixes; no experiment runs on recruiting data; new feed starts with deterministic curation |

## 7. Proposed data model and ownership

These are design specifications, not executable migrations. Use the repo's imperative migration workflow, generated types, local replay, grants, and pgTAP coverage. Confirm names against the complete live schema during implementation.

| Entity | Minimum contents and constraints | Access |
|---|---|---|
| `universities` | UUID, stable slug, name, city, active; seed McGill/Concordia/Poly/UdeM/HEC/ÉTS; allow Other without an institution row | Public read; admin manage |
| Existing `users` additions | Nullable university FK, other-university text, program; optional study/graduation fields; self-declared source | Owner-safe column updates only; no privilege columns in profile contract |
| `opportunities` | UUID, unique stable slug, type/subtype, title/body, organization display, location/work mode, start/end/deadline with precision/timezone, eligibility text, tags, source/source URL, action mode/URL, status, published/checked/review timestamps, curator note, pick actor/time/reason, soft-delete | Public approved projection; admin writes |
| `opportunity_universities` | Opportunity FK + university FK unique pair; scope separately records cross-campus/unknown/specific | Public read for approved listings; admin writes |
| `event_discovery_metadata` + university join | Event FK unique; only new discovery metadata and editorial fields | Public safe fields if linked event is public; admin writes |
| `saved_opportunities` | User + opportunity unique pair, timestamp | Owner only; save only accessible listings |
| `submissions` | Type, bounded structured payload, private contact, source URL, status, reviewer/reason, published target FK(s), created time | Public bounded intake through server; admin reads; no anonymous table insert grant |
| `listing_reports` | Exactly one FK to event/opportunity/resource, reason, bounded details, optional reporter, status | Intake through server; admins; no public listing of reports |
| `resources` | UUID, unique slug, title, safe Markdown/body or external link/file, category, author attribution, intended audience, source, status, updated/review date, pick metadata | Public approved fields; admin manage |
| `weekly_editions`, `weekly_items` | Unique slug/date, draft/published state; ordered references using checked exclusive FKs to event/opportunity/resource; frozen published copy | Public published copy; admin edits/sends |
| `newsletter_subscribers` | Normalized email uniqueness, pending/confirmed/suppressed state, consent time/version/source, hashed token state | Server/admin only; no subscriber discovery |
| `email_deliveries` | Edition or notification key, recipient reference, provider ID, state/attempt/retry; unique logical delivery key | Worker/admin operational access only |
| `talent_profiles` | User PK/FK, opt-in state/time/version, separate introduction consent, program/graduation, skills, desired roles, availability/work mode, safe links, bounded typed project/experience/award/hackathon/leadership sections | Owner and narrowly scoped operational admin; recruiters cannot query the base profile |
| `resume_assets` | UUID, owner FK, random private storage path, size/type/checksum, validation state, created/deleted timestamps | Owner metadata; download through authorized application/owner path |
| `resume_parse_jobs` | Owner/asset FKs, state, lease, attempts, parser version, bounded draft/result/error code, expiry | Owner status/draft; worker; no public reads |
| `job_details` | Opportunity PK/FK; public duties/skills, compensation/hours/work type/start date, optional resume requirement, up to three bounded/versioned question definitions | Public for approved opportunities; admin writes |
| `recruiting_roles` | Unique opportunity FK, originating submission, employer contact, approval/live/closed timestamps and private recruiting lifecycle data | Admin and assigned recruiters only; excluded from the public discovery projection |
| `recruiter_role_access`, `recruiter_invites` | Role + verified user unique pair, active/revoked; separate recipient/hash/expiry invitation state | Admin issues; scoped recruiter may read own access |
| `applications` | Role + student unique pair; state, confirmed immutable profile/question snapshot, resume asset/version FK, consent version/time, submitted/withdrawn/expiry time | Applicant; active recruiter for that role while shared; scoped admin |
| `event_feedback` | Event + student unique pair; end-time validation, self-reported attendance and supporting signal, recommendation/value/content/organization answers, private text, schema version | Owner and admin; optional thresholded organizer aggregate only |
| `product_events` | Allowlisted event name, typed content reference, timestamp, bounded source/campaign, pseudonymous/session identifiers when permitted | Server ingestion; aggregate admin reporting |

Implementation rules:

- Use UUID keys and real FKs. For references to multiple content tables, use explicit nullable FKs plus an exactly-one constraint rather than unvalidated polymorphic IDs in persistence.
- Keep frequently filtered fields relational. Small profile sections may use bounded versioned JSONB; do not put the entire recruiting model or feed in an arbitrary JSON blob.
- Use `timestamptz` for instants and explicit source date precision. Validate date ordering, URL schemes, enum values, lengths, and field counts in contracts and essential database constraints.
- Give `anon` and `authenticated` only necessary grants, with RLS on each exposed table and policies per operation. Owner UPDATE policies must check both existing and resulting ownership. School/profile fields cannot modify roles, bans, review state, or recruiter membership.
- Restrict privilege/lifecycle/snapshot fields through column grants or guarded transaction functions; RLS alone does not stop an allowed row writer changing a sensitive column.
- Applications have no direct client insert/update grant for their snapshots, consent receipts, or sharing state; submission and withdrawal go through the narrowly granted transaction operations. Recruiters cannot edit applicant snapshots. The public job detail table contains no employer contact address.
- Use invoker views/functions for ordinary reads. Where transactions require elevated behavior, document the narrow operation, validate `auth.uid()`, fix `search_path`, revoke broad EXECUTE, and test direct RPC abuse. Do not solve every new policy problem with the service client.
- Index FK columns and access predicates: public status plus feed order; deadlines; university joins; saved user keys; role/application time; active recruiter access; queue state/lease; subscriber state. Use appropriate search/tag indexes only after representative EXPLAIN measurements.
- A public table/view contains no employer contact email, submitter email, resume path, recruiter tokens, application snapshots, or private feedback. Explicit selects and response contracts enforce the same separation in APIs.

RLS and view design follows the current [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security); private file policies follow [Storage access control](https://supabase.com/docs/guides/storage/security/access-control). These references support the access mechanisms; the role boundaries above are this product's design decisions.

## 8. Endpoint families and contracts

All new route handlers use `withRoute`, named cache classes, `src/contracts/*`, the existing CSRF/rate-limit infrastructure, and observable failure responses. Server components enforce sensitive access close to the read, not solely in layouts/proxy. Default maximum list size is 50; discovery default is 20.

| Endpoint family | Operations | Principal/cache |
|---|---|---|
| `/api/discovery` | GET filtered, paginated public projection | Anonymous; explicit short public cache |
| `/api/opportunities/[id]` | GET published detail | Public safe response; mutations via admin family |
| `/api/saved` and `/api/opportunities/[id]/save` | GET union; idempotent PUT/DELETE for new saves | Active owner; private |
| `/api/resources`, `/api/resources/[slug]` | GET approved index/detail | Public |
| `/api/submissions`, `/api/company-requests`, `/api/listing-reports` | POST bounded intake | Public; private response; strict abuse budget |
| `/api/newsletter/subscribe`, `/confirm`, `/unsubscribe` | POST signup and confirmation/suppression flows | Public token-bound actions; private; no email enumeration |
| `/api/admin/opportunities`, `/resources`, `/weekly`, `/recruiting` | CRUD/review/publish/close/send/invite operations | Active admin; private; audited |
| `/api/talent/profile`, `/consent` | Owner read/edit/enroll/opt-out | Active owner; private |
| `/api/talent/resumes` plus finalize/parse/status | Authorize upload, validate asset, enqueue/poll parse | Active owner; private; per-user quotas |
| `/api/opportunities/[id]/applications` | POST atomic application | Active opted-in student; private |
| `/api/talent/applications`, `/[id]/withdraw` | Own receipts and withdrawal | Active owner; private |
| `/api/recruiting/roles/[id]/applicants` | GET bounded filters/pagination | Verified active role member; private |
| `/api/recruiting/applications/[id]`, `/resume` | GET authorized snapshot/file | Same role check on each request; private |
| `/api/events/[id]/feedback` | GET own eligibility/response; PUT bounded feedback | Active owner; private |
| `/api/product-events` | POST schema-bound metrics | Public bounded writes; no arbitrary metadata |
| Provider callbacks / worker entry | Signed email delivery callbacks; credentialed bounded work | Machine principal; fail closed; private |

New contracts: `discovery.ts`, `opportunities.ts`, `resources.ts`, `submissions.ts`, `newsletter.ts`, `talent.ts`, `recruiting.ts`, `event-feedback.ts`, `product-events.ts`. Reuse common UUID/date/URL rules instead of copying validation across forms.

Public feed/detail cache must never contain `is_saved`, application state, contact details, or user-specific order. Fetch saved/application state separately using private endpoints. Keep SWR cache keys scoped to the user and clear private cached data on sign-out/account switch.

Unpublishing or correcting a listing must invalidate application/Next caches and document the CDN maximum stale window. Sensitive content uses no stale sharing. State-changing application endpoints always recheck publication/deadline/role state in the database, regardless of cached page content.

## 9. Implementation packages and dependency order

Each package produces a reviewable PR with contracts, migration/RLS changes where needed, meaningful tests, and a short verification note. Package IDs belong to this product plan; they do not overwrite `.planning/phases/01-*` or imply a GSD command has executed.

### P1-00 — Record confirmed scope and resolve external dependencies

**Depends on:** none for planning; F0 for implementation. **Estimate:** 1–2 engineering days.

Carry the confirmed expanded §47 scope into the execution decision record. Resolve launch copy direction, sender domain/email provider, resume pilot defaults, and access to the actual scraper producer. Identify staging/preview configuration and who can provide real launch content. Approve a minimal flow map for anonymous discovery, student signup, submission, application, and recruiter review. Record intentional changes to the old McGill-only and public-review preservation requirements as new product decisions.

**Output:** phase decision record, integration inventory, launch-content checklist, refreshed implementation baseline. Update current project guidance when implementation begins; preserve historical foundation reports as historical evidence.

**Done when:** no task depends on an unidentified production account/provider; unresolved external access has an owner and blocks only its dependent release gate. Do not buy/provision services as part of planning.

### P1-01 — Establish relaunch boundaries and flags

**Depends on:** F0, P1-00. **Estimate:** 1–2 days.

Add server-authoritative release switches for discovery UI, native applications, recruiter access, resume parsing, and new feedback writes. Read switches through one typed module. Use route groups/components to separate public editorial, account, moderation, and recruiter shells without changing existing URLs. Avoid independent flags for every card.

**Files:** new `src/lib/features.ts`; `src/app/layout.tsx`; `src/components/layout/AppShell.tsx`; `src/proxy.ts`; route-family guards.

**Done when:** disabled writes fail closed on the server; a preview can expose new discovery to test accounts; rollback to the previous app does not require destructive schema reversal. Auth expansion is not a toggle that can safely re-enable the old account-deletion behavior.

### P1-02 — Open accounts beyond McGill

**Depends on:** P1-01. **Estimate:** 3–4 days.

Add universities and safe profile fields/grants. Replace `isMcGillEmail` rejection/deletion in the callback with verified-session/profile synchronization. Audit all domain checks, account triggers/hooks, Google OAuth audience settings, club invitation rules, auth copy, privacy copy, and seeded non-McGill personas; change account admission without silently widening club authority. Add email OTP through the shared verified callback flow, with safe internal redirect validation and no role claims from metadata.

Simplify onboarding; preserve legacy completion. Allow verified recruiters with assigned role access to enter their workspace without completing student onboarding. Public discovery should remain usable during incomplete onboarding; enforce completion at student mutations that need it rather than redirecting every public page.

**Files:** `src/app/auth/callback/route.ts`, auth components, `OnboardingWizard.tsx`, `src/contracts/users.ts`, profile route/store/types, `src/proxy.ts`, new migration and RLS tests.

**Done when:** McGill, Concordia, and non-institutional verified users sign in; unverified/failed sessions fail closed; existing roles/bans remain effective; recruiter-only users are not trapped in student onboarding; non-McGill sign-in no longer deletes accounts. Replace old rejection assertions with intentional product-change tests, not blanket test deletions.

### P1-03 — Editorial shell and legacy exposure changes

**Depends on:** P1-01. **Estimate:** 2–3 days.

Create shared desktop/mobile navigation, editorial spacing/type tokens, accessible filter/card/form primitives, loading/empty/error states, and light/dark parity. De-emphasize social routes and inferred-interest UI. Implement the privacy migration restricting legacy `reviews`; update its API and UI together so anonymous/direct database reads and signed-in public aggregates no longer expose ratings/comments. Preserve owner/admin history.

**Files:** layout components/nav, `globals.css`, existing event review components/route, baseline-compatible forward migration.

**Done when:** mobile navigation works at 360 px and keyboard/200% zoom; existing key URLs still resolve; public review access is denied through both app and Data API. Feature flags cannot re-enable broad review RLS.

### P1-04 — Discovery schema, projection, and contracts

**Depends on:** P1-02, P1-03. **Estimate:** 4–5 days.

Add opportunities, university relevance joins, event metadata, saved opportunities, public projection, and typed contracts. Implement deadline precision, eligibility, moderation state, checked/review timestamps, source attribution, and Ady's Pick requirements. Define the database query interface with capped filters/search and stable cursors. Add cross-source duplicate review rules and canonical mapping for merged records.

**Files:** new migrations, `src/lib/supabase/types.ts` regenerated, `src/contracts/discovery.ts`, `src/contracts/opportunities.ts`, `src/server/discovery/*`, `src/types/index.ts` only for application-facing types.

**Done when:** seeded legacy events and new items appear exactly once; rejected/deleted items are inaccessible; filters compose correctly; equal-date/null-date/DST pagination has no duplicates or omissions for a stable dataset; direct-table privilege tests pass; representative query plans are recorded.

### P1-05 — Curation, moderation, and saved items

**Depends on:** P1-04. **Estimate:** 3–4 days.

Build admin quick-add/edit/preview/publish/archive with type-specific fields. Pasting a source URL prefills only what can be safely inferred locally; no arbitrary URL-fetching service is required. Require title/type/source/action-or-explicit-no-action, dates where relevant, audience/eligibility, and an explanation for a Pick. Only Ady/the configured curator principal can assign the named personal endorsement; normal admins can moderate content. Record review and pick changes in audit logs.

Add the unified saved-items read service and idempotent new opportunity saves. Preserve saved legacy events, including closed-item display. Guard publication transitions transactionally and invalidate public caches.

**Files:** new moderation pages, `/api/admin/opportunities`, save endpoints, `src/server/opportunities/*`, shared forms.

**Done when:** a prepared simple listing can be published in under two minutes in an observed usability run; unauthorized users cannot set status/pick fields; retries do not duplicate saves/publication; existing calendar and event saves remain intact.

### P1-06 — Homepage, discovery, details, and founder story

**Depends on:** P1-03, P1-04, P1-05. **Estimate:** 4–6 days.

Compose public server-rendered homepage sections and hydrated filter/save controls. Ship Discover, new opportunity details, and updated event details with consistent provenance, eligibility, date/deadline, and actions. Reuse existing event components where appropriate; do not carry the old social-first section stack into the new homepage. Keep sections content-driven and omit empty editorial sections without fabricating activity.

Implement metadata/canonical URLs, Open Graph cards, sitemap coverage for approved public content, and noindex/private treatment for Talent/recruiting. Redirect `/landing` only at cutover. Update About with owner-supplied factual copy and a restrained founder link. Do not put personal-brand banners in every task flow.

**Done when:** a guest understands the value and reaches an action without signup; returning users save/view legacy and new items; filters survive reload/back navigation; closed jobs cannot accept applications; missing images and data failures render clear states; no private field enters HTML/RSC/public JSON.

### P1-07 — Restore dependable McGill supply

**Depends on:** F0, P1-04, P1-05. **Estimate:** 3–5 days, excluding external access wait.

Trace one real source through producer schedule, transformation, signature, webhook, pending event, moderation, public projection, and image rendering. Inventory current producer ownership/configuration and failure alerts. Reuse the signed webhook; do not build connectors for every platform. Where external image URLs expire, persist allowed image content with bounded size/time/redirect handling and private-network/SSRF protections; never blindly server-fetch any submitted URL.

Keep content-hash replay protection; document source identity and recurring-event behavior. Add a stale/unreviewed queue and last-success/error summary in existing diagnostics. Date/deadline expiry is enforced at read time; a maintenance job updates housekeeping but is not required for correctness. Add bounded retries and a safe replay runbook.

**Done when:** a source run lands a reviewable item, a replay creates no duplicate, a producer failure is visible, stale images have a safe fallback, and source provenance says “Automatically indexed” rather than “Verified.” Do not claim continuous ingestion from a hand-crafted webhook test alone.

### P1-08 — Authored resources

**Depends on:** P1-03, P1-05. **Estimate:** 2–3 days.

Create approved resource index/detail and admin editing using sanitized Markdown with no executable MDX or raw untrusted HTML. Support guide, external resource, and curated downloadable template; admin-owned files only in this release. Require author/source/audience/category/updated date. Track outbound/download actions distinctly. Add a few real resources supplied or authored by Ady; no generated filler attributed to him.

**Done when:** three to five useful resources are accessible on mobile without authentication, unsafe links/markup are rejected, private drafts never enter sitemap or public API, and edits update the displayed review date.

### P1-09 — Public submissions, reporting, and hiring intake

**Depends on:** P1-04, P1-05, P1-08 for resource-target integration. **Estimate:** 3–4 days.

Implement `/submit` for events/jobs/hackathons/programs/resources with bounded text/link input, private contact, honeypot, per-IP/per-identity quotas, and challenge escalation if observed abuse warrants it. Anonymous intake uses one narrow registered elevated insert with server-fixed pending status; no anonymous table insert policy bypasses the form. Return a generic receipt and do not expose moderation/private contact through predictable IDs.

Implement `/for-companies` with company/context, role/duties, must/nice skills, hours, compensation, location/work mode, start date, employment type, and “why this role is worth it.” Intake is a request, not automatic company approval. Moderation converts approved submissions to their canonical target exactly once. Material updates require review; do not overwrite a live record with unapproved text.

Add wrong-date/dead-link/scam/duplicate reporting on listings. Resources can be suggested, but there is no community author account or open editing.

**Done when:** all supported submission types reach one usable queue; retries cannot publish twice; impersonated company names do not confer recruiter access; hostile input cannot set approval/pick flags; report/contact details remain private.

### P1-10 — Weekly Drop and managed delivery

**Depends on:** P1-05, P1-08, P1-09; provider decision in P1-00. **Estimate:** 4–5 days.

Create edition editor, ordered item selection, preview, web publish, and copy/export text. Add newsletter signup/confirmation/unsubscribe, sender setup checklist, provider adapter, verified callbacks, suppression, and durable delivery state. Link existing canonical content rather than maintaining a second opportunity database in email templates. Alert on stale editions and failed sends; nothing sends automatically just because the web edition was published.

**Done when:** one draft yields consistent web/email/LinkedIn output; unsubscribe works without login; confirmed test recipients receive one copy despite retried requests/provider timeouts; suppressed addresses receive none; email failures are visible; a real test send is separately authorized during implementation.

### P1-11 — Private Talent model and enrollment

**Depends on:** P1-02, P1-04. **Estimate:** 3–4 days.

Add Talent profile, versioned consent, skills/roles/availability, and bounded proof-of-work sections. Implement private draft editor, explicit opt-in/out, and separate introduction preference. Normal account creation never copies public profile visibility into Talent consent. Give users clear preview and delete/export controls. Introduce application/resume ownership constraints needed by the next packages.

**Done when:** student A cannot access B's draft or profile through any endpoint/RPC/table; a recruiter cannot browse the Talent table; changing university/skills does not alter permissions; normal profile pages expose no Talent fields.

### P1-12 — Resume upload and confirmed parsing

**Depends on:** P1-11. **Estimate:** 4–6 days.

Run a bounded parser evaluation first: server-runtime compatibility, PDF limits, extraction coverage, memory/time, dependency review. Pin the selected parser. Implement private upload authorization, finalize checks, parse jobs/worker leases/retries, draft suggestions, confirmation, and cleanup. Store original uploads under immutable random version paths; never overwrite a resume referenced by an application.

Manual entry remains usable while parsing is unavailable. No automatic publishing or silent overwriting of edited profile fields on a late worker result. Match results to the asset/profile version that requested them. Cancellation/opt-out prevents late results resurrecting deleted data.

**Done when:** text-based PDF fixtures produce editable structured suggestions; malformed/encrypted/image-only/oversize PDFs fail safely with manual fallback; repeated job delivery does not duplicate or overwrite confirmed data; private download and worker credentials cannot leak into logs; cleanup removes orphan objects as well as rows.

### P1-13 — Approved roles and recruiter access

**Depends on:** P1-09, P1-11, P1-10 delivery adapter. **Estimate:** 3–4 days.

Convert approved company requests to public opportunities plus private recruiting-role details. Admin issues/revokes per-role recruiter invitations. Implement verified-email acceptance, role membership, native/external application modes, question validation, publication/closure, and audit history. Companies can submit roles; admin approval remains the only route to live publication in Phase 1.

**Done when:** an approved company can reach its role workspace after verified login; forwarded/expired/replayed invites fail; same-company unassigned accounts have no implied access; revoked recruiters lose access immediately; New/Approved/Live/Applicants/Closed is intelligible without becoming an ATS.

### P1-14 — Apply with UNIVERSE

**Depends on:** P1-11, P1-12, P1-13. **Estimate:** 3–4 days.

Build application preview with exact confirmed profile/resume, up to three short questions, and explicit sharing consent. Use a database transaction for role-open/deadline checks, profile ownership/consent, snapshot creation, and unique application insertion. Lock/recheck the role so a concurrent close cannot accept a late submission. Require a confirmed profile; resume is recommended but manual-profile applicants are supported unless an approved role explicitly requires a resume.

Return the existing application receipt on an identical retry; reject incompatible duplicate submissions. Implement withdrawal and opt-out effects. Profile edits affect future applications only; reapplication to the same role is outside the first pilot unless an explicit replacement flow is added and tested.

**Done when:** double-clicks/timeouts create one application; closed/expired/external-mode roles reject native submissions; forged user/resume/role IDs fail; snapshots match what the student confirmed; withdrawal removes recruiter access at once.

### P1-15 — Recruiter applicant review and handoff

**Depends on:** P1-13, P1-14. **Estimate:** 3–4 days.

Build a private applicant list/detail view with pagination, university/program/graduation/skills/availability/hackathon filters. Sort by newest or explicit factual attributes; no composite candidate score. Show submitted evidence, resume download, and safe external portfolio/GitHub/LinkedIn links. Reveal only consented contact details; direct email/LinkedIn outreach happens outside UNIVERSE. Add modest application notifications with links, not attachments.

Use RLS role/application checks plus route guards, and a separate authorization check for every file download. No bulk resume export or global student search. Access/usage logging records identifiers needed for audit, never resume content or freeform applicant answers.

**Done when:** role-A recruiters cannot enumerate/read role-B applicants, including by direct UUID/storage paths; withdrawn/expired applications and revoked memberships are denied; shared caches never serve applicant data; filters remain responsive on seeded volume.

### P1-16 — Private event feedback

**Depends on:** P1-03, P1-04. **Estimate:** 2–3 days.

Introduce one short versioned questionnaire: attendance declaration, would recommend, value, organization/content, beginner fit where relevant, and optional private comment. Use event end, not start, for eligibility. A prior internal RSVP/save can support eligibility but is not called proof of attendance. External-RSVP attendees can submit a self-reported response after the event; record signal strength rather than claiming verification.

One response per user/event, editable by its owner within a proposed 30-day window. Keep raw answers owner/admin-only. Optional organizer output is a private aggregate with a minimum of ten responses, no individual comments or identities, and no filter combinations that expose small groups. No public star rating, series comparison, or new attendance-verification system.

**Done when:** early/duplicate/cross-user writes fail; respondents can review their own feedback; direct public database/API reads are denied; organizer access is club-scoped and thresholded; old review data has not been falsely converted into the new questionnaire.

### P1-17 — Product metrics and operational dashboards

**Depends on:** P1-04; instrument alongside 05–16, finish after them. **Estimate:** 2–3 days incremental.

Define typed events: discovery view, detail view, save, outbound action, resource view/download, newsletter requested/confirmed, submission accepted, Talent opted-in/out, application submitted/withdrawn, recruiter list/detail viewed. Derive durable conversions from successful server writes; client clicks are intent only. Capture allowlisted campaign source such as LinkedIn without logging entire query strings.

Create a compact admin summary: weekly active/returning authenticated users, clearly labeled anonymous-session estimates, saves/outbound actions by type, confirmed subscribers, stale/expired supply, moderation backlog age, Talent enrollment/applications, active recruiter roles, ingestion/parse/email failures. Do not call outbound clicks completed applications or infer placements without reported outcomes.

**Done when:** failures/retries do not inflate confirmed conversions; no resume/contact/free-text/secret token reaches analytics or Sentry; Ady can review value and maintenance burden in one screen. Reuse existing analytics infrastructure where it fits instead of installing multiple overlapping SDKs.

### P1-18 — Certification, content readiness, rollout, and runbooks

**Depends on:** all packages in the release being shipped; Foundation certification predecessor. **Estimate:** 4–6 days across both releases.

Run the acceptance matrix below, meaningful regression suite, database reset/type-drift checks, staging load checks, real preview cache isolation, and deployment/rollback rehearsal. Verify behavior on mobile and keyboard/assistive technology. Prepare actual launch inventory and one Weekly Drop. Record every intentional legacy behavior change and update docs/current project guidance, without rewriting historical test results.

Use preview → small invited discovery cohort → P1-A → small student/company recruiting pilot → P1-B. Migrations are additive first; privacy/grant changes are tested against both old and new app versions. Archive old frontend entry points only after compatibility verification. Expand the recruiting cohort only after withdrawal, access revocation, parsing fallback, and direct employer handoff have been exercised.

**Done when:** evidence supports all applicable release gates; CI is observed on the actual candidate commit; owner setup/access dependencies are resolved; runbooks name an operator and safe recovery path; no unfulfilled flow is advertised as live.

## 10. Sequence, estimates, and staffing assumptions

| Milestone | Packages | Outcome | Engineering days |
|---|---|---|---|
| M0 — Foundation prerequisite | F0 | Existing foundation certified; baseline recorded | Separate |
| M1 — Open the platform | P1-00–03 | Multi-campus accounts, editorial shell, review privacy | 7–11 |
| M2 — Opportunity core | P1-04–05 | Shared discovery model, curation, saves | 7–9 |
| M3 — Useful discovery | P1-06–09 | Homepage/feed, real supply, resources, submissions | 12–18 |
| M4 — Discovery launch | P1-10 + P1-17 discovery slice + P1-18 first gate | **Weekly Drop and P1-A release** | 7–9 |
| M5 — Talent profiles | P1-11–12 | Private profiles, resumes, confirmed parsing | 7–10 |
| M6 — Recruiting workflow | P1-13–15 | Roles, applications, private recruiter review | 9–12 |
| M7 — Feedback and metrics | P1-16 + P1-17 completion | Private feedback and product/operations dashboard | 3–5 |
| M8 — Recruiting pilot release | P1-18 final gate | **P1-B pilot; Phase 1 close** | 2–3 |

The [milestone roadmap](2026-09-27-universe-phase-1-milestones.md) defines each milestone's deliverables, dependencies, demonstration, and exit gate. It allocates P1-17 and P1-18 across the two releases without double-counting their effort. Packages are logically separable where their dependencies permit; this plan does not assume parallel agents or extra engineers. If one developer implements sequentially, estimates total **54–77 focused engineering days**, excluding F0, owner content work, provider procurement/access, and production migration repair. At five focused days per week this is roughly **11–16 weeks**, with contingency beyond that for integration issues. Part-time work extends elapsed time. P1-A is approximately **33–47 engineering days** including its allocated share of metrics/verification. Real pilot observation and participant response time add elapsed time beyond engineering effort.

These are planning ranges, not a delivery promise. Re-estimate after P1-04's query/schema prototype and P1-12's parser evaluation. Release P1-A first to deliver value sooner while P1-B remains required for Phase 1 completion. Any subsequent scope reduction is a new product decision; do not remove privacy checks or describe a hiring form as a completed recruiting platform.

## 11. Verification strategy and release gates

### Required test layers

| Layer | Required evidence |
|---|---|
| Contract/unit | Discriminated discovery shapes; date precision/DST; URL/length bounds; cursor filter binding; lifecycle transitions; consent state; parse draft merge; provider webhook verification |
| Route integration | Auth before sensitive reads, admin/recruiter page gates, observable DB errors, cache headers, idempotency, revoked/withdrawn access, provider failure paths |
| Database/Storage | Per-table allow/deny under anon/student A/student B/admin/recruiter A/recruiter B/revoked/banned identities; column privilege escalation; view/RPC bypass; private object access; transactional races |
| Browser | Guest discovery → signup → save; non-McGill onboarding; submission → moderation → publish; subscribe/confirm/unsubscribe; role request → approval → apply → employer review → withdrawal; parse failure/manual fallback |
| Operational | Duplicate signed ingestion; producer outage; worker termination/retry; storage/DB/email-provider failure; direct CDN isolation; backup/restore and rollback compatibility |

Extend existing seed infrastructure with deterministic events, cross-campus listings, expired/deadline-only/evergreen content, several schools, two recruiters with distinct roles, applications, revoked memberships, and private documents containing synthetic data only. Keep local/staging URL allowlist protection. Do not load synthetic applicants or resumes into production.

Suggested staging scale fixture: 10,000 mixed discovery records, 5,000 accounts, 100 roles, 2,000 applications, and skewed saves/views. Use test files/blobs without real personal data. Measure query plans and page load on this fixture before adding new infrastructure.

### P1-A release gate

- [ ] Foundation predecessor and deployed configuration prerequisites are evidenced.
- [ ] All-campus verified signup works; existing accounts/roles/saves remain intact.
- [ ] Discover includes at least events, hackathons, jobs, and programs with correct eligibility and source labels.
- [ ] Filters, pagination, dates, saves, expired states, public metadata, and outbound actions work on mobile.
- [ ] Legacy event URLs, calendar exports, and required organizer editing still work.
- [ ] Public review reads and ratings are retired at database, API, and UI levels.
- [ ] Submission/report/moderation workflows function without unreviewed public publishing.
- [ ] Three to five genuine resources and one prepared Weekly Drop exist; signup, confirmation, suppression, unsubscribe, and preview delivery are verified.
- [ ] Supply is credible: proposed minimum 20 checked live items spanning the four required types, including explicitly cross-campus items. Missing content is an owner-content blocker, not filled with fake listings.
- [ ] The real McGill producer is exercised and observable; manual curation remains available during outages.
- [ ] Homepage promises match the enabled release; Talent/native apply is not advertised as available yet.

### P1-B release gate

- [ ] Talent opt-in, profile editing, resume upload/parsing/confirmation, manual fallback, and opt-out work end to end.
- [ ] Students can submit once, see a receipt, and withdraw; a concurrent role close cannot accept a late application.
- [ ] Assigned recruiters see only their own active applicants and authorized resume downloads; all direct-access negative tests pass.
- [ ] Revoked invite/membership, forwarded link, guessed ID, expired retention, withdrawal, and banned-account cases are denied.
- [ ] Published role questions cannot silently mutate already submitted answers; application snapshots retain question text/version.
- [ ] Private feedback works and no public stars/individual organizer disclosures appear.
- [ ] A proposed pilot of 5–10 consenting students and 2–3 real hiring contacts completes application/review/handoff without Ady forwarding resumes manually.
- [ ] Retention/deletion jobs remove content and stored objects, preserve only necessary minimal audit receipts, and recover from failed attempts.
- [ ] No unaccepted critical/high defect affects any shipped flow; CI and live verification are recorded against the release commit.

### Quality targets (proposed, measure before claiming)

For the staging fixture, target p95 discovery/applicant API latency below 750 ms at 20 concurrent readers and error rate below 1% during a 10-minute representative run. Exclude deliberate rejection cases from server-error rates and report cache-warm/cold results separately. Target LCP ≤2.5 s, INP ≤200 ms, and CLS ≤0.1 at the 75th percentile when field volume permits; use repeatable mobile lab measurements before that.

For the PDF fixture set, measure precision/coverage by field rather than a vague “AI accuracy” score. Proposed minimum: 90% precision for populated structured suggestions on supported text PDFs, all fixtures bounded in time/memory, and 100% availability of manual correction/fallback. Low-confidence extraction stays blank; no invented education, skills, or awards.

Curation usability: prepared listing under two minutes; one edition and exports within a 45–60 minute weekly session. Operational target: at most two hours of recurring weekly curation/moderation/oversight during the pilot, measured over two editions. If work exceeds this, simplify low-value flows before increasing coverage.

## 12. Deployment, recovery, and maintenance

1. Implement on a feature branch. `main` auto-deploys; a push/merge is a release action, not a harmless sync.
2. Reconcile deployed migration history through the foundation's DI-23 process before any new production migration. Do not edit old applied migration files.
3. Generate forward migrations with the installed CLI's discovered commands. Replay locally, regenerate types, run RLS/Storage tests, inspect advisor findings, and measure backfill behavior in staging. Check current Supabase release changes against the actual database version/extensions before assuming local/production parity.
4. Back up and rehearse restoration. Prefer additive structures and batched/idempotent backfills; explicit checkpoints record row counts and errors. Keep event data authoritative and avoid a bulk event-copy cutover.
5. Deploy migrations and compatible code with release switches disabled. Configure OTP, private buckets, worker credentials, provider callbacks, distributed rate limits, and alerting. Verify from a real preview before enabling public UI.
6. Release P1-A and observe supply/errors/conversions. Launch P1-B to the small recruiting cohort only after its own gates pass. Owner approval applies to the concrete release candidate and external sends at execution time, not a new permission request for every local task.
7. Roll back frontend/application code to a **relaunch-compatible** build. Do not roll back to a callback that deletes non-McGill users or a schema policy exposing reviews. Disable native applications/parsing/recruiter entry independently if needed; preserve student withdrawal and privacy controls during incidents.
8. Resume worker/email jobs from durable state. Use idempotent retry and reconciliation; do not manually resend every message or reparse every file because one attempt timed out.

Minimum runbooks: ingestion stale/failed, duplicate/wrong listing, malicious submission, email suppression/send failure, resume parse failure, recruiter invitation/revocation, accidental private-data access, application withdrawal/deletion, worker backlog, deployment rollback, and schema/Storage restore. Each names the operator, dashboard/query, recovery action, and evidence to retain without logging private content.

## 13. Decisions and external inputs

| Decision/input | Proposed default | Needed by |
|---|---|---|
| Expanded §47 versus smaller §34 | **Confirmed by owner, September 27, 2026:** expanded §47, staged P1-A/P1-B | Resolved |
| General account eligibility | Any verified email; self-declared school; no new institution-verification system | P1-02 |
| Recruiter authentication | Verified email OTP + per-role access, not a public bearer URL | P1-13 |
| Email provider/domain | Managed provider selected based on available owner account, sender verification, suppression, idempotency, and callback support; no vendor purchased by this plan | P1-00 / P1-10 |
| Resume formats/processing | PDF ≤5 MB/10 pages, conservative local parsing, no external AI service, manual fallback | P1-12 |
| Retention and opt-out copy | 90 days after role closure; 7-day unsubmitted parse artifacts; opt-out withdraws active shares after warning | Before real Talent pilot |
| Ady's Pick authority | Configured curator identity; reason required; no paid placement | P1-05 |
| Founder copy/resources | Owner supplies accurate bio, links, attribution, and 3–5 real resources | P1-06 / P1-08 |
| Scraper access/schedule | Retain current producer after verifying ownership and real execution; do not assume absent `AI/` code exists | P1-07 |
| Initial companies/students | 2–3 hiring contacts and 5–10 consenting students for the private pilot | P1-B gate |
| Operational owner | Ady initially; documented backup for urgent private-data/access incidents | P1-18 |

The expanded implementation scope is confirmed. Remaining design defaults and external inputs above retain their stated status; scope confirmation does not imply provider selection or authorization to deploy/send messages. Credential-dependent setup blocks its integration's release gate; it does not prevent design, contracts, local fixtures, or documentation work.

## 14. Phase completion and handoff

Phase 1 closes when both P1-A and P1-B meet their gates and a final report links the exact commits, migrations, CI runs, test results, live checks, intentional behavior changes, operating costs observed in the pilot, and accepted residual limitations. A working homepage or hiring inquiry form alone is not phase completion.

Keep one product backlog with P1-R IDs above and package references; do not maintain independent unchecked lists in the old master plan and new strategy. Archive/supersede the old product plan only when this direction is adopted, preserving the foundation evidence. Record actual weekly maintenance burden and early retention/conversion results before proposing Phase 2 features.

## References

- [Owner-supplied new direction](/Users/adyan/Downloads/UNIVERSE_New_Product_Direction.md): product intent and scope; §34/§47 conflict resolved by the owner's expanded-scope selection above.
- [Foundation roadmap](../../.planning/ROADMAP.md), [project requirements](../../.planning/REQUIREMENTS.md), [Phase 6 review](../../.planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/06-REVIEW.md), [verification](../../.planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/06-VERIFICATION.md), and [completion/deploy prerequisites](../../.planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/PHASE-6-COMPLETION.md).
- [Supabase passwordless email authentication](https://supabase.com/docs/guides/auth/auth-email-passwordless): mechanism for verified email entry; per-role recruiter authorization remains application/database logic.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) and [Storage access control](https://supabase.com/docs/guides/storage/security/access-control): current access-control references checked while planning.
- [PDF.js examples](https://mozilla.github.io/pdf.js/examples/): candidate PDF tooling for the bounded evaluation, not evidence that resume field extraction is already implemented.
- [Supabase September 25 database release changes](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) and [extension version behavior](https://supabase.com/changelog/extension-version-pinning-ignored): verify applicability during the implementation environment check; no production upgrade was performed here.
