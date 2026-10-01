# M1 account admission and campus affiliation

UNI-VERSE accepts any **verified email** through Google or an email code. Campus affiliation is informational and cannot grant administrative, organizer, club, or recruiter authority.

The callback exchanges Google authorization codes, or finishes an already verified OTP session. The `verified=1` query parameter is only a navigation marker: the server still calls `auth.getUser()` and requires `email_confirmed_at`. Failed verification signs out and returns a generic error. There is no domain-rejection account deletion. Returning users retain their chosen name, avatar, roles, saves, and onboarding state; only the authoritative verified email is synchronized.

During OTP admission, client account state stays unpublished until the synchronized profile is readable. This prevents authenticated Next.js link prefetches from hitting the missing-profile signout boundary before the callback finishes. Delayed profile responses cannot republish a signed-out or previous account. The local OTP browser regression deliberately holds the callback for four seconds and verifies no protected-link prefetch occurs.

New student setup requires a display name and a university choice, including **Other** and **Prefer not to specify**. Interests, program and year are optional. Public browsing remains available before setup; existing student-authoring routes and student mutations keep their completion gate. Future recruiter routes do not inherit the student-page gate and remain independently feature-disabled.

The six-school university catalog is readable publicly for active entries. Catalog writes are server-mediated; no public/admin catalog editing interface ships in M1. `university_id`, `other_university`, and `affiliation_source` updates pass through the authenticated self-profile endpoint. Clients cannot set provenance through the Data API. User-entered affiliation has `self_declared` provenance. The migration marks only legacy accounts with an authoritative verified exact McGill-domain email as `verified_email`; this records the email inference and is not institution verification. Users can correct or clear the inferred school in profile settings. Existing completion and authority remain unchanged.

## Local verification and deployment boundary

`supabase/config.toml` enables email confirmation and points both confirmation and magic-link email templates at `supabase/templates/email-code.html`, which renders the OTP token. The dedicated guarded `playwright.m1-m2.config.ts` enables discovery only, provisions a disposable confirmed non-campus account, exercises the server callback and short onboarding, and verifies publication/saves/signout. The baseline Playwright configuration keeps every feature switch false.

Hosted Supabase Google credentials, allowed callback URLs, confirmation settings, OTP templates, sender identity, deliverability, and actual provider-account sign-in require environment-owner configuration/verification before deployment. Local password-injected sessions prove application admission, not the external Google provider. No production auth settings or messages are changed by the implementation.
