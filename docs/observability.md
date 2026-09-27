# Observability: logs, request ids and Sentry

Phase 6 (plans 06-12 and 06-16) gave the server three things: one structured
log line per event, a correlation id on every request, and error reporting to
Sentry. This page says what each one does, where to look, and what the owner
has to set up. Decisions: DEC-74 (logger and request id), DEC-76 (Sentry
posture), DEC-61 (the package and its install), DEC-81 (owner items, DI-81).

## 1. The log line

Server code logs through `log` from `src/server/log.ts`, never through raw
`console.*` (the CI step "Server console census" enforces this with
`scripts/check-server-console.mjs`). Each call writes **one** argument, a JSON
string:

```json
{"ts":"2026-09-27T05:46:07.000Z","level":"error","msg":"unhandled route error","requestId":"3f0c…","route":"/api/events","scope":"Middleware","method":"GET","error":{"name":"Error","message":"…"}}
```

| Field | Meaning |
|---|---|
| `ts` | ISO timestamp |
| `level` | `debug`, `info`, `warn` or `error` |
| `msg` | the message, with email-shaped text replaced by `[email]` |
| `requestId` | the request's correlation id (section 2); absent outside a request |
| `route` | the request's pathname, never its query string |
| `scope` | the old `[Prefix]` tag, e.g. `Middleware`, `Config`, `RateLimit`, `Sentry` |
| any other key | the caller's fields, redacted (below) |

**Levels and streams.** `error` and `warn` go to `console.error` (stderr);
`info` and `debug` go to `console.log` (stdout). Vercel captures both.

**Redaction.** Before a line is written:

- a key named `cookie`, `cookies`, `set-cookie`, `authorization`, `password`,
  `token`, `access_token`, `refresh_token`, `email`, `body`, `secret` or
  `apikey` (any case, at any depth) becomes `"[redacted]"`;
- an email-shaped substring anywhere, the message included, becomes `[email]`;
- an `Error` becomes `{ name, message, code }`: no stack, no cause.

A message cannot forge a second line: `JSON.stringify` escapes newlines. The
logger never throws; an unserializable value degrades the line, not the
request.

## 2. The request id

The id's path through a request:

1. **Proxy** (`src/proxy.ts`). The first statement of `proxy()` mints a UUID
   and sets it as `x-request-id` on the *request* headers, overwriting any
   value the client sent (a client-chosen id is never trusted).
2. **Request header.** `NextResponse.next({ request })` forwards it to the
   handler.
3. **Wrapper** (`withRoute`, `src/server/route.ts`). It accepts the incoming
   id only when it is UUID-shaped and the path is covered by the proxy.
   Paths the proxy matcher skips, such as `/auth/callback`, always get a fresh
   id, even when a client sends its own UUID. It runs the
   handler inside `runWithRequest({ requestId, route })`.
4. **Context.** `createRequestContext()` (`src/server/context.ts`) and every
   log line read the same id through `currentRequestId()`.
5. **Response header.** The wrapper and the proxy set `x-request-id` on every
   response they return, errors and redirects included.

**Finding one request's lines.** Take `x-request-id` from the response (the
browser's network tab, or `curl -i`), then filter the Vercel runtime logs for
it, e.g. `vercel logs <deployment> | grep '"requestId":"<id>"'`. The proxy's
lines and the handler's lines carry the same id. In Sentry, search
`request_id:<id>` (section 3).

## 3. Sentry (DEC-76)

`@sentry/nextjs` is pinned exactly at **10.75.3** (DEC-61; v11 is DI-79 because
its unset `dataCollection` collects cookies and bodies by default).

**What is captured.** Errors only (`tracesSampleRate: 0`, no performance
tracing, no session replay):

- every 5xx response from a route wrapped by `withRoute`, including handled
  database failures, through one `captureServerError` call. The wrapper uses
  the request's last logged error cause; `logRouteError(error)` preserves
  causes in local catch and database-error branches. A silent 5xx gets a
  generic action error and a correlated error log without changing its body;
- Next redirects, not-found responses and other framework control-flow errors
  are rethrown without reporting them as application failures;
- a throw in the proxy's ring (its fail-closed 500), the same call;
- errors Next reports to `onRequestError` in `src/instrumentation.ts`
  (Server Components, route handlers, server actions), through Sentry's
  `captureRequestError`;
- unhandled errors in the browser, through `src/instrumentation-client.ts`.

Every server event from the wrapper or the proxy carries the tags
`request_id` (the same id as the `x-request-id` response header) and `route`
(UUID path segments replaced with `[id]`).
Events carry `environment` = `VERCEL_ENV` (default `development`) and
`release` = `VERCEL_GIT_COMMIT_SHA`.

**What is never sent.** `sendDefaultPii: false`, and `beforeSend` scrubs every
event (`src/server/observability/sentry.ts` on the server,
`src/lib/observability/scrub.ts` shared with the browser):

- request cookies, request data (bodies) and the query string are deleted;
- the `cookie` and `authorization` request headers are deleted;
- query strings and fragments are stripped from `Referer`/`Referrer` headers
  regardless of case;
- UUID segments are normalized in request URLs, route tags, Next request
  paths and navigation breadcrumbs;
- email-shaped text in the message, exception values and breadcrumb messages
  becomes `[email]`;
- the user is reduced to `{ id: <hex SHA-256 of the user id> }` on the server,
  and removed entirely in the browser.

The scrubber and the correlation id are proven by
`src/lib/observability/scrub.test.ts` and `src/server/__tests__/sentry.test.ts`
(an in-memory transport, never a real DSN).

**No tunnel route.** A tunnel would add a same-origin endpoint the proxy runs
its session work on for every client event. The browser posts directly to the
DSN's ingest origin, which the CSP `connect-src` admits only when
`NEXT_PUBLIC_SENTRY_DSN` is set at build time.

### Variables

Absent means disabled: nothing is sent, and the server logs exactly one line,
`{"level":"info","msg":"Sentry disabled","scope":"Sentry",…}`, at start. A DSN
that is not an `https://` URL is treated as absent. Boot never fails on these.

| Variable | Where it is read | Purpose |
|---|---|---|
| `SENTRY_DSN` | server, at start (`src/sentry.server.config.ts`) | server events |
| `NEXT_PUBLIC_SENTRY_DSN` | browser build (inlined at build time) | browser events; also admitted in the CSP `connect-src` |
| `SENTRY_AUTH_TOKEN` | build (`withSentryConfig` in `next.config.js`) | source-map upload; without it source maps are disabled and the build still passes |
| `SENTRY_ORG` | build | the organization slug for the upload |
| `SENTRY_PROJECT` | build | the project slug for the upload |

### Why installs set `SENTRYCLI_SKIP_DOWNLOAD=1`

`@sentry/nextjs` pulls in `@sentry/cli@2.58.6`, whose `postinstall` script
(`node ./scripts/install.js`) downloads a platform binary from the network
when the matching optional package (`@sentry/cli-darwin`, `-linux-x64`, …) is
absent. The binary is only used to upload source maps. So every install runs
with `SENTRYCLI_SKIP_DOWNLOAD=1`: locally
(`SENTRYCLI_SKIP_DOWNLOAD=1 npm ci`), and in CI, where
`.github/workflows/ci.yml` sets it at workflow level for every job's `npm ci`.
The optional platform package itself is an ordinary registry tarball pinned by
integrity in `package-lock.json`; it is not a script download.

## 4. Owner setup (DI-81)

None of this is needed to build, test or run the app locally. To turn Sentry
on for deployments:

1. Create a Sentry project (platform: Next.js) in your organization. This
   repository never creates one.
2. In Vercel → Project → Settings → Environment Variables, for Preview and
   Production, set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` to the project's
   DSN (Sentry → Project Settings → Client Keys).
3. Optional, for readable stack traces: set `SENTRY_AUTH_TOKEN` (Sentry →
   Settings → Auth Tokens, scope `project:releases`), `SENTRY_ORG` and
   `SENTRY_PROJECT` for the build. Set `SENTRYCLI_SKIP_DOWNLOAD=1` in Vercel's
   build environment too, so Vercel's install follows the same rule as CI; the
   optional platform package (`@sentry/cli-linux-x64`) supplies the binary the
   upload uses.
4. Redeploy a preview. Trigger an error through a wrapped route and confirm
   the event in Sentry carries tag `request_id` equal to the response's
   `x-request-id`, and has no cookies, body, query string or email in it.
   This is the phase's human-check for REFAC-21's live half.
5. Update `.env.local.example` with the five variable names above (left blank).
   The executing session cannot read that file, so this is the owner's edit.
6. Countersign DEC-60 (zod 4.6.5) and DEC-61 (`@sentry/nextjs` 10.75.3) from
   their legitimacy bundles in
   `.planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/`
   before any push to `main`.
