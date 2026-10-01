# M1–M2 implementation report

Execution: September 28–29, 2026. Branch: `codex/m1-m2-opportunity-platform`, based on `de0854b`.

Scope: P1-00 through P1-05 of the expanded Phase 1 plan. The owner declared M0 complete for progression and authorized M1–M2. Historical M0 evidence remains intact. No push, deployment, production migration, or hosted configuration change was performed.

## Delivered

| Package | Result |
|---|---|
| P1-00 | [Decisions, flow map, integration owners, and launch-content checklist](DECISIONS.md); current repository guidance updated. Unresolved external inputs gate their dependent release. |
| P1-01 | Typed, server-enforced release switches, default off; active-admin discovery preview; public/account/moderation boundaries. Future Talent, recruiting, parsing, and feedback routes remain closed. |
| P1-02 | Verified email admission via Google/shared callback and email OTP; no domain-based account deletion; six universities; short onboarding; safe editable affiliation; preserved roles, bans, completion, and existing saves. |
| P1-03 | Responsive editorial navigation, theme parity and accessible controls; social features de-emphasized; legacy reviews restricted to owner/active-admin history through grants, RLS, API and UI. |
| P1-04 | Additive opportunities and metadata, invoker cross-kind discovery projection, database-side filters/search, bounded stable cursors, deadline/timezone precision, relevance separate from eligibility, canonical duplicate handling. |
| P1-05 | Admin quick-add, preview, edit, publish, archive, duplicate review/merge, event enrichment, audited curator-only Picks; idempotent saves and one private saved-items view. |

Minimal Discover, detail, and Saved screens make M2 usable and demonstrable. The full new homepage, real content supply/ingestion, resources, submissions and founder story remain M3. Weekly Drop remains M4; Talent, native applications, recruiters and private new feedback remain M5–M8.

## Compatibility and security

Existing event IDs, event storage, event URLs, saved events, calendar/RSVP and organizer flows remain authoritative. New opportunities do not copy the event database. Legacy timestamp conversion follows DEC-80. Account affiliation cannot grant any role. Returning sign-ins do not overwrite the user's chosen profile.

Every new API initially uses `private, no-store`. Public discovery excludes drafts, rejected/deleted records and private moderation fields even for an admin cookie. Preview access does not confer write permission. Curator authority requires an active admin and exact configured principal; reasons and before/after audit history are required. Publication, duplicate checks and merges are transactional. An unpublished draft cannot become a public alias.

The public UI never contains private save state in its listing projection. Late reads cannot overwrite successful saves/unsaves; account changes discard private state, and save completion after navigation refreshes the current account's shortlist.

## Verification

Earlier diagnostic logs are retained separately and are not claimed as green evidence. Files ending in `-final.log` record the final applicable runs.

- Three additive migrations replayed locally; generated Supabase types refreshed.
- Database suite: **735 assertions across 26 files**, both unseeded and seeded pass. [Unseeded](evidence/database-tests.log), [seeded](evidence/database-seeded-final.log). After browser mutations, the guarded seed loader restored fixture timestamps; local `ANALYZE` refreshed stale event statistics before the seeded run's pre-existing exact-index plan assertion passed.
- Unit/UI suite: **3,862 passed, one credential-dependent skip**, 155 passing suites. [Evidence](evidence/unit-tests-final.log).
- Enabled browser suite: **15 passed**, including ten persona setup cases and five product workflows, against a fresh production build. The real OTP case deliberately holds the callback for four seconds to prove first-account prefetch cannot revoke the session. [Evidence](evidence/browser-enabled-final.log).
- Baseline browser suite (all product switches off): **2,003 passed, 133 skipped, exit 0** against a fresh production build. [Evidence](evidence/browser-baseline-final.log). The page-smoke harness now retires only late fetches whose `Referer` is the exact document replaced by a streamed `/settings` or `/my-clubs` redirect (`e2e/helpers/requestDocument.ts`, unit-tested); destination and unattributed requests keep the strict 5 s bound. Those two cases passed 10/10 repeats. [Evidence](evidence/browser-page-smoke-final.log).
- Local environment note: the local Supabase Auth container (GoTrue `v2.197.0`) opens about nine new Postgres connections per concurrent `/user` call (measured: 400 calls at concurrency 10 added 3,945 TIME_WAIT sockets). One full baseline run left 21,432 TIME_WAIT sockets against a 28,232-port range, and later runs failed intermittently with `dial tcp …:5432: cannot assign requested address`, which the app correctly answers as 401. The recorded passing run enabled `net.ipv4.tcp_tw_reuse=1` inside that container's network namespace only (resets on container restart); no application code or test expectation changed for it. Hosted Auth does not share this local port limit, but the flake will recur locally without that setting or an auth-container restart between suite runs.
- TypeScript passes; generated public-schema types match the running local database byte-for-byte. ESLint reports zero errors and 15 existing warnings. [Typecheck](evidence/typecheck-final.log), [type drift](evidence/type-drift-final.log), [lint](evidence/lint-final.log).
- Static guards: **all seven pass**, including empty contract/elevated exception censuses, 36-table/144-role-read RLS coverage and 21 valid migration filenames. [Evidence](evidence/guards-final.log).
- Query plan: rollback-only 10,000-row local fixture, approximately 17 ms RPC execution. Sequential/top-N work remains visible; this is not production-scale certification. [Evidence](../m2/evidence/discovery-explain.txt).
- [Computer-use verification](COMPUTER-USE-VERIFICATION.md): actual local code delivery, admin curation, date-only detail, unified saves, account isolation, and actual Chrome 200% zoom. Prepared manual listing published in **50.844 seconds**; source research time excluded.

The enabled acceptance suite exercises real local APIs and browser UI, including fresh/returning OTP sessions, non-campus onboarding, publication, duplicate review, saved items, feature denial, 360 px keyboard navigation, light/dark layouts, and reflow. The baseline suite runs with all product switches off and checks legacy behavior and authorization.

Computer use exposed a first-account OTP race: the client published an Auth-only user before the callback created `public.users`, rendering links whose Next prefetch triggered the missing-profile signout boundary. The client now waits for the synchronized profile before publishing account state. The proxy stays fail-closed. Late profile reads also cannot restore a signed-out or different account. Controlled unit tests and a delayed-callback real-OTP browser test verify the fix.

## Reproduce locally

Use the repository-pinned Node 24/npm 11 toolchain and local Supabase stack. The Playwright configs obtain credentials from the guarded local stack and blank external integrations; do not substitute `.env.local` production values.

```sh
supabase db reset --local
npx tsx scripts/seed/load.ts
supabase test db --local
npm run test:ci -- --runInBand
npx tsc --noEmit
npm run lint
# Local-only: let the auth container reuse TIME_WAIT ports (see the environment note).
docker run --rm --privileged --net container:supabase_auth_Event-Radar alpine sysctl -w net.ipv4.tcp_tw_reuse=1
npx playwright test --config=playwright.config.ts
npx playwright test --config=playwright.m1-m2.config.ts
```

The reset is for a disposable local database only. Run browser configurations sequentially: each builds and starts its own production server on port 3000. Browser origin is `http://localhost:3000`; the Supabase API stays on its guarded loopback URL. The two browser configurations must not reuse another running app server.

## Remaining release inputs

No hosted release is claimed. Before enabling this outside local verification, configure/verify the real curator UUID, Google audience/callbacks, email provider/sender and hosted OTP templates/delivery, and staging/production operational requirements retained in M0. Owner-supplied launch content and real scraper verification belong to M3/M4. See [DECISIONS.md](DECISIONS.md) for accountable owners and dependent gates.
