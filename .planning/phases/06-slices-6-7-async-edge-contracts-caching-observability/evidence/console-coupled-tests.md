# Console-coupled tests: the logger sweep's worklist (plan 06-07, C26)

Measured at HEAD `830c0ba` (the tree after 06-07's two test commits, whose source is identical to `f550de9`).
Command: `command grep -rn "spyOn(console" src e2e` (exit 0). `e2e/` has no site.

Each row is one `spyOn(console` site. The columns are:

- **Kind.**
  - A: the spy is silenced (`mockImplementation`) and never asserted, or it is asserted only by call presence or count (`toHaveBeenCalled`, `toHaveBeenCalledTimes`, `not.toHaveBeenCalled`). The logger writes through `console.error` (levels error and warn) and `console.log` (levels info and debug) (research C26, Pattern 4). So an A site keeps working with no edit.
  - B: the assertion depends on the argument text. That covers `toHaveBeenCalledWith("[X] …", obj)`, `mock.calls[0][0]` against a `[Prefix]` regex, and `String(c[0]).startsWith/includes(...)`. A JSON line breaks it: the first argument becomes one serialized object, and a `[Prefix] ` or an argument pair no longer exists.
- **Characterization suite.** Whether `scripts/check-characterization-tags.mjs --all` discovers the file: its name ends in `-characterization`/`-defect`, or its leading docblock says "characterization". The file's tag follows in brackets.
- **Planned move.** B in a PRESERVE file: the file is not edited. The assertion moves to a new `-defect` file citing F-058, with a defect-ledger row in the converting plan. B in a DEFECT or untagged file: edited in place to parse the JSON line and assert `msg`, `level` and the fields. A: none.

Rows are grouped by the plan that converts the source the test exercises:

- 06-12: the proxy, `instrumentation`, `src/server/**` and `src/lib/audit.ts`.
- 06-13: the admin, moderation, clubs, organizer-requests and my-clubs routes.
- 06-14: everything else.

Suites whose arms span families are grouped under "06-13/06-14". All of them are kind A, so no edit is owed.

## Totals, compared with research

| Measure | Research C26 / § F (at `f215fb7`, the phase's before-floor) | Measured now |
|---|---|---|
| Files | 42 | **56** |
| `spyOn(console` sites | 68 | **110** |
| Kind A | — | 97 |
| Kind B | "several" (named: proxy-defect :213/:241, instrumentation :113/:220/:248, audit-shape :327, the callback suites) | 13 sites in 11 files |

**Delta: +14 files and +42 sites, fully explained.** Re-counting at `f215fb7` gives exactly 42 files and 68 sites, so research's figure was right for its tree. Since then, 14 files have been added, each with one `beforeEach` that silences `error`, `log` and `warn` (3 sites each, all kind A):

- 8 by 06-02:
  - `admin-reports-defect`
  - `interactions-feedback-characterization`
  - `notifications-characterization`
  - `notifications-count-defect`
  - `experiment-assignment-defect`
  - `recommendations-characterization`
  - `recommendations-family-characterization`
  - `slice6-malformed-input-defect`
- 6 by this plan:
  - `bad-request-characterization`
  - `malformed-input-defect`
  - `error-text-defect`
  - `uncaught-throw-defect`
  - `cache-headers-defect`
  - `health-defect`

At `f550de9` the count was 92 sites in 50 files.

**Correction to research's named list.** The two callback suites (`src/app/auth/callback/route.test.ts:188-189`, `route-defect.test.ts:182-183`) only silence `log` and `error`. Neither asserts on either spy, so they are **A**, not B. `audit-shape.test.ts:339` is A (`not.toHaveBeenCalled`, :349). Only its `:312` spy is B.

**B by plan:** 06-12 has 8 sites in 7 files, 06-13 has 2 in 2, and 06-14 has 3 in 2.

B sites by tag:
- PRESERVE-tagged: the two `src/lib/eventTags.test.ts` sites. The tag gate does not discover this file (no "characterization" word, no suffix), but its docblock says PRESERVE, so it is treated as one. It is not edited: the two `[tags]` warning assertions move to a `-defect` file in 06-14.
- DEFECT: `proxy-defect.test.ts:183` and `audit-shape.test.ts:312`, edited in place.
- Untagged: the other nine, edited in place.

## Notes the converting plans need

1. **warn becomes console.error.** The logger maps `warn` onto `console.error`. The three B sites that spy on `console.warn` go silent on that spy, rather than receiving different text, and must spy on `console.error` after the sweep:
   - `upstashStore.test.ts:96` (MEMORY_WARNING)
   - `eventTags.test.ts:190`
   - `eventTags.test.ts:267`

   A files that silence `warn` but not `error` become noisier, but they do not fail.
2. **Secret-exclusion checks stay meaningful.** Examples: `instrumentation.test.ts:297/:311`, `proxy-ratelimit-failopen.test.ts:79/:90`, `selection.test.ts:56`. A JSON line must still not carry the secret, so these become assertions that `redact` works. Keep them.
3. **`proxy-ratelimit-failopen.test.ts:79`** asserts that the stringified calls contain `"TypeError"`. It survives only if the logger serializes the error's `name`. 06-12 decides whether to do that or to edit the assertion.
4. **`tag-coercion-defect.test.ts:62`** asserts that `mapTags` logs nothing on any of the five methods. The `[tags]` warn lives in `transformEventFromDB` (`src/lib/tagMapping.ts:97`), not in `mapTags`, so the sweep does not touch this assertion.
5. **`src/components/ErrorBoundary.test.tsx:43`** is a client component. Client `console.*` is kept (research § F), so this site is unaffected whichever plan runs.

## The sites


### Converted by 06-12

| # | Site | Spied | Kind | What it asserts | Characterization suite (gate discovery) | Planned move |
|---|---|---|---|---|---|---|
| 1 | `src/__tests__/api/review05/fanout-after.test.ts:51` | error | B | `String(c[0]).includes("[afterResponse] task failed")` :107 | no (untagged) | edited in place in 06-12: parse the JSON line and assert `msg`, `level` and the fields |
| 2 | `src/__tests__/moderation/audit-shape.test.ts:312` | error | B | `toHaveBeenCalledWith("[Audit] admin_audit_log insert rejected", {action,targetType,targetId,…})` :327 | yes (DEFECT) | edited in place in 06-12: parse the JSON line and assert `msg`, `level` and the fields |
| 3 | `src/__tests__/moderation/audit-shape.test.ts:339` | error | A | call presence/count only | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 4 | `src/instrumentation.test.ts:63` | error | B | `toHaveBeenCalledWith("[Config] refusing to start:", …)` :113, :220, :248; `mock.calls[0][0]` matches `/^\[RateLimit\] /` :195, :282; no secret :297, :311 | no (untagged) | edited in place in 06-12: parse the JSON line and assert `msg`, `level` and the fields |
| 5 | `src/proxy-defect.test.ts:183` | error | B | `toHaveBeenCalledWith("[Middleware] Error:", objectContaining({name:"MissingEnvError"}))` :213 and `("[Middleware] Error:", failure)` :241 | yes (DEFECT) | edited in place in 06-12: parse the JSON line and assert `msg`, `level` and the fields |
| 6 | `src/proxy-ratelimit-failopen.test.ts:45` | error | B | `JSON.stringify(mock.calls)` contains "TypeError" and not the secret :79, :90 (content) | no (untagged) | edited in place in 06-12: parse the JSON line and assert `msg`, `level` and the fields |
| 7 | `src/server/ratelimit/selection.test.ts:36` | error | B | `String(mock.calls[0][0])` matches `/^\[RateLimit\] /` :96; stringified calls exclude secrets :56 | no (untagged) | edited in place in 06-12: parse the JSON line and assert `msg`, `level` and the fields |
| 8 | `src/server/ratelimit/selection.test.ts:37` | warn | A | silenced; its calls join the secret-exclusion check at :56 (content exclusion only, survives a JSON line) | no (untagged) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 9 | `src/server/ratelimit/upstashStore.test.ts:95` | error | B | `toHaveBeenCalledWith("[RateLimit] store timeout; request allowed", {key,…})` :232 and `"[RateLimit] store error; request allowed"` :247 | no (untagged) | edited in place in 06-12: parse the JSON line and assert `msg`, `level` and the fields |
| 10 | `src/server/ratelimit/upstashStore.test.ts:96` | warn | B | `toHaveBeenCalledWith(MEMORY_WARNING)` :336 (the exact warning string) | no (untagged) | edited in place in 06-12: parse the JSON line and assert `msg`, `level` and the fields |

### Converted by 06-13

| # | Site | Spied | Kind | What it asserts | Characterization suite (gate discovery) | Planned move |
|---|---|---|---|---|---|---|
| 11 | `src/__tests__/api/admin/admin-guard-characterization.test.ts:100` | error | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 12 | `src/__tests__/api/admin/admin-guard-characterization.test.ts:101` | log | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 13 | `src/__tests__/api/admin/admin-guard-characterization.test.ts:102` | warn | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 14 | `src/__tests__/api/admin/admin-guard-defect.test.ts:199` | error | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 15 | `src/__tests__/api/admin/admin-guard-defect.test.ts:200` | log | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 16 | `src/__tests__/api/admin/admin-guard-defect.test.ts:201` | warn | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 17 | `src/__tests__/api/admin/admin-reports-defect.test.ts:60` | error | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 18 | `src/__tests__/api/admin/admin-reports-defect.test.ts:61` | log | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 19 | `src/__tests__/api/admin/admin-reports-defect.test.ts:62` | warn | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 20 | `src/__tests__/api/admin/admin-users-patch-defect.test.ts:105` | error | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 21 | `src/__tests__/api/clubs/club-gates-characterization.test.ts:631` | error | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 22 | `src/__tests__/api/clubs/club-owner-writes-defect.test.ts:126` | error | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 23 | `src/__tests__/api/review05/admin-edits-whitelist.test.ts:53` | error | A | silenced (mockImplementation), never asserted | no (untagged) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 24 | `src/__tests__/api/review05/admin-event-notification.test.ts:45` | error | B | `String(c[0]).includes(fragment)` helper :71 | no (untagged) | edited in place in 06-13: parse the JSON line and assert `msg`, `level` and the fields |
| 25 | `src/__tests__/api/review05/admin-reban.test.ts:54` | error | A | silenced (mockImplementation), never asserted | no (untagged) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 26 | `src/__tests__/api/review05/admin-review-once.test.ts:49` | error | A | silenced (mockImplementation), never asserted | no (untagged) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 27 | `src/__tests__/api/review05/club-links.test.ts:43` | error | A | silenced (mockImplementation), never asserted | no (untagged) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 28 | `src/__tests__/api/review05/club-transfer.test.ts:80` | error | B | `String(c[0]).startsWith("[clubs/transfer] audit insert failed")` :117 | no (untagged) | edited in place in 06-13: parse the JSON line and assert `msg`, `level` and the fields |
| 29 | `src/__tests__/api/review05/json-body.test.ts:49` | error | A | silenced (mockImplementation), never asserted | no (untagged) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 30 | `src/__tests__/api/service-role-routing.test.ts:245` | error | A | silenced (mockImplementation), never asserted | no (PRESERVE+DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 31 | `src/__tests__/api/service-role-routing.test.ts:246` | log | A | silenced (mockImplementation), never asserted | no (PRESERVE+DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 32 | `src/__tests__/api/service-role-routing.test.ts:247` | warn | A | silenced (mockImplementation), never asserted | no (PRESERVE+DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |

### Converted by 06-13/06-14 (spans families)

| # | Site | Spied | Kind | What it asserts | Characterization suite (gate discovery) | Planned move |
|---|---|---|---|---|---|---|
| 33 | `src/__tests__/api/auth-ring/write-handlers-characterization.test.ts:91` | error | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 34 | `src/__tests__/api/auth-ring/write-handlers-characterization.test.ts:92` | warn | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 35 | `src/__tests__/api/auth-ring/write-handlers-characterization.test.ts:93` | log | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 36 | `src/__tests__/api/auth-ring/write-handlers-ring-defect.test.ts:147` | error | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 37 | `src/__tests__/api/auth-ring/write-handlers-ring-defect.test.ts:148` | warn | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 38 | `src/__tests__/api/auth-ring/write-handlers-ring-defect.test.ts:149` | log | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 39 | `src/__tests__/api/cache-headers-defect.test.ts:84` | error | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 40 | `src/__tests__/api/cache-headers-defect.test.ts:85` | log | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 41 | `src/__tests__/api/cache-headers-defect.test.ts:86` | warn | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 42 | `src/__tests__/api/error-text-defect.test.ts:106` | error | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 43 | `src/__tests__/api/error-text-defect.test.ts:107` | log | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 44 | `src/__tests__/api/error-text-defect.test.ts:108` | warn | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 45 | `src/__tests__/api/uncaught-throw-defect.test.ts:104` | error | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 46 | `src/__tests__/api/uncaught-throw-defect.test.ts:105` | log | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 47 | `src/__tests__/api/uncaught-throw-defect.test.ts:106` | warn | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 48 | `src/__tests__/contracts/bad-request-characterization.test.ts:88` | error | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 49 | `src/__tests__/contracts/bad-request-characterization.test.ts:89` | log | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 50 | `src/__tests__/contracts/bad-request-characterization.test.ts:90` | warn | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 51 | `src/__tests__/contracts/malformed-input-defect.test.ts:93` | error | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 52 | `src/__tests__/contracts/malformed-input-defect.test.ts:94` | log | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 53 | `src/__tests__/contracts/malformed-input-defect.test.ts:95` | warn | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |

### Converted by 06-14

| # | Site | Spied | Kind | What it asserts | Characterization suite (gate discovery) | Planned move |
|---|---|---|---|---|---|---|
| 54 | `src/__tests__/api/events/anonymous-personalized-defect.test.ts:137` | error | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 55 | `src/__tests__/api/events/ban-asymmetry-defect.test.ts:90` | error | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 56 | `src/__tests__/api/events/ban-asymmetry-defect.test.ts:91` | warn | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 57 | `src/__tests__/api/events/calendar-events-characterization.test.ts:164` | error | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 58 | `src/__tests__/api/events/calendar-events-characterization.test.ts:165` | warn | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 59 | `src/__tests__/api/events/club-fabrication-defect.test.ts:143` | error | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 60 | `src/__tests__/api/events/club-fabrication-defect.test.ts:144` | warn | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 61 | `src/__tests__/api/events/events-detail-characterization.test.ts:180` | error | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 62 | `src/__tests__/api/events/events-detail-characterization.test.ts:181` | warn | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 63 | `src/__tests__/api/events/events-list-characterization.test.ts:210` | error | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 64 | `src/__tests__/api/events/events-list-characterization.test.ts:211` | warn | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 65 | `src/__tests__/api/events/friends-defect.test.ts:186` | error | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 66 | `src/__tests__/api/events/pagination-contract-defect.test.ts:167` | error | A | silenced (mockImplementation), never asserted | yes (PRESERVE+DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 67 | `src/__tests__/api/events/pagination-contract-defect.test.ts:168` | warn | A | silenced (mockImplementation), never asserted | yes (PRESERVE+DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 68 | `src/__tests__/api/events/pending-edits-defect.test.ts:117` | error | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 69 | `src/__tests__/api/events/rsvp-characterization.test.ts:202` | error | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 70 | `src/__tests__/api/events/rsvp-characterization.test.ts:203` | warn | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 71 | `src/__tests__/api/events/save-characterization.test.ts:123` | error | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 72 | `src/__tests__/api/events/save-characterization.test.ts:124` | warn | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 73 | `src/__tests__/api/events/saved-events-characterization.test.ts:178` | error | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 74 | `src/__tests__/api/events/saved-events-characterization.test.ts:179` | warn | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 75 | `src/__tests__/api/events/search-escaping-defect.test.ts:127` | error | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 76 | `src/__tests__/api/events/search-escaping-defect.test.ts:128` | warn | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 77 | `src/__tests__/api/health/health-defect.test.ts:81` | error | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 78 | `src/__tests__/api/health/health-defect.test.ts:82` | log | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 79 | `src/__tests__/api/health/health-defect.test.ts:83` | warn | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 80 | `src/__tests__/api/interactions/interactions-feedback-characterization.test.ts:52` | error | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 81 | `src/__tests__/api/interactions/interactions-feedback-characterization.test.ts:53` | log | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 82 | `src/__tests__/api/interactions/interactions-feedback-characterization.test.ts:54` | warn | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 83 | `src/__tests__/api/notifications/notifications-characterization.test.ts:54` | error | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 84 | `src/__tests__/api/notifications/notifications-characterization.test.ts:55` | log | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 85 | `src/__tests__/api/notifications/notifications-characterization.test.ts:56` | warn | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 86 | `src/__tests__/api/notifications/notifications-count-defect.test.ts:38` | error | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 87 | `src/__tests__/api/notifications/notifications-count-defect.test.ts:39` | log | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 88 | `src/__tests__/api/notifications/notifications-count-defect.test.ts:40` | warn | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 89 | `src/__tests__/api/recommendations/experiment-assignment-defect.test.ts:74` | error | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 90 | `src/__tests__/api/recommendations/experiment-assignment-defect.test.ts:75` | log | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 91 | `src/__tests__/api/recommendations/experiment-assignment-defect.test.ts:76` | warn | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 92 | `src/__tests__/api/recommendations/recommendations-characterization.test.ts:80` | error | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 93 | `src/__tests__/api/recommendations/recommendations-characterization.test.ts:81` | log | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 94 | `src/__tests__/api/recommendations/recommendations-characterization.test.ts:82` | warn | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 95 | `src/__tests__/api/recommendations/recommendations-family-characterization.test.ts:81` | error | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 96 | `src/__tests__/api/recommendations/recommendations-family-characterization.test.ts:82` | log | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 97 | `src/__tests__/api/recommendations/recommendations-family-characterization.test.ts:83` | warn | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 98 | `src/__tests__/api/review05/notifications-door.test.ts:44` | error | B | `String(c[0]).includes("invite notifications" | "follow notifications")` :128, :189, :204 (count of matching lines), :269 | no (untagged) | edited in place in 06-14: parse the JSON line and assert `msg`, `level` and the fields |
| 99 | `src/__tests__/api/slice6-malformed-input-defect.test.ts:56` | error | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 100 | `src/__tests__/api/slice6-malformed-input-defect.test.ts:57` | log | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 101 | `src/__tests__/api/slice6-malformed-input-defect.test.ts:58` | warn | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 102 | `src/__tests__/lib/tag-coercion-defect.test.ts:62` | log, info, warn, error, debug (one map) | A | `not.toHaveBeenCalled()` on all five :109 (`mapTags` stays silent) | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 103 | `src/app/api/events/route.test.ts:220` | error | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 104 | `src/app/auth/callback/route-defect.test.ts:182` | log | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 105 | `src/app/auth/callback/route-defect.test.ts:183` | error | A | silenced (mockImplementation), never asserted | yes (DEFECT) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 106 | `src/app/auth/callback/route.test.ts:188` | log | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 107 | `src/app/auth/callback/route.test.ts:189` | error | A | silenced (mockImplementation), never asserted | yes (PRESERVE) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 108 | `src/components/ErrorBoundary.test.tsx:43` | error | A | silenced (mockImplementation), never asserted | no (untagged) | none: the logger writes through console.error/console.log, so silencing and call-count assertions keep working |
| 109 | `src/lib/eventTags.test.ts:190` | warn | B | `toHaveBeenCalledWith(stringMatching(/^\[tags\] /), {eventId:"evt-proto", unmapped:["__proto__"]})` :195 | no (PRESERVE) | PRESERVE file, not edited: the exact-argument assertion moves to a new `-defect` file citing F-058, with a defect-ledger row in 06-14 |
| 110 | `src/lib/eventTags.test.ts:267` | warn | B | `toHaveBeenCalledWith(stringMatching(/^\[tags\] /), {eventId:"evt-tech", unmapped:["tech"]})` :279 | no (PRESERVE) | PRESERVE file, not edited: the exact-argument assertion moves to a new `-defect` file citing F-058, with a defect-ledger row in 06-14 |
