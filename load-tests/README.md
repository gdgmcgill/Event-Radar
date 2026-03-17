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
