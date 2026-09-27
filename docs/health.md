# /api/health

`GET /api/health` answers two questions for two audiences:

- **Is the process alive?** for anyone, including a load balancer or a curious visitor.
- **Why might it not be healthy?** for an active admin or the uptime monitor, and only for them.

Plan 06-17, REFAC-22, DEC-78. The schemas are `HealthLiveness` and `HealthReport` in
`src/contracts/health.ts`; the handler is `src/app/api/health/route.ts`; the admin dashboard at
`/health` renders the report and is itself admin-only (DEC-79).

Every response is `Cache-Control: private, no-store` and carries an `x-request-id`. A CDN-cached "ok"
would hide an origin outage, so no shared cache ever stores a health answer.

## Who gets which shape

| Caller | Answer |
|---|---|
| Anonymous | Liveness |
| Signed in, not an admin | Liveness |
| An admin who is banned (suspended) | Liveness |
| An active admin session (`requireActiveUser`, then the `admin` role) | The report |
| `Authorization: Bearer <HEALTH_TOKEN>`, token configured and 32+ characters | The report |
| A bearer that does not match, or any bearer when no token is configured | Liveness |

The admin decision goes through the request context (`createRequestContext()`, which verifies the user
with the auth server). The route never reads the session from the cookie without verifying it.

The token comparison hashes the presented bearer and the configured token with SHA-256 and compares
the two digests with `crypto.timingSafeEqual`, so the time taken does not depend on how much of the
bearer is right or how long it is. The token is never logged, echoed or compared with `===`.

## Liveness

```json
{ "status": "ok", "version": "0.1.0" }
```

Always HTTP 200. `version` is the package version the server was started with. Nothing else is in
this body: no dependency names, no configuration state, no error text, no memory figures.

## The report

```json
{
  "status": "ok",
  "version": "0.1.0",
  "ts": "2026-09-27T16:05:12.345Z",
  "checks": {
    "db": { "status": "ok", "latency_ms": 12 },
    "auth": { "status": "ok", "latency_ms": 8 },
    "storage": { "status": "ok", "latency_ms": 9 },
    "pg_cron": {
      "status": "ok",
      "jobs": [
        {
          "jobname": "compute-user-scores",
          "schedule": "0 */6 * * *",
          "active": true,
          "last_start": "2026-09-27T12:00:00.012Z",
          "last_status": "succeeded",
          "stale": false
        },
        {
          "jobname": "send-event-reminders",
          "schedule": "*/15 * * * *",
          "active": true,
          "last_start": "2026-09-27T16:00:00.004Z",
          "last_status": "succeeded",
          "stale": false
        },
        {
          "jobname": "send-feedback-requests",
          "schedule": "*/30 * * * *",
          "active": true,
          "last_start": "2026-09-27T16:00:00.009Z",
          "last_status": "succeeded",
          "stale": false
        }
      ]
    },
    "webhook": { "last_ingest_at": "2026-09-16T21:40:03.000Z" }
  }
}
```

A degraded example (storage timed out, one job stale), answered with HTTP 503:

```json
{
  "status": "degraded",
  "version": "0.1.0",
  "ts": "2026-09-27T16:05:12.345Z",
  "checks": {
    "db": { "status": "ok", "latency_ms": 11 },
    "auth": { "status": "ok", "latency_ms": 7 },
    "storage": { "status": "down", "latency_ms": 3001 },
    "pg_cron": {
      "status": "stale",
      "jobs": [
        { "jobname": "compute-user-scores", "schedule": "0 */6 * * *", "active": true,
          "last_start": "2026-09-26T22:00:00.010Z", "last_status": "succeeded", "stale": true }
      ]
    },
    "webhook": { "last_ingest_at": null }
  }
}
```

## Each check

| Check | Source | Down / stale when |
|---|---|---|
| `db` | A head-only select on `events` through the request's cookie client (count, no rows) | The query returns an error or throws |
| `auth` | `GET <NEXT_PUBLIC_SUPABASE_URL>/auth/v1/health` with the anon key in the `apikey` header | Any status other than 200, or no answer within 3 seconds |
| `storage` | `GET <NEXT_PUBLIC_SUPABASE_URL>/storage/v1/status` with the anon key | Any status other than 200, or no answer within 3 seconds |
| `pg_cron` | `public.cron_job_status()` through the elevated door (service role only; REGISTRY row "Health diagnostics") | A known job's newest run started more than twice its schedule ago |
| `webhook` | The newest `created_at` of an event with `source = 'instagram'`, through the elevated door | Never: informational |

`latency_ms` is the wall time of that probe in milliseconds.

### pg_cron thresholds

| Job | Schedule | Stale after |
|---|---|---|
| `compute-user-scores` | `0 */6 * * *` | 12 hours |
| `send-event-reminders` | `*/15 * * * *` | 30 minutes |
| `send-feedback-requests` | `*/30 * * * *` | 60 minutes |

Each job is listed with `jobname`, `schedule`, `active`, `last_start`, `last_status` and `stale`.
`stale` is `true` or `false` for a job named above that has run, and `null` for a job that has never
run or is not named above. `pg_cron.status` is:

- `stale` when any named job is stale;
- `unknown` when a named job has never run (a fresh local reset, before the first tick), when no named
  job exists, or when `cron_job_status()` cannot be read;
- `ok` otherwise.

**Production says `unknown` until the DI-23 repair.** `cron_job_status()` is created by migration
`20260926120000_async_edge_definer_hardening.sql`, which exists locally only until the Phase 8
migration-history repair (DI-23) applies it to production. Until then PostgREST answers `PGRST202`
(function not found), and the report says `"pg_cron": { "status": "unknown", "jobs": [] }`. That is
expected, never a 500, and does not change the overall status.

### What `webhook.last_ingest_at` means

It is the newest `created_at` among events whose `source` is `instagram`, inserted by **any path**: the
`events-webhook` edge function, a script that inserts rows directly (as the 2026-09-16 import did), or a
manual repair. It is **not** proof that the edge function received and processed a delivery; nothing in
the tree sends to the webhook today (research C1, C23). `null` means no scraper-sourced event exists,
which is the state of the local seed. It has no threshold and never changes the overall status.

## Status rules and HTTP codes

| Overall `status` | When | HTTP |
|---|---|---|
| `down` | `db` is down | 503 |
| `degraded` | `db` is ok and `auth` or `storage` is down, or `pg_cron` is `stale` | 503 |
| `ok` | Everything else, including `pg_cron: unknown` | 200 |

Liveness is always 200. A monitor that wants "is the site serving" can read liveness without a token; a
monitor that should page on a broken dependency needs the token and should alert on 503.

A failing check is logged on the server as one `warn` line, `health check failed`, with `check` and the
failure's code (a Postgres or PostgREST code, `HTTP_<status>`, or the error's name such as
`TimeoutError`). The failure's text is never logged and never returned.

## Setting up HEALTH_TOKEN (owner action, DI-81)

1. Generate a random token of at least 32 characters, for example `openssl rand -hex 32`.
2. Set it as `HEALTH_TOKEN` in the deployment's environment (Vercel project settings, Production and
   Preview as needed). It is a server-only variable: never prefix it with `NEXT_PUBLIC_`.
3. Configure the uptime monitor to send `Authorization: Bearer <token>` to `/api/health` and to alert on
   HTTP 503 (and on no answer).
4. Adding the variable's name to `.env.local.example` is the owner's edit; this plan does not touch that
   file.

`healthToken()` in `src/lib/env.ts` reads the variable at call time. Unset or blank disables the token
arm (admins still see the report through their session). A value shorter than 32 characters also
disables it and writes one warn line per server process that names the variable and the minimum length,
never the value. A bad token never fails boot or a request.

## What was removed (F-029)

Before plan 06-17 any anonymous caller received the full report: the checked table names, a live Azure
OAuth probe with the provider's error text, the names of missing environment variables, heap and RSS
figures, the server's uptime, and a session read that verified nothing. All of those checks are deleted.
The report above is the whole documented shape, and `HealthReport` is a strict schema: a key outside it
fails to parse.
