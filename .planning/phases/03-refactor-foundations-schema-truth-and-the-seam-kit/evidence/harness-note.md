# Harness note — what the persona harness proves, and the four things it does not

**Plan:** 03-07 · **Phase:** 03-refactor-foundations-schema-truth-and-the-seam-kit · **Recorded:** 2026-09-16

The point of this file is the second half. A safety net that is over-read is worse than a smaller
one that is read correctly, and the failure mode a later phase is most likely to hit is somebody
assuming this harness covers a workflow it never touches. So: the coverage first, briefly, then the
limits, at length.

---

## 1. What runs

```
supabase db reset --local && npx tsx scripts/seed/load.ts && supabase test db --local && npx playwright test
```

`10 setup projects + 7 spec files, 27 tests, 27 passed` from a clean database — raw output in
`evidence/playwright-run.txt`. The same four commands, in the same order, are the `e2e` job in
`.github/workflows/ci.yml`.

Ten personas each hold a storage state produced by `@supabase/ssr`'s own cookie serializer and
verified **through the running application** — each persona is asserted to land where the app's own
ring should put it, which an anonymous caller would not. No cookie is hand-built, no application
file is changed, and no test-only sign-in route exists.

---

## 2. The six happy-path specs against the Validated workflows they re-confirm

The workflow text is **quoted** from `.planning/PROJECT.md § Validated`, not paraphrased.

| # | Spec | Persona | Validated workflow it re-confirms |
|---|---|---|---|
| 1 | `banned-redirect.spec.ts` | `banned_permanent`, `suspended_active`, `suspension_expired` | "Admins approve/reject events and clubs, **ban/suspend users**, review reports and appeals, with actions written to `admin_audit_log`" — the enforcement half of it |
| 2 | `protected-route-redirect.spec.ts` | anonymous, `onboarded_student` | "User can sign in with Google OAuth; non-McGill emails are rejected in the auth callback" — the ring that makes a signed-in session mean something. Also "middleware guards unfinished onboarding", whose sibling branch is exercised by the `mid_onboarding_student` setup |
| 3 | `anonymous-browse.spec.ts` | anonymous | "Anonymous visitors can browse public event and club content without an account" and "User can browse, search, and filter events by tag, date, and time of day" |
| 4 | `save-and-rsvp.spec.ts` | `onboarded_student` | "User can save/unsave events and RSVP (going/interested/cancelled)" |
| 5 | `club-owner-surfaces.spec.ts` | `club_owner`, `cross_club_attacker` | "Club organizers create and edit clubs, post events, invite members by McGill email, manage member roles, and switch between multiple clubs" — **read surfaces only**, see § 4 |
| 6 | `admin-moderation-queue.spec.ts` | `admin`, `onboarded_student` | "Events posted by organizers for their own clubs are auto-approved; other events and clubs go through pending → approved/rejected moderation" — **the queue only**, see § 4 |
| + | `admin-login-cookie-equivalence.spec.ts` | `admin` | Not a workflow re-confirmation. It is the cross-check that turns "the cookie shim is equivalent to what the app does" from an assumption into an assertion |

### Two of these close things that were previously open

**Spec 1 closes a named Phase 2 residual.** `02-SECURITY.md § Residuals` records the ban-check row
as un-assertable, because no seeded banned session existed to assert with. That is exactly what this
plan's seed supplies. Three cases now run: a permanent ban is diverted, an unexpired suspension is
diverted, and — the one worth having — a user whose `banned_at` is set but whose expiry has passed
**reaches the protected path**. An implementation that checked only `banned_at` would pass the first
two and fail the third.

**Spec 2 closes the review's gap at this tier.** `02-REVIEW.md` finding WR-04: Phase 2's
`proxy.test.ts` asserts only `config.matcher`, so "deleting the redirect block at
`proxy.ts:115-121` entirely leaves this suite green." No unit test covers the redirect. Spec 2
covers it against the running application, over **every** path in `PROTECTED_ROUTES` — re-derived
from `src/proxy.ts` at load time by `e2e/fixtures.ts`, never transcribed, because the project
instructions name that file as the only authority and warn against trusting a copy.

---

## 3. REFAC-07's staging clause is a PARTIAL, and this is the reason

**REFAC-07 reads:** "A minimal deterministic functional seed exists (fixed UUIDs, fixed timestamps
relative to a pinned now, fixed PRNG seed) covering every user role, ban state, club status, and
event status, **loadable into local and staging only** with a hard guard refusing any other Supabase
URL."

**Everything except the word "staging" is met and evidenced.** Determinism, idempotence and coverage
are proven in `evidence/seed-determinism.txt` (two loads byte-identical, `sha256 964ac785…`, and the
same hash re-derived a third time after a reset) and asserted at the database tier by
`supabase/tests/database/040-seed-coverage.test.sql` — 21 assertions covering all three
`user_role` values, the complete four-row ban truth table, both onboarding states, all three club
statuses and all four event statuses the check constraint permits. The guard's refusals are watched
refusing in `evidence/seed-guard-refusals.txt`: five at the command line, each exiting 1, plus five
unit cases of which four are refusals.

**The staging clause is discharged as a partial because there is no staging project to load into.**
The Phase 1 environment capture says so plainly, and the staging migration-list artifact is a
deferred stub whose own note observes that an absent staging environment is itself an audit finding.

What exists instead: `scripts/seed/guard.ts` **implements** the staging branch, guards it behind two
independent signals (`SEED_STAGING_PROJECT_REF` naming the ref, and `SEED_I_UNDERSTAND_TARGET=staging`
acknowledging it), and **unit-tests its refusals** — a named staging ref without the acknowledgement
throws, and so does a staging target the guard cannot check against production, even with both
signals set. Enabling it, the day a staging project exists, is a one-line change: export those two
variables with the real ref. Nothing in the code needs editing.

**What was deliberately NOT done:** the guard was not widened to make an untestable path look tested.
Plan 03-08 carries REFAC-07 into the completion note as a **partial**, not a pass.

---

## 4. What this harness does NOT do

### 4a. No persona ever traverses `/auth/callback`

Personas are authenticated by cookie injection. They therefore **never** execute the auth callback
route — and McGill email enforcement, the non-McGill deletion path, and admin auto-assignment all
live in that route and nowhere else.

Those behaviours are covered by **plan 03-02's unit characterization** of `src/app/auth/callback/route.ts`
and by nothing in `e2e/`. A change that broke McGill enforcement would leave all 27 tests here green.

Two of the audit's thirteen personas are unseeded for the same reason and say so in
`scripts/seed/personas.ts`: `non_mcgill_signin` is an auth-flow case, not a data case, and
`machine_no_credential` is the absence of a bearer secret — there is no row that represents no row.

### 4b. The five signed-in manual steps stay human

`02-UAT.md` carries five Tier 3 steps that require a signed-in session, and
`evidence/STAGE-2-COMPLETION.md § 13` row STAB-06 records them as manual. **They remain manual.**
They need a real McGill Google account, which no automation in this repository can supply and which
this harness deliberately does not attempt to fake — the whole point of the cookie shim is that it
signs in *seeded local personas*, not real people through a real identity provider.

### 4c. The harness does not exercise the Content-Security-Policy

`next.config.js` sets an unconditional `connect-src 'self' https://*.supabase.co …`, which does not
admit the local stack at `http://127.0.0.1:54321`. Every client-side Supabase call is therefore
refused by the browser before it leaves, surfacing in the UI as a bare "Failed to fetch". The header
is correct for production; what it lacks is a development branch.

`playwright.config.ts` sets `bypassCSP: true`, and the cost is stated rather than hidden: **nothing
in `e2e/` would notice if that header were weakened or removed.** Fixing the policy is a change to
application source, which this plan prohibits by name. Registered as **deferred item D-21**, which
also records the wider consequence — every developer running against a local stack has a broken
client-side sign-in today, with "Failed to fetch" as the only symptom.

### 4d. Two workflows are re-confirmed only in their read half

Specs 5 and 6 assert **read** surfaces. Spec 5 does not create a club, post an event, invite a
member or change a member role; spec 6 approves and rejects nothing. That is deliberate: both of the
workflows they touch are recorded in PROJECT.md as *contradicted by Phase 1 evidence* (F-016 for the
organizer workflow, F-007 for the admin one), and writing an assertion over a contradicted behaviour
would bake the contradiction in. The moderation write path also runs into F-072/F-073 —
`admin_audit_log.admin_email` does not exist in the schema — which plan 03-06 left open for Phase 5.

---

## 5. Two smaller things a later reader should not have to rediscover

**The dev server does not work for this.** Under `next dev`, the pages never finish hydrating in
Playwright's Chromium: the Turbopack HMR websocket handshake fails with `ERR_INVALID_HTTP_RESPONSE`,
`AuthProvider`'s effect never runs, and the auth store never sees the injected session — while the
**proxy sees it perfectly**, so the symptom reads like a cookie bug for as long as you let it. The
harness runs `npm run build && npm run start`, which the plan sanctions and which is also the
artifact that deploys.

**A pinned `now` is not enough on its own.** `/api/events` filters `start_date >= now()` and
`src/proxy.ts` compares `ban_expires_at` to `new Date()` — both against the **wall** clock. With
every offset taken from `PINNED_NOW` (2026-06-01), the "active suspension" had silently expired in
real time and every "upcoming" event had become a past one. Nothing errored; the seed just started
meaning something else. `scripts/seed/clock.ts` now carries two pinned clocks — `PINNED_NOW` for
stored metadata, and `HORIZON_FUTURE` / `HORIZON_PAST` (±10 years) for rows whose meaning is
wall-clock-relative. Determinism is unaffected, every instant is still a literal, and if the horizon
is ever crossed the suspension spec goes red rather than the seed going quiet.

---

## 6. Where the evidence is

| Claim | File |
|---|---|
| The harness runs green from a clean database | `evidence/playwright-run.txt` |
| Two loads produce byte-identical data; the coverage test asserts and skips honestly | `evidence/seed-determinism.txt` |
| The guard refuses production, an arbitrary project, unacknowledged staging, a non-Supabase port, and a non-URL — and fails closed | `evidence/seed-guard-refusals.txt` |
| One package name entered the tree, exactly pinned, behind a reviewed diff | `evidence/lock.03-07.diff-review.md`, `evidence/playwright-install.txt` |
| The CSP and the moderation deep-link findings | `deferred-items.md` D-21, D-22 |
