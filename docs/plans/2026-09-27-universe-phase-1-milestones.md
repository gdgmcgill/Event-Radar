# UNIVERSE Phase 1 — Milestone Roadmap

**Scope:** Expanded §47 Build Now, confirmed by Ady on September 27, 2026.  
**Status:** M0 local implementation and verification delivered; foundation certification pending; M1–M8 not started.  
**Detailed specification:** [Phase 1 implementation plan](2026-09-27-universe-phase-1-implementation-plan.md).

Eight product milestones follow one foundation prerequisite. **M4 releases discovery (P1-A); M8 completes the recruiting pilot and expanded Phase 1 (P1-B).** Talent, applications, recruiter pages, and private event feedback remain required within Phase 1.

Milestone IDs are `P1-M0` through `P1-M8`; they are not the existing foundation phase numbers. The implementation plan remains authoritative for architecture, contracts, privacy rules, and detailed test requirements. This roadmap groups that work into demonstrable outcomes without adding scope.

## Roadmap at a glance

| Milestone | Demonstrable outcome | Packages | Focused engineering days |
|---|---|---|---|
| **M0 — Finish the foundation** | Existing system certified and safe to extend | F0; existing foundation backlog | Separate estimate |
| **M1 — Open the platform** | Students beyond McGill can join a redesigned, privacy-safe shell | P1-00–03 | 7–11 |
| **M2 — Build the opportunity core** | Ady can curate opportunities; students can save events and opportunities consistently | P1-04–05 | 7–9 |
| **M3 — Make discovery useful** | Complete discovery experience with real supply, resources, and submissions | P1-06–09 | 12–18 |
| **M4 — Launch discovery and the Weekly Drop** | Public P1-A release with functioning email and measured usage | P1-10, discovery portions of P1-17/18 | 7–9 |
| **M5 — Create reusable Talent profiles** | Students opt in and confirm private profiles from resumes or manual entry | P1-11–12 | 7–10 |
| **M6 — Complete the recruiting workflow** | Companies receive applications and review their own applicants without manual forwarding | P1-13–15 | 9–12 |
| **M7 — Add private feedback and useful metrics** | Private event feedback and a compact product/operations dashboard work | P1-16, remainder of P1-17 | 3–5 |
| **M8 — Certify and launch the recruiting pilot** | Real pilot proves the expanded product works and can be maintained | Remainder of P1-18 | 2–3 |
| **Total product implementation** | **M1–M8** | **All 19 packages** | **54–77** |

**Planning estimate:** 11–16 full-time engineering weeks, excluding foundation closure, external account/setup waits, and owner content preparation. Discovery can release after approximately **33–47 engineering days**. These are effort ranges, not calendar commitments. Re-estimate after M2 and the resume parser evaluation in M5.

Recommended solo implementation sequence:

```text
M0 Foundation
    ↓
M1 Accounts and shell
    ↓
M2 Opportunity core
    ↓
M3 Discovery, supply, resources, submissions
    ↓
M4 Weekly Drop + P1-A RELEASE
    ↓
M5 Talent profiles and resumes
    ↓
M6 Applications and recruiter workflow
    ↓
M7 Private feedback and metrics
    ↓
M8 P1-B PILOT RELEASE + PHASE 1 COMPLETE
```

The sequence assumes one implementer. Instrument analytics and add tests as each workflow is built; M4/M7 consolidate reporting and M4/M8 verify releases. Testing and telemetry do not wait until those milestones.

## M0 — Finish the foundation

**Purpose:** Establish a trustworthy starting point for the revamp.  
**Status:** Local implementation and verification delivered on `codex/m0-foundation-certification`. Deployed checks and operational sign-off remain pending; see [M0 report](../../.planning/milestones/m0/REPORT.md).  
**Work:** F0 in the implementation plan, using the existing foundation tracking records.  
**Dependency:** None. Scope/provider/content preparation can proceed while this closes.

Deliverables:

- Close DI-83: the webhook's three malformed payload cases return 400 instead of 500, with Jest/Deno agreement.
- Resolve the Phase 6 warnings affecting shipped behavior: page authorization, cached failures, observability/scrubbing, recommendation correctness/bounds, and experiment attribution.
- Complete the existing foundation certification and operational sign-off, including deferred deployment/migration prerequisites.
- Record a fresh green baseline and identify any remaining accepted limitations.

**Exit gate:** Required local and deployed checks have evidence; the foundation is certified under its existing process. A plan, an executed package, and a deployed fix are recorded separately. Do not mark this milestone complete from the historical green test counts alone.

**Demo/evidence:** A verification report links the tested commit, CI results, database checks, and live Sentry/CDN/webhook checks.

## M1 — Open the platform

**Outcome:** UNIVERSE admits students beyond McGill and presents the new product structure without exposing old public-review data.  
**Packages:** P1-00, P1-01, P1-02, P1-03.  
**Depends on:** M0 for implementation.  
**Estimate:** 7–11 days.

Deliverables:

- Record the confirmed expanded scope and resolve email-provider/sender, scraper ownership, and launch-content inputs.
- Establish public, account, moderation, and recruiter layout boundaries plus server-enforced release switches.
- Replace the McGill-only account rejection/deletion flow with verified-email admission; retain Google and add email OTP.
- Add university affiliation and short onboarding; preserve existing accounts, roles, saves, and onboarding completion.
- Introduce responsive editorial navigation and shared components. De-emphasize social features without deleting users' historical data.
- Remove public review/ratings exposure from database policies, APIs, and UI.

**Exit gate:** McGill, Concordia, and verified non-institutional accounts can enter correctly; bans and privilege boundaries still hold; recruiter access will not require student onboarding; direct database reads cannot expose private reviews; disabled backend features cannot be activated merely by visiting a URL.

**Demo:** Sign in with McGill and non-McGill test users, complete onboarding, navigate on mobile, and demonstrate that legacy saves remain and public review access is denied.

## M2 — Build the opportunity core

**Outcome:** One discovery model supports the broader product, and Ady can populate it through a small admin workflow.  
**Packages:** P1-04, P1-05.  
**Depends on:** M1.  
**Estimate:** 7–9 days.

Deliverables:

- Add opportunities, campus relevance, source/eligibility/freshness metadata, and scarce Ady's Picks with mandatory reasons.
- Present existing events and new opportunities through one typed discovery contract while keeping legacy event IDs and storage authoritative.
- Implement database-side filters, search, stable pagination, date/deadline rules, and duplicate review.
- Build quick-add, preview, approve/publish, edit, archive, and audit actions in the existing moderation area.
- Add new opportunity saves and a unified saved-items read path without duplicating existing event saves.

**Exit gate:** Approved legacy and new records appear once; private/rejected/deleted records remain inaccessible; deadlines and campus eligibility are accurate; pagination and saves are stable; unauthorized users cannot publish content or assign Ady's Pick.

**Demo:** Create a hackathon with an application deadline and curator note, publish it beside an existing campus event, save both, and show them in one saved-items view. Demonstrate a duplicate submission being caught before publication.

## M3 — Make discovery useful

**Outcome:** The product provides useful discovery, credible supply, and content beyond events.  
**Packages:** P1-06, P1-07, P1-08, P1-09.  
**Depends on:** M2.  
**Estimate:** 12–18 days.

Deliverables:

- Ship the new homepage, Discover filters, opportunity details, updated event details, saved-items screen, and factual About content.
- Display source, eligibility, last checked date, application deadline/event time, and the correct action clearly.
- Verify the real McGill producer through webhook, moderation, publication, and images; add freshness/failure visibility and safe replay.
- Launch an authored resource library with three to five genuine guides/templates supplied or authored by Ady.
- Add public submissions, listing reports, and the structured company hiring-request form, all feeding moderation.
- Add public metadata, sitemap entries, canonical URLs, and mobile/accessibility checks.

**Within-milestone order:** The resource schema from P1-08 must exist before P1-09's resource-submission/report integration closes. Other work follows its package dependencies.

**Exit gate:** A guest can find and act on events, hackathons, jobs, and programs; signed-in students can save them; a public submission can become a reviewed listing; failures show honest error states. Real ingestion, not only a fabricated webhook request, is demonstrated. No unfinished Talent workflow is advertised.

**Demo:** Browse as a guest, filter for a cross-campus hackathon, inspect its deadline/source, save after login, read a resource, then submit an opportunity and publish it from moderation. Show a real ingested McGill event and a closed listing with its action disabled.

## M4 — Launch discovery and the Weekly Drop

**Outcome:** P1-A is live and has a repeatable weekly curation/distribution loop.  
**Packages:** P1-10; P1-17 discovery analytics; P1-18 discovery release verification.  
**Depends on:** M3 and working email-provider/sender setup.  
**Estimate:** 7–9 days.

Deliverables:

- Build one edition editor that produces the web Weekly Drop, email preview, and copyable LinkedIn text.
- Implement signup, confirmation, unsubscribe, suppression, delivery state, and safe retry/reconciliation.
- Record discovery views, saves, outbound intent, resource use, confirmed subscriptions, and submission conversions.
- Prepare actual launch content: proposed minimum 20 checked items spanning the four required types, cross-campus relevance, three to five resources, and one Weekly Drop.
- Complete the P1-A acceptance checklist, preview/cache checks, mobile checks, compatibility checks, and rollback rehearsal.
- Release to a small cohort, observe it, then enable the public discovery release.

**Exit gate:** The detailed P1-A checklist passes; retries do not duplicate emails; unsubscribe/suppression work; old event URLs and necessary organizer workflows survive; a real release candidate has observed CI and deployment evidence. External sends occur only when authorized during execution.

**Demo:** Select content once, preview the edition on web and email, copy its LinkedIn version, exercise an authorized test delivery and unsubscribe, then inspect the discovery metrics.

**Release boundary:** This is the first public product release, not the end of Phase 1. Public jobs may use external applications and companies may submit requests. Native applications and recruiter applicant access remain gated until the recruiting pilot is ready.

## M5 — Create reusable Talent profiles

**Outcome:** Students can explicitly join Talent and build a private, reusable proof-of-work profile.  
**Packages:** P1-11, P1-12.  
**Technical dependency:** M2 plus account foundations; recommended solo sequence starts after M4.  
**Estimate:** 7–10 days.

Deliverables:

- Implement private profiles with university/program, skills, desired roles, availability, experience, projects, hackathons, awards, leadership, and safe portfolio links.
- Add distinct Talent opt-in and direct-introduction preferences, preview, opt-out, and deletion/export controls.
- Implement private PDF upload, validation, immutable file versions, and owner-authorized access.
- Evaluate and pin the parser, then add durable parse jobs, bounded retries, editable suggestions, and explicit confirmation.
- Keep manual profile entry usable when parsing fails or no resume is provided.

**Exit gate:** No profile is visible to arbitrary students or recruiters; parser output is never silently authoritative; late/retried jobs cannot overwrite confirmed edits or resurrect deleted data; unsupported PDFs fail safely; file cleanup works.

**Demo:** Opt in, upload a synthetic PDF, correct extracted information, add a project, and confirm the profile. Repeat with an unsupported PDF and complete the same profile manually. Demonstrate denial from a second account.

## M6 — Complete the recruiting workflow

**Outcome:** A company can receive and review applicants without Ady forwarding every resume.  
**Packages:** P1-13, P1-14, P1-15.  
**Depends on:** M5, M3 company intake, and M4's delivery adapter.  
**Estimate:** 9–12 days.

Deliverables:

- Convert approved company requests into roles with external/native application modes and up to three short questions.
- Issue verified, role-specific recruiter invitations with expiry/revocation and no permission from company name or domain alone.
- Implement student application preview, consent, confirmed profile/resume snapshot, duplicate protection, receipt, and withdrawal.
- Enforce application deadline and role-state checks atomically, including concurrent role closure.
- Build private applicant list/detail, factual filtering/sorting, authorized resume downloads, and consented external contact links.
- Show the simple New → Approved → Live → Applicants → Closed pipeline; no ATS, global candidate search, or quality scores.

**Exit gate:** A company can review its own applicants; role-A recruiters cannot inspect role-B applicants/files; forwarded invitations and guessed IDs do not confer access; withdrawal/revocation takes effect; retries create one application; profile edits do not rewrite prior submissions.

**Demo:** Submit a company request, approve the role, accept the recruiter invitation, apply as a student, review the applicant, and withdraw the application. Show that the recruiter then loses access and a different role's recruiter never had access.

## M7 — Add private feedback and useful metrics

**Outcome:** Ady can learn from event quality and product use without launching public ratings or invasive candidate tracking.  
**Packages:** P1-16 and remaining P1-17 analytics/dashboard work.  
**Depends on:** M6 for complete recruiting metrics; private feedback implementation can start after M2.  
**Estimate:** 3–5 days.

Deliverables:

- Add a short post-event questionnaire with event-end eligibility, one response per user/event, and explicit attendance signal labeling.
- Keep individual responses owner/admin-only; optional organizer aggregates must be scoped and meet the planned minimum response threshold.
- Finish Talent/application/recruiter metrics and combine them with discovery, subscribers, supply freshness, moderation backlog, and worker/provider health.
- Verify that conversions derive from successful writes and retries do not inflate results.
- Measure one weekly curation cycle and identify work that still requires repeated manual coordination.

**Exit gate:** No public star ratings or private comments leak; small aggregates do not identify respondents; resumes, contact data, answers, and tokens stay out of analytics/logs; the dashboard distinguishes clicks from completed applications.

**Demo:** Submit private feedback after an event, check owner/admin access, show organizer aggregate suppression below threshold, and review the weekly product/operations summary.

## M8 — Certify and launch the recruiting pilot

**Outcome:** The expanded Phase 1 works with a small real cohort and has a maintainable operating process.  
**Package:** Remaining P1-18 certification, pilot rollout, and sign-off.  
**Depends on:** M4–M7 complete and all P1-B external inputs available.  
**Estimate:** 2–3 engineering days; participant response time and pilot observation are additional elapsed time.

Deliverables:

- Complete the full P1-B acceptance matrix: RLS/Storage isolation, private caching, applications, withdrawal, revoked invites/memberships, retention/deletion, worker failures, and role-close races.
- Exercise resume parsing/manual fallback and employer handoff with a proposed 5–10 consenting students and 2–3 hiring contacts.
- Verify staging load, mobile usability, real deployment configuration, and safe rollback to a relaunch-compatible build.
- Finalize runbooks for stale ingestion, bad listings, email/parse failure, recruiter access, withdrawal/deletion, and recovery.
- Record actual maintenance burden over two editions, observed operating costs, remaining limitations, and the release evidence.

**Exit gate:** Every required P1-B check passes, CI is observed on the actual candidate commit, and the pilot completes without Ady manually routing each applicant. No unaccepted critical/high defect affects a shipped flow. Real content and privacy operations are demonstrated, not just mocked.

**Demo:** A complete student/company journey plus an operational walkthrough: failed parse retry, revoked recruiter, withdrawn application, closed role, and recovery path. Show the final evidence report and the weekly operator checklist.

**Release boundary:** P1-B is enabled for the approved recruiting cohort. Broader recruiter access follows measured pilot behavior; the platform does not gain a public candidate directory. Both P1-A and P1-B are necessary to close expanded Phase 1.

## Package accounting and completion tracking

P1-17 and P1-18 span two releases. Their estimates are allocated once:

| Shared package | First allocation | Remaining allocation | Original total |
|---|---|---|---|
| P1-17 — Metrics | M4: 1 day for discovery consolidation | M7: 1–2 days for recruiting/dashboard completion | 2–3 days |
| P1-18 — Certification/release | M4: 2–3 days for P1-A | M8: 2–3 days for P1-B | 4–6 days |

Endpoint-level telemetry and tests stay inside each feature package. These shared allocations are for integration, dashboards, and release evidence; they do not replace the feature packages' own verification.

Initial tracking state:

- [ ] M0 — Foundation certified (implementation underway; deployed certification pending).
- [ ] M1 — Accounts, shell, and review privacy complete.
- [ ] M2 — Opportunity core and curation complete.
- [ ] M3 — Discovery, supply, resources, and intake complete.
- [ ] M4 — P1-A discovery release verified.
- [ ] M5 — Private Talent profiles and parsing complete.
- [ ] M6 — Recruiting workflow complete.
- [ ] M7 — Private feedback and metrics complete.
- [ ] M8 — P1-B pilot verified; expanded Phase 1 closed.

For each milestone, record the implementation commit/PR links, demonstrated outcome, test evidence, unresolved dependencies, and actual effort. Mark complete only when its exit gate passes. Keep foundation evidence in the existing foundation records and link to it rather than duplicating its issue ledger here.

## Owner inputs to prepare early

| Input | Needed for | Latest practical point |
|---|---|---|
| Email provider/sender domain and environment access | OTP, Weekly Drop, recruiter invitations | M1 selection; before M4 integration closes |
| Actual scraper account/producer ownership | Reliable McGill ingestion | Before M3 supply work |
| Factual founder copy, links, and 3–5 real resources | About and resources | During M2, ready for M3 |
| Checked launch opportunities and first edition | Credible discovery launch | Before M4 release |
| Resume handling/retention defaults and private pilot copy | Real personal-data workflows | Before M5/M6 accept real resumes |
| 2–3 hiring contacts and 5–10 consenting students | End-to-end recruiting pilot | Recruit during M5/M6; ready for M8 |

These inputs are preparation dependencies, not requests to send messages or provision services now. Product development remains staged around the confirmed expanded scope.
