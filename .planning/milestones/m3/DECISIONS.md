# M3 execution decisions

Date: 2026-09-29 (America/Toronto). Branch: `codex/m3-useful-discovery`; starting commit: `c5c1bc6`.

## Authorization and scope

The owner instructed "go ahead with m3" after M1–M2 was committed as `c5c1bc6`. M3 covers P1-06 through P1-09 of the [implementation plan](../../../docs/plans/2026-09-27-universe-phase-1-implementation-plan.md) and the M3 section of the [milestone roadmap](../../../docs/plans/2026-09-27-universe-phase-1-milestones.md). The execution plan is [docs/superpowers/plans/2026-09-29-m3-useful-discovery.md](../../../docs/superpowers/plans/2026-09-29-m3-useful-discovery.md). Deployment remains deferred; no production migration, push, or external send is authorized.

## Owner answers (2026-09-29)

| Question | Answer | Consequence |
|---|---|---|
| Real producer for P1-07 | Rebuild the Apify → classifier → signed-webhook producer in the repo and run it once against the **local** Supabase stack with a few club handles | Apify spend is capped at a few handles (cents). Nothing reaches production. The runner refuses non-loopback webhook targets without an explicit override. |
| Founder copy and resources | Build the library, editor and About layout now; owner adds real content through the admin editor before M4 | No resource, founder bio, endorsement or listing is invented. Empty sections are omitted or show honest empty states. The launch-content checklist items stay open. |
| Commits | New branch, one local commit per package after its checks pass | Explicit paths only; the untracked `.agents/`, `docs/product-master-plan.md` and `skills-lock.json` stay out. No push. |

## Product decisions made during planning

- All new public pages and APIs (`/`, editorial home, `/resources`, `/submit`, `/for-companies`, report intake) sit behind the existing `discovery_ui` switch and its admin preview. With the switch off, the legacy homepage and legacy About render and new routes answer 404.
- `/landing` redirects to `/` only when `FEATURE_DISCOVERY_UI=true` (cutover), not in admin preview. The sitemap lists new public content only under the same condition.
- Provenance copy is "Automatically indexed" (Instagram/webhook), "Added by the Uni-Verse team" (manual) and "Submitted by the organizer" (partner). Nothing is labelled "Verified".
- Public submissions convert to **draft** opportunities or resources. Publication still goes through the M2 editor and its checks (checked source, action, timing, duplicate review). A converted company request never grants a role, recruiter access or any account permission, and its private contact is never copied into the listing.
- Resource Markdown is rendered by a small in-repo renderer that produces React elements only (no HTML injection path). Raw HTML and non-http(s)/mailto links are rejected at the contract and ignored by the renderer. Template files live in a private `resource-files` bucket and are served through a short-lived signed URL after a published check.
- Ingested images are persisted by an explicit admin batch action using an allow-listed host, DNS private-address rejection, manual redirects, size/time caps and byte sniffing. Broken image URLs render the placeholder.
- The producer is operator-run in M3. Scheduled execution needs a hosted secret and owner decision and is deferred to the M4 release work.
- Anti-abuse for intake: honeypot field, a 5-per-minute route budget in the proxy limiter, and database quotas keyed by a salted client hash (never the raw IP). A challenge (CAPTCHA) is added only if abuse is observed.

## Verification rulings (2026-09-29)

- The six real ingested pending events and their delivery rows from the P1-07 run were exported before the gate's `supabase db reset --local`, the baseline browser suite ran on the fresh reset-and-seed state (its health spec expects no ingestion), and the rows were restored with `COPY` after every browser suite finished, so the milestone demo can still approve a real McGill event.
- Public intake routes are anonymous-capable by design. The baseline authorization matrix classifies them as such (every non-banned persona receives the route's switch-off 404; banned personas still receive 403) and probes each persona from its own documentation-range client address, because the intended 5-per-minute-per-address intake budget otherwise answers 429 to the thirteenth persona on one loopback address. The product limiter is unchanged.
- The event detail hero now falls back to the placeholder image like cards and the moderation queue (a product defect found by the acceptance suite).
- The computer-use demo is performed by the controller session and recorded in `COMPUTER-USE-VERIFICATION.md`.
- The launch-content checklist in the M1–M2 decisions is unchanged: no owner content was supplied during M3.
