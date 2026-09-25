# CSRF assessment (REFAC-17, F-090)

**Plan:** 05-17 · **Phase:** 05-slices-3-5-auth-club-authorization-admin-containment · **Recorded:** 2026-09-25

This is REFAC-17's written assessment. It measures the app's cross-site request forgery exposure
against the session cookie attributes as installed. It states the control 05-17 adds (DEC-52) and
names every residual with a severity and an owner. The commands and test output behind each claim
are in `evidence/csrf.txt`.

## 1. The session cookies as installed, and what `SameSite=Lax` does

`@supabase/ssr` 0.7.0 (`node -p "require('@supabase/ssr/package.json').version"`) writes every
auth cookie (`sb-<ref>-auth-token` and its `.0`, `.1` chunks) with `DEFAULT_COOKIE_OPTIONS`, from
`node_modules/@supabase/ssr/dist/main/utils/constants.js` lines 4-11:

```js
exports.DEFAULT_COOKIE_OPTIONS = {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    // https://developer.chrome.com/blog/cookie-max-age-expires
    // https://httpwg.org/http-extensions/draft-ietf-httpbis-rfc6265bis.html#name-cookie-lifetime-limits
    maxAge: 400 * 24 * 60 * 60,
};
```

`node_modules/@supabase/ssr/dist/main/cookies.js` spreads these under the caller's `cookieOptions`
for every set and remove (lines 163-172, 197-200 and 320-329). The app passes no `cookieOptions` to
`createServerClient` or `createBrowserClient`, so the defaults are what ship:

| Attribute | Value | Meaning |
|-----------|-------|---------|
| `SameSite` | `Lax`, set explicitly | see below |
| `HttpOnly` | false | the browser client reads the session from `document.cookie` (e2e `auth.setup.ts`) |
| `Secure` | not set | the browser also sends the cookie over plain http to the same host |
| `Path` | `/` | every path |
| `Max-Age` | 34,560,000 s (400 days) | the browser cap |

The callback's own `needs_onboarding` cookie (`src/app/auth/callback/route.ts:249-254`) is
`HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=3600`.

**What Lax sends.** A browser attaches a Lax cookie to every same-site request. On a cross-site
request it attaches the cookie only to a top-level navigation with a safe method: a link click, a
`window.location` change, or a GET form submission that navigates the tab.

**What Lax withholds.** On a cross-site request the cookie is not sent with a POST form
submission, even a top-level one. It is not sent with any `fetch` or XHR, or with an `<img>`,
`<script>` or `<iframe>` subresource. So a page on another site cannot make a signed-in student's
browser send an authenticated POST, PUT, PATCH or DELETE to this app's `/api/*`. That is why F-090
was never an open hole in a current browser.

**Where Lax stops.** "Site" means the registrable domain, not the origin. A page on a sibling
subdomain of the same registrable domain is same-site, so Lax sends the cookie on its forged POST.
Production runs on Vercel. `vercel.app` is on the Public Suffix List, so each `*.vercel.app`
deployment is its own site. A custom domain with other subdomains would not have that protection.
Lax is also only as good as the browser that enforces it.

## 2. Before 05-17, Lax was the only control

- Next.js route handlers get **no** built-in origin check. Next checks origin only for **Server
  Actions**: "Server Actions in Next.js also compare the Origin header to the Host header (or
  X-Forwarded-Host). If these don't match, the request will be aborted."
  (`node_modules/next/dist/docs/01-app/02-guides/data-security.md`, § "Allowed origins", near
  line 550.)
- This app has no Server Actions. `command grep -rn '"use server"' src` prints nothing and exits 1.
  Every state change is a `/api/*` route handler.
- Before 05-17 no route and no proxy branch read `Origin` or `Sec-Fetch-Site` (F-090, grep exit 1
  on the base commit; DEC-52's evidence). The 05-12 e2e pins proved it on the real stack: a
  signed-in POST carrying `Origin: https://evil.example`, or `Sec-Fetch-Site: cross-site`, was
  answered 200 `{saved:true}` and wrote the row.
- The route handlers also parse a body with `request.json()` whatever its `Content-Type`. So a
  cross-site HTML form with `enctype="text/plain"` could deliver a JSON-shaped body without a
  CORS preflight. The only thing that stopped the forged request carrying a session was the Lax
  cookie.

## 3. The control added in 05-17 (DEC-52)

**Code.** `src/server/csrf.ts` exports `isCrossSiteMutation(req)` (a pure predicate) and
`crossSiteBlocked()` (403 `{"error":"Cross-site request blocked"}`).

**Placement.** `src/proxy.ts` calls it immediately after the rate limiter
(`await applyRateLimit(request, getRateLimitStore())`). It runs before the validated env reads,
before `createServerClient` and before `getUser`. The index order is recorded in
`evidence/csrf.txt`. A refused request costs no Supabase round trip and needs no env. The
matcher is unchanged: every path except static assets, images, `favicon.ico` and
`/auth/callback`, so all of `/api/*` passes through the check.

**What it refuses.** A request to `/api/*` whose method is not GET, HEAD or OPTIONS is refused when
either of these holds:
1. `Sec-Fetch-Site` is `cross-site`. Every current Chromium, Firefox and Safari sends this
   fetch-metadata header, and a page cannot forge it.
2. An `Origin` header is present and its host (`new URL(origin).host`) differs from the request's
   host. The request's host is `x-forwarded-host` (first entry), else `host`, else the URL's
   host, compared lower-case. This is the Server Action rule above, applied to route handlers. It
   also refuses a sibling-subdomain origin that Lax lets through (§1). The literal `null` origin
   (sandboxed frames, some redirect chains) and any origin that does not parse are refused too.
   Browsers send `Origin` on every cross-origin POST, PUT, PATCH and DELETE.

**What it passes on purpose.**
- A same-origin browser request. A real browser POST carries `Origin: <this host>` and
  `Sec-Fetch-Site: same-origin`. `save-and-rsvp.spec.ts` drives the real UI through it.
- A request carrying **neither** `Origin` nor `Sec-Fetch-Site`. A browser acting for a victim on
  another site always sends `Origin` on a mutation, so a header-less mutation is not that attack.
  It is curl, a cron caller, or a server-to-server call, and Phase 6's machine routes (cron,
  webhooks) must keep working. The check never blocks a request that carries neither header
  (plan prohibition).
- Safe methods, and every path outside `/api/`.

**Why it is defence in depth, not a replacement.** Lax already withholds the session from
cross-site mutations in current browsers. The origin check adds an explicit, tested, server-side
decision that does not depend on these things:
- how the browser treats the cookie (the Chrome window in §4.6, older engines, future changes to
  cookie defaults);
- what the cookie attributes are (the deferred `@supabase/ssr` major, DI-43, may change them);
- the registrable-domain boundary (sibling subdomains).

CSRF tokens were rejected in DEC-52, because they need a client change on every form and fetch
for a risk that Lax plus the origin check already bound.

## 4. Residuals

| # | Residual | Severity | Why | Owner |
|---|----------|----------|-----|-------|
| 4.1 | `/invites/[token]` accepts an invitation on **GET** (`src/app/invites/[token]/page.tsx:137-147` inserts `club_members` and marks the invitation `accepted` during render) | Low | The page is a GET outside `/api/`, so neither Lax (a top-level cross-site GET carries the cookie) nor the origin check reaches it. A cross-site link can make a signed-in invitee join a club. But the attacker must already hold the invitation token, which is the secret. RLS pins the invitee's email. The only effect is joining a club the victim was invited to | **DI-41**; the phase owner decides whether to move acceptance behind a confirm button that POSTs through the origin check (a UX change to a Validated workflow, carried to the owner, no code change in Phase 5) |
| 4.2 | `GET /api/recommendations` inserts an `experiment_assignments` row for a signed-in user with no assignment (`src/app/api/recommendations/route.ts:230-234`) | Low (benign) | It is a GET, so the origin check passes it by design. Lax sends the cookie only on a top-level navigation to the JSON endpoint, not on a cross-site `fetch`. The variant is chosen by `pickVariant(user.id, experiment.id, variants)`, a deterministic FNV-1a hash (`src/lib/experiments.ts:25-30`), so a forced request writes exactly the row the user's next visit would write | none needed; travels with DI-41 |
| 4.3 | The `needs_onboarding` cookie | None | Since 05-05 (DEC-36) it is a hint only. The proxy decides onboarding from `users.onboarding_completed` and never reads the cookie, so forging, deleting or keeping it decides nothing | none |
| 4.4 | Browsers that send neither `Sec-Fetch-Site` nor `Origin` on a cross-site POST | Low | Such a request passes the check as a "machine caller". Every engine that still lacks `Sec-Fetch-Site` sends `Origin` on a cross-origin POST, so it is refused by rule 2. What is left is engines that predate both headers, where only the cookie's `SameSite` handling applies | accepted; no owner action |
| 4.5 | The auth cookies carry no `Secure` attribute (and are not `HttpOnly`) | Low for CSRF | Without `Secure` the browser would send the cookie over plain http to the same host after a downgrade. `next.config.js:37-38` sends `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, so after the first https visit the browser never makes that request. `HttpOnly: false` is an XSS-exposure attribute, not a CSRF one, and the browser client needs it. Changing the cookie options belongs to the `@supabase/ssr` 0.7 → 0.12 major | **DI-43** |
| 4.6 | Chrome's "Lax + POST" two-minute exception (research A3) | Low | Chrome's Lax-by-default rollout let a cookie that had **no** `SameSite` attribute ride a cross-site top-level POST for two minutes after it was set. `@supabase/ssr` sets `SameSite=Lax` explicitly, so the exception should not apply [ASSUMED, research A3]. The origin check refuses such a POST either way, because it carries `Origin` and `Sec-Fetch-Site: cross-site` | covered by the check; no owner action |
| 4.7 | Non-`/api` POST routes: `POST /auth/signout` | Low | The origin check covers `/api/*` only. A cross-site POST to `/auth/signout` is a top-level cross-site POST, so Lax withholds the cookie and there is no session to end. The worst case in a browser that ignores Lax is a forced sign-out, which is a nuisance, not a state change on the victim's data | accepted; no owner action |

No residual is Medium or above. None needs a code change in Phase 5.

## 5. The tests that prove each arm

Unit: `src/server/__tests__/csrf.test.ts` (41 cases).

| Arm | Cases |
|-----|-------|
| Safe methods never checked | GET, HEAD, OPTIONS carrying `Sec-Fetch-Site: cross-site` and a foreign `Origin` → false |
| Non-`/api` paths never checked | `/profile`, `/auth/signout`, `/api`, `/apix/events` → false |
| `Sec-Fetch-Site: cross-site` refused | POST, PUT, PATCH, DELETE, lower-case `patch` → true; also with a matching `Origin` |
| Foreign `Origin` refused | against the URL's host, the `host` header, another port, and a lookalike suffix host |
| `x-forwarded-host` wins | an `Origin` matching only `host` → true; matching `x-forwarded-host` (single or listed first) → false |
| Opaque or unparseable `Origin` refused | `null`, `not a url`, `://`, `evil.example` → true |
| Same-origin passes | against the URL's host, the `host` header (case-insensitive), `x-forwarded-host` |
| `Sec-Fetch-Site` same-origin, none or same-site with a matching or absent `Origin` passes | → false; same-site with a sibling-host `Origin` → true |
| Header-less machine callers pass | POST, PUT, PATCH, DELETE to a user route and to `/api/cron/send-reminders` → false |
| The 403 | `crossSiteBlocked()` → 403 JSON `{"error":"Cross-site request blocked"}` |
| Proxy placement | a cross-site POST through `proxy()` → 403 with `createServerClient` never called, and still 403 with the env removed; a same-origin or header-less POST reaches session work; the 31st cross-site POST from one address is answered 429 (rate limit first) |

Mutation check (`evidence/csrf.txt` §3): each of six source mutations (drop the `Sec-Fetch-Site`
arm; block header-less callers; pass a `null` Origin; treat only GET as safe; ignore
`x-forwarded-host`; remove the proxy call) turns the suite red. Each was restored cmp-identical.

Browser, on the real stack (`e2e/specs/csrf-origin.spec.ts`, after a clean reset and seed):
- FIXED F-090 ×2: `Origin: https://evil.example`, and `Sec-Fetch-Site: cross-site`, are each
  answered 403 `{"error":"Cross-site request blocked"}`, and no saved row is written.
- PRESERVE ×2: the application's own `Origin`, and neither header, are accepted and restored.
- `e2e/specs/save-and-rsvp.spec.ts`: a real Chromium save and RSVP (same-origin `fetch`, carrying
  `Origin` and `Sec-Fetch-Site: same-origin`) pass unedited.

The PRESERVE proxy suites (`src/proxy-characterization.test.ts`, `src/proxy.test.ts`) and
`src/proxy-defect.test.ts` send neither header and pass unedited.
