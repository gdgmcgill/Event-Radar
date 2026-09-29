# Server release switches

P1-01 uses `src/lib/features.ts` as the single server-only reader. A switch is enabled only by the exact string `true`; missing, empty, `1`, and other values are disabled. Requests, query parameters, cookies, user metadata and `NEXT_PUBLIC_*` variables cannot enable a switch.

| Feature | Server environment variable | Boundary |
| --- | --- | --- |
| `discovery_ui` | `FEATURE_DISCOVERY_UI` | Editorial discovery presentation; does not authorize writes |
| `native_applications` | `FEATURE_NATIVE_APPLICATIONS` | Talent/application page and API families, including opportunity applications |
| `recruiter_access` | `FEATURE_RECRUITER_ACCESS` | Recruiting page, API and admin-recruiting families |
| `resume_parsing` | `FEATURE_RESUME_PARSING` | Resume parse endpoints, in addition to native applications |
| `new_feedback_writes` | `FEATURE_NEW_FEEDBACK_WRITES` | Mutations on the new `/api/events/:id/feedback` family |

All default to disabled. `FEATURE_DISCOVERY_ADMIN_PREVIEW=true` enables only discovery presentation for a server-verified active admin whose profile ID matches the authenticated user. The shell receives the resulting boolean; the preview cannot enable backend capabilities. Public activation of discovery uses `FEATURE_DISCOVERY_UI=true`. No switch reinstates the retired McGill account deletion flow or legacy review writes/public policies.

The proxy and `withRoute` both check segment-aware route families. New handlers outside those families should declare `feature` in their `withRoute` options. Disabled responses are 404 JSON with `private, no-store`; enabled routes must still run their usual active-user/role/ownership checks. Flags are release gates, not permission grants. Parse routes require both native applications and resume parsing.

M1/M2 do not implement the later Talent, recruiting, resume parser or private-feedback products. Their future route families remain unreachable by default. The old `/api/events/:id/reviews` POST is permanently retired even when the new feedback switch is enabled.

Verification: `src/lib/features.test.ts` tests defaults, malformed values, admin preview, encoded route segments, adjacent-route nonmatches, combined gates, direct handler calls and forged URL/header/cookie activation. Proxy tests independently exercise the family guard.
