# Uni-Verse — Foundation Program

## What This Is

Uni-Verse is a campus event discovery platform for McGill University. Students browse, filter, save, and RSVP to campus events; club organizers manage club pages, post events, invite members, and see analytics; admins moderate content and users. The product already exists and has shipped two milestones. This project is not a feature milestone. It is a four-stage foundation program that audits, stabilizes, refactors, and certifies the existing codebase so that the next product work (the ingestion platform and new features) is built on a base that is known to be correct, secure, and tested.

## Core Value

Every critical workflow in the existing app is verified correct, secure, and reproducible across all user roles before any new product feature is started. If a foundation change breaks a workflow that worked before, the program has failed.

## Requirements

### Validated

Inferred from the existing codebase (see `.planning/codebase/`). These are working today and must keep working through every stage.

- ✓ User can sign in with Google OAuth; non-McGill emails are rejected in the auth callback — existing
- ✓ Anonymous visitors can browse public event and club content without an account — existing
- ✓ User selects interest tags during onboarding; middleware guards unfinished onboarding — existing
- ✓ User can browse, search, and filter events by tag, date, and time of day — existing
- ✓ User can save/unsave events and RSVP (going/interested/cancelled) — existing
- ✓ User sees personalized recommendations from the Postgres-native scoring engine (`compute_user_scores`, pg_cron every 6h), with popularity fallback for new users — existing
- ✓ Club organizers create and edit clubs, post events, invite members by McGill email, manage member roles, and switch between multiple clubs — existing
- ✓ Events posted by organizers for their own clubs are auto-approved; other events and clubs go through pending → approved/rejected moderation — existing
- ✓ Students follow/unfollow clubs; public club pages show logo, description, follower count, upcoming and past events — existing
- ✓ Organizers see event-level analytics (RSVPs, saves, clicks) and club-level trends — existing
- ✓ Attendees review past events; organizers see aggregate feedback — existing
- ✓ Admins approve/reject events and clubs, ban/suspend users, review reports and appeals, with actions written to `admin_audit_log` — existing
- ✓ In-app notifications and email reminders — existing
- ✓ Instagram scraper pipeline (Apify) classifies posts and ingests events with content-hash dedup — existing
- ✓ A/B experiment framework for recommendation variants — existing
- ✓ Interaction tracking feeds popularity and interaction signals — existing

### Active

Organized by the four stages. Each stage has an exit gate; a stage does not start until the prior gate is met.

**Stage 1 — Read-only foundation audit**

- [ ] Inventory and assess production schema versus migrations versus generated Supabase types
- [ ] Inventory and classify all 92 API handlers and 43 pages (auth requirement, role, caching, personalization, dead/duplicate)
- [ ] Assess authentication, middleware, roles, permissions, and RLS policies
- [ ] Assess every service-role client usage for RLS bypass risk
- [ ] Assess route caching against personalized-data exposure (the blanket `s-maxage=60` on `/api/*` is a known suspect)
- [ ] Inventory cron jobs (pg_cron, any Vercel crons) and external webhooks
- [ ] Assess dependency reachability and outdated packages
- [ ] Record the current state of tests, build, lint, and type-check, including which test files run under which runner
- [ ] Assess error handling, logging, observability, and performance hotspots
- [ ] Identify dead routes, duplicate components, and stale documentation
- [ ] Deliver `FOUNDATION_AUDIT.md` where every finding has severity, evidence, affected paths, reproduction, recommended fix, and validation criteria
- [ ] Audit recommends the single test runner to keep (Jest or Vitest)

**Stage 2 — Dependency and runtime stabilization**

- [ ] Pin supported Node and npm versions (`engines`, `.nvmrc`)
- [ ] Resolve the unknown npm `devdir` configuration warning
- [ ] Remove the Vercel CLI from production dependencies (decide whether it stays as a dev dependency at all)
- [ ] Upgrade Next.js to a patched, compatible version
- [ ] Apply safe patch/minor upgrades in small batches, running lint, type-check, tests, build, and smoke after each batch
- [ ] Upgrade or isolate Swagger UI and Redoc dependencies
- [ ] Consolidate on the one test runner chosen in Stage 1; remove the other config and mismatched packages
- [ ] Perform major upgrades separately, each with migration testing
- [ ] Recreate a clean installation from the lockfile and confirm it is reproducible
- [ ] Exit gate: no unexplained critical production vulnerabilities; no reachable high-severity production vulnerabilities without a documented exception; reproducible clean install; green build, lint, type-check, and tests; stable reviewed lockfile

**Stage 3 — Targeted foundation refactor (bottom-up, tested vertical slices)**

- [ ] Database schema, migrations, indexes, and RLS reconciled with production
- [ ] Supabase types generated from the schema instead of hand-written
- [ ] Authentication and authorization corrected (e.g. `getUser()` instead of `getSession()` for auth checks, admin endpoints that fall open)
- [ ] Shared service/data-access boundaries established so API routes stop duplicating Supabase logic
- [ ] Input validation and API contracts defined for every handler
- [ ] API endpoint correctness fixed per audit findings
- [ ] Routing and middleware corrected (rate limiting, protected routes, onboarding guard)
- [ ] Page-level logic and state cleaned up (dual event date schema, tag mapping, `any` casts)
- [ ] Performance and caching fixed (no personalized data under shared cache, no load-all-rows-then-filter patterns)
- [ ] Structured logging, Sentry, and an operational health check added
- [ ] Every slice: capture current expected behavior with a test first, refactor, verify the same workflow passes

**Stage 4 — Test-data certification**

- [ ] Deterministic functional dataset covering every role, status, permission, and edge case
- [ ] Adversarial dataset: malformed inputs, unsafe links, duplicate records, timezone/DST cases, expired content, cross-tenant access attempts, upload abuse
- [ ] Scale dataset: thousands of users, clubs, events, saves, RSVPs, notifications, and interactions
- [ ] Datasets load into local Supabase and the existing staging Supabase project; never into production
- [ ] Every major workflow tested as: anonymous public visitor, verified McGill student, organizer/member/owner, moderator/admin, banned or suspended user, user attempting cross-club access, and non-McGill sign-in attempt (must be rejected)
- [ ] Critical workflows covered by integration/E2E tests
- [ ] RLS allow/deny tests passing for every table
- [ ] Every endpoint classified and reviewed; every user-facing page smoke-tested
- [ ] No unresolved critical or high logic defects
- [ ] Acceptable performance under representative load (existing k6 scripts as the starting point)
- [ ] Production deployment, rollback, backup, and monitoring validated

### Out of Scope

- Ingestion platform (beyond keeping the existing Instagram scraper working) — starts as the next milestone only after Stage 4 certification
- New product features of any kind — same reason; the point of this program is a stable base first
- Non-McGill public accounts with limited access — a future product decision, not part of the refactor; during this program non-McGill authentication is rejected and tested as a rejection case
- One massive rewrite — all refactoring happens through tested vertical slices
- Synthetic data in production — datasets go to local and staging only
- User-to-user social features and monetization — carried over exclusions from prior milestones

## Context

- **Codebase state:** Next.js 16 App Router monolith, React 18, TypeScript strict, Supabase (Postgres, Auth, Storage, Edge Functions), Zustand, SWR, Tailwind + shadcn/ui, deployed on Vercel (`iad1`). Full map in `.planning/codebase/` (dated 2026-03-05; six months old, so the audit re-verifies rather than trusts it).
- **Prior milestones:** v1 (discovery + recommendations) and v2.0 "Club Organizer UX Overhaul" shipped as of 2026-03-06. Planning artifacts for those were reset on 2026-09-13 to start this program fresh; they remain in git history.
- **Known concerns already recorded in the codebase map** (to be re-verified and formalized by the audit): hand-written Supabase types; `getSession()` used for auth checks; admin analytics endpoint without authorization; admin calculate-popularity endpoint falls open without `ADMIN_API_KEY`; no CSRF protection on state-changing routes; in-memory-only rate limiting that excludes admin endpoints; RSVP counts computed by loading all rows; `select('*')` on events then fabricating club objects; dual event date schema; 179 unstructured console calls across 62 files; zero tests on the auth callback and recommendation routes.
- **Toolchain facts observed 2026-09-13:** Node 24.16 / npm 11.13 locally with no `engines` pin; both `jest.config.js` and `vitest.config.ts` present; `jest@^30` with `ts-jest@^29`; `vercel@^32` in production dependencies; `swagger-ui-react` and `redoc` in dependencies; no Sentry; no `test` script in `package.json`; `vercel.json` sets `s-maxage=60, stale-while-revalidate=300` on all `/api/*`.
- **Migrations:** 44 files under `supabase/migrations/` using three naming schemes (`001_`, `008b_`, `020_`, and timestamped), including two `remote_schema` dumps, so drift between the folder and production is expected.
- **Environments:** local Supabase configured (`supabase/config.toml`); a staging Supabase project already exists and credentials will be supplied via env when Stage 4 needs them; production on Supabase + Vercel.
- **Ban/suspension** already exists (`lib/ban.ts`, `/banned` page, moderation modals, middleware checks), so that persona is testable without new features.

## Constraints

- **Ordering**: Stages run 1 → 2 → 3 → 4 and each gate must pass before the next stage starts — the audit is read-only and precedes any dependency change or refactor
- **Behavior preservation**: Every Validated requirement above must still work after each stage — that is the core value
- **No production data injection**: Synthetic datasets go to local and staging only
- **Tech stack**: Stay on Next.js App Router, Supabase, Vercel — the program stabilizes the stack, it does not replace it
- **Security**: Never modify `.env.local`; McGill email enforcement stays in place
- **Refactor style**: Tested vertical slices, bottom-up (schema → types → auth → services → validation → endpoints → routing → pages → performance → observability)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Reset prior planning artifacts, keep the codebase map | v2.0 shipped; this program is a different kind of work and needs a clean roadmap, but the map is still useful as a starting inventory | — Pending |
| Foundation program only; ingestion and features are the next milestone | New work on an unverified base compounds defects; certification first | — Pending |
| "Public account" persona renamed to "Anonymous public visitor"; non-McGill sign-in is a rejection test case | Every account is a McGill account today; non-McGill tiers are a product decision, not a refactor | — Pending |
| Stage 1 audit chooses the single test runner | Neither Jest nor Vitest has been inventoried for which tests actually run; decide on evidence | — Pending |
| Use the existing staging Supabase project for certification datasets | Already provisioned; avoids standing up a new environment | — Pending |
| Stage 1 is strictly read-only | Findings must be captured with evidence before anything changes, so fixes can be validated against a baseline | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-13 after initialization*
