# M1–M2 execution decisions

Date: 2026-09-28 (America/Toronto). Branch: `codex/m1-m2-opportunity-platform`; starting commit: `de0854b`.

## Authorization and scope

The owner confirmed expanded §47 Build Now for Phase 1, then instructed: “m0 is complete now move on to m1-m2 please, use computer use to verify things when needed.” M0 is owner-closed as the prerequisite for this implementation. Its historical report remains evidence of what was and was not observed. This does not invent hosted CI, migration, backup, alert, or deployment results. Deployment remains deferred by the owner's prior instruction.

This execution covers P1-00 through P1-05 in the [implementation plan](../../../docs/plans/2026-09-27-universe-phase-1-implementation-plan.md). Minimal Discover, detail, and Saved screens make the M2 demo testable. The full homepage, content supply, resources, submissions, founder story, newsletter, Talent, applications, resume parsing, and recruiter workflows retain their later milestone assignments. These package IDs map implementation work; no unavailable GSD command is claimed to have run.

## Product decisions

- Admit any verified email through Google or email OTP. University affiliation is profile information, never permission or admission authority. Never delete an account because of its domain.
- Preserve existing completion, roles, bans, event IDs, event URLs, calendars, and saved events. Allow public browsing before onboarding; enforce completion on student mutations.
- Preserve legacy reviews as owner/admin history. Remove public ratings, comments, and aggregates through database grants/RLS and API/UI. No feature switch restores public legacy reviews.
- Keep events and opportunities authoritative in separate tables. Read an explicit invoker projection with `{kind,id}` identity; never copy every event into opportunities.
- Legacy McGill relevance is a documented compatibility default, not an eligibility or organizer-affiliation claim. New listings record those independently.
- Use deterministic editorial ordering and a fixed `as_of` cursor. No experiments or inferred personal tags affect the new feed. Keep existing recommendation routes compatible.
- Parse source URLs locally for quick add; do not fetch arbitrary URLs. Publication requires checked source, action or explicit no-action explanation, and actionable timing.
- Retain date-only precision and source timezone. Missing eligibility reads “Check eligibility with organizer.” Preserve DEC-80 legacy event time conversion.
- Active admins curate. Only the configured `CURATOR_USER_ID` can change Ady's Pick or editorial priority; an empty setting denies the operation. Reasons and actor/time audit history are mandatory. No paid placement.
- Server-authoritative switches require exact `true` and default off. Optional active-admin preview grants presentation access only. Switching discovery off preserves additive data and legacy flows; it never restores account deletion or public reviews.
- Discovery starts private/no-store for safe preview and immediate moderation visibility. Shared CDN caching is deferred to M3/M4 release work.
- Advertise delivered routes only. Social routes retain compatibility without primary promotion. Resource/newsletter/company/submission/Talent links wait for their milestones.
- University catalog starts with the six agreed institutions. Catalog additions require an audited migration for now; an admin catalog-management screen is not included in this milestone.

## Minimal flow map

| Actor | Flow | Gate |
|---|---|---|
| Anonymous | Discover → filter → source/eligibility/deadline → organizer link | M2 shell; M3 full content/homepage |
| Student | Sign in → verify email → short profile → save event/opportunity → Saved | M1–M2 |
| Admin | Paste URL → check source → draft → preview/duplicate review → publish → edit/archive | M2 |
| Submitter | Public submission → private moderation → published target | M3 |
| Applicant | Separate Talent opt-in → preview application → consent → submit | M5–M6, disabled |
| Recruiter | Verified sign-in → assigned role → permitted applications only | M6, disabled; no student onboarding prerequisite |

## External integration inventory

An accountable owner below owns supplying or deciding an input; it does not imply configuration is complete. No services were bought and no external email was sent.

| Input | Accountable owner | Implementation / unresolved input | Dependent release gate |
|---|---|---|---|
| Curator identity | Adyan | Real verified admin UUID pending owner answer; local fixture admin used only in guarded tests | Live named Picks |
| Google OAuth audience/redirects | Adyan / Auth project owner | Provider code retained; external console audience and preview/production callback settings require verification | Hosted Google admission |
| Transactional provider/sender domain | Adyan | Local Supabase email capture and OTP templates; owner provider/domain selection pending; do not request secret values | Hosted OTP, then M4 newsletter |
| McGill scraper producer/operator | Adyan to name maintainer | Existing webhook retained; genuine producer delivery/images/replay must be observed in M3 | M3 ingestion / M4 release |
| Preview/staging hosting/Supabase | Adyan / project owner | Local guarded stack only; distinct staging credentials/origins required later | Hosted acceptance / M4 |
| Rate limits, alerts, uptime/backups | Adyan / project owner | M0 interfaces retained; hosted checks remain deferred in its report | Any hosted release |
| Launch content and founder copy | Adyan | No fabricated endorsements, employer relationships, authorship, or live opportunities | M3/M4 |
| Resume pilot/parser | Adyan | Proposed defaults: opt-in, private PDF, capped size, extracted draft requiring confirmation, no scoring; vendor/retention decision at M5 | M5–M6 |
| Employer/recruiter pilot | Adyan | Named pilot roles and role-specific verified recipients; never domain-based authorization | M6 |

Hosted OTP setup must include confirmation/magic-link code templates, verified sender, callback allowlist, rate limits, and a real delivery check. The optional integration question was raised during execution; outstanding answers block these dependent hosted/content gates, not local engineering.

## Launch-content checklist

- [ ] Twenty checked items spanning events, hackathons, jobs/internships, and programs, with cross-campus relevance and real deadlines.
- [ ] Three to five genuine resources with author attribution, permission, and updated dates.
- [ ] A small personally approved set of Ady's Picks with reasons.
- [ ] Factual founder/community story and permitted photos/logos.
- [ ] One Weekly Drop edition and verified signup/suppression copy.
- [ ] Approved employer pilot roles and verified recruiter accounts before native applications open.
