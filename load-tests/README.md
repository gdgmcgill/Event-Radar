# k6 Load Tests

This folder contains k6 scenarios for concurrency and onboarding pressure tests.

## Prerequisites

- Install k6: [https://k6.io/docs/get-started/installation/](https://k6.io/docs/get-started/installation/)
- Run tests against staging (recommended), not production.
- Make sure your staging DB has realistic test data.

## 1) 500 online users

Simulates concurrent browsing traffic against public API endpoints.

```bash
BASE_URL=https://your-staging-domain.com \
TARGET_VUS=500 \
RAMP_SECONDS=180 \
HOLD_SECONDS=600 \
npm run load:online
```

Default thresholds:
- `http_req_failed < 1%`
- `p95(http_req_duration) < 800ms`

## 2) 500 onboarding completions

Simulates authenticated users completing onboarding (`PATCH /api/users/:id` then `POST /api/onboarding/complete`).

### Required env vars

- `USER_IDS`: comma-separated user IDs
- `SESSION_COOKIES`: newline-separated raw `Cookie` header values, one per user ID

The two lists must have the same number of entries.

### How to collect session cookies safely

1. Log in with staging test users in a browser.
2. Open DevTools Network tab and inspect an authenticated request.
3. Copy the full `Cookie` header value.
4. Repeat for each test user and paste one cookie header per line into `SESSION_COOKIES`.

### Run

```bash
BASE_URL=https://your-staging-domain.com \
TARGET_VUS=500 \
RAMP_SECONDS=180 \
HOLD_SECONDS=300 \
USER_IDS="user-id-1,user-id-2,user-id-3" \
SESSION_COOKIES=$'cookie_for_user_1\ncookie_for_user_2\ncookie_for_user_3' \
npm run load:onboarding
```

Default thresholds:
- `http_req_failed < 2%`
- `p95(http_req_duration) < 1200ms`

## Notes

- k6 virtual users are not the same as real browser tabs; this measures backend/API capacity.
- If you need full browser-level load (JS rendering + assets), pair k6 with browser-based monitoring and infrastructure metrics.

## M0 discovery certification (CERT-12)

Load `npx tsx scripts/seed/certification.ts scale --load` into the guarded local
stack or dedicated staging database. Run a production Next build connected to
that database, then:

```sh
k6 run --summary-export=discovery-summary.json load-tests/k6-discovery.js
```

The default is 3 VUs for 60 seconds from one address, below the current 300/min
list budget. This measures hot-path latency against the scale dataset; it does
not claim 500-user capacity. A staging run explicitly sets `BASE_URL`, matching
`CERT_STAGING_ORIGIN`, and `CERT_LOAD_ACK=staging-only`. Production is prohibited.
Use representative distributed load origins for larger user loads; do not spoof
forwarding headers or disable rate limits. Keep 429s in the failure rate.

Before each run, preserve the dataset manifest, commit, deployment identifier,
VUs/duration, runner topology, and these fixed gates: list and detail p95 <800 ms,
request errors <1%, every payload/identity check passing. Preserve raw output and
summary JSON even on failure. A local run does not satisfy staging certification.
