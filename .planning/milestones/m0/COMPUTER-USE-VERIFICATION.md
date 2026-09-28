# M0 computer-use verification — 2026-09-28

**Result:** Local browser verification completed; four observed defects corrected and rechecked. Deployment remains deferred at the user's request. This supplements the M0 baseline, not a declaration of full foundation certification.

**Environment:** Chrome through the computer-use tool, `http://127.0.0.1:3000`, a fresh Next production build, and the existing local Event-Radar Supabase fixtures. The server inherited the guarded Playwright environment configuration, overriding production backend/Redis/Sentry/monitor values and binding only to loopback. No production account or dataset was used. Baseline commit: `d3ea080`. Exact changed-source hashes are in [the verification record](evidence/cua-2026-09-28-source.json).

## Observed browser checks

These are actual UI actions and returned accessibility/screenshot observations, not inferred from source or previous automated results. Screenshots were inspected in the task transcript; this document records the observations rather than claiming an archived image artifact.

| Check | Observed result |
|---|---|
| Anonymous event discovery | Searching `Seed` produced two approved results. Selecting Academic reduced that to one. The event detail rendered its content and aggregate attendance. |
| Anonymous save | Save opened the “Sign in to save events” dialog. |
| Anonymous admin gates | `/docs` redirected to `/`; `/moderation` redirected to `/admin-login`. |
| Admin login | The disposable seeded admin signed in through the real login form and reached the moderation dashboard. |
| Admin documentation | The specification rendered after authentication. Initially dark text appeared on the dark shell; the corrected build showed readable text on an explicit white documentation surface. |
| Save / RSVP | Admin saved the seeded event and marked Interested. Reload retained Saved, Cancel, and one interested attendee. Going changed the totals to three going / zero interested. Cancel and Unsave returned the active state to two going / zero interested and Save. |
| Experiment validation / recovery | An invalid `{` configuration initially left Creating disabled even after correction. After the fix, an inline validation message appeared, the button remained available, and correcting to `{}` created a draft with two variants and zero assignments. |
| Experiment detail | The created draft showed both variants and result rows. Initially the numeric cells were white on white; after the fix, zero impressions and 0.00% values were visibly readable. The experiment was never started. |
| Club search / date | Searching `Seed Approved Club` returned exactly one result. Its upcoming-event badge initially showed `INVALID DATE NaN`; after the fix it showed `JUN 8`, matching the seeded June 8, 2036 event. Stored wall-clock calendar semantics remain unchanged. |
| Sign-out | Profile → Settings → Account → Sign Out returned to the homepage. A subsequent `/docs` visit redirected to the anonymous homepage with the sign-in control. |
| Non-admin rejection | The seeded student submitted the admin login form, received “This account does not have admin privileges,” and returned to the signed-out shell. This is a login-gate test, not a claim of a complete authenticated student journey in this pass. |

## Changes and automated validation

- Documentation has an explicit light surface and text/color-scheme context for Redoc's default theme.
- The experiment detail's existing light surfaces have an explicit dark text color, so numeric cells do not inherit the shell's white text.
- Experiment creation catches malformed JSON before issuing a request, preserves entries on failed requests, and always releases the submitting state. The list shows a retryable loading error rather than false empty results. Inputs have associated accessible labels.
- Club search cards parse the stored calendar-date portion once instead of appending another time to an existing timestamp. Formatting explicitly uses UTC for this wall-clock representation; no rows or timezone conventions were migrated.

[Targeted Jest](evidence/cua-2026-09-28-tests.txt): **20 passed across three suites**, including five new cases for malformed-JSON correction, creation HTTP/network failures, and list HTTP/network failure recovery. [Type checking](evidence/cua-2026-09-28-types.txt), [changed-file lint](evidence/cua-2026-09-28-lint.txt), [client contract guard](evidence/cua-2026-09-28-contracts.txt), and [production build](evidence/cua-2026-09-28-build.txt) all exited 0. Empty type/lint logs indicate successful checks with no diagnostics.

The prior 1,800-browser / 3,667-unit / 626-database results remain evidence for the original M0 implementation commit. Those complete suites were not rerun for these focused UI changes. No schema, dependency or API response contract changed in this follow-up.

## Cleanup and limits

The test draft was removed by exact ID, name and draft status through a guarded local fixture client; a readback confirmed its absence. Save/attendance actions were reversed through the UI and test sessions signed out. Normal local interaction history and the cancelled RSVP row may remain; no claim of a full database snapshot restoration is made. The temporary local application process was stopped after verification. Pre-existing untracked workspace files were preserved.

This pass did not deploy, push, alter hosted configuration, perform production migrations, exercise real Google OAuth, test CDN behavior, prove Sentry/Upstash delivery, restore a hosted backup, or run a production rollback. The existing [M0 report](REPORT.md) remains authoritative for those requirements and the outstanding strict coverage/offline fallback gaps. The user's decision to defer deployment does not imply acceptance of those gaps.
