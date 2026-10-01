---
phase: 06-slices-6-7-async-edge-contracts-caching-observability
plan: 03
subsystem: async-edge
status: complete
tags: [cron, webhook, hmac, replay, content-hash, zod, eslint-boundary, ratchet, deno, F-002, F-037, F-039, F-040, DEC-60, DEC-63, DEC-64, REFAC-14, REFAC-15]
requires:
  - phase: 06-slices-6-7-async-edge-contracts-caching-observability
    provides: "06-01: zod-legitimacy.txt bundle (INTEGRITY line), DEC-60/63/64, defect-ledger.md; 06-02: slice-6-characterization.txt § 3 (17-row webhook table) and § 4 (cron caller census)"
provides:
  - "Deletion of both /api/cron/* handlers; the ESLint ratchet override block removed; eslint.elevated-allowlist.mjs = [] (regenerates byte-identically); ratchet PASSes committed=0 live=0 and still fails on any new entry"
  - "zod 4.6.5 as an exact production dependency, installed only after the live integrity matched the 06-01 bundle; the dev-tree 4.1.13 dedupes onto it"
  - "supabase/functions/_shared/webhook-signature.ts: verifySignature(rawBody, header, secret) with a byte-length check before timingSafeEqual"
  - "supabase/functions/_shared/webhook-contract.ts: WebhookEvent, WebhookPayload (today's messages, validateEvent's order and truthiness), webhookEventErrors, webhookPayloadError, WEBHOOK_MESSAGES"
  - "supabase/functions/_shared/webhook-handler.ts: handleWebhook(req, deps) with the insert injected, content_hash on every row, 23505 -> per-event 'duplicate'"
  - "supabase/functions/_shared/contentHash.ts: byte-identical, parity-tested copy of src/lib/contentHash.ts"
  - "src/contracts/webhook.ts: re-export of the contract only (never the signature or handler modules)"
  - "Four Jest suites under src/__tests__/webhook/ (118 tests): signature, contract (with a tsc-enforced ExtractedEvent drift guard), handler (the 17-row table), content-hash parity"
  - "evidence/cron-deletion.txt, zod-install.txt, webhook.txt; two F-039 rows in defect-ledger.md"
affects: [06-04, 06-05, 06-06, 06-15, 06-18]
tech-stack:
  added: ["zod 4.6.5 (exact)"]
  patterns:
    - "Deno-free _shared modules imported by both the edge function (relative .ts paths, deno.json import map) and Jest; the root tsconfig carries allowImportingTsExtensions so tsc accepts the Deno-style imports"
    - "Thin Deno adapter: index.ts reads Deno.env, builds the service-role client lazily inside the injected insert, and delegates every request to handleWebhook"
    - "zod schemas that reproduce hand-written validators byte for byte: one `error` string per rule, `abort: true` to stop a second message, z.custom for truthiness-based optionals, key order = check order"
key-files:
  created:
    - supabase/functions/_shared/webhook-signature.ts
    - supabase/functions/_shared/webhook-contract.ts
    - supabase/functions/_shared/webhook-handler.ts
    - supabase/functions/_shared/contentHash.ts
    - src/contracts/webhook.ts
    - src/__tests__/webhook/verify-signature.test.ts
    - src/__tests__/webhook/webhook-contract.test.ts
    - src/__tests__/webhook/webhook-handler.test.ts
    - src/__tests__/webhook/content-hash-parity.test.ts
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/cron-deletion.txt
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/zod-install.txt
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/webhook.txt
  modified:
    - eslint.config.mjs
    - eslint.elevated-allowlist.mjs
    - scripts/check-elevated-ratchet.mjs
    - package.json
    - package-lock.json
    - tsconfig.json
    - src/lib/classifier.ts
    - supabase/functions/events-webhook/index.ts
    - supabase/functions/events-webhook/deno.json
    - supabase/functions/tests/webhook.test.ts
    - .planning/phases/06-slices-6-7-async-edge-contracts-caching-observability/evidence/defect-ledger.md
  deleted:
    - src/app/api/cron/send-reminders/route.ts
    - src/app/api/cron/send-feedback-requests/route.ts
decisions:
  - "Webhook rows 7, 11 and 12 (JSON null body, null events[] element, non-string tag) stay 500. The plan names exactly two intentional changes; making these 400s is the webhook's share of F-094 and is left to the plan that owns F-094's 400 moves"
  - "The handler keeps today's header selection (only x-hub-signature-256 has sha256= stripped) and refuses a selected signature still starting with sha256=, so the set of accepted inputs is exactly today's, now with 401 instead of 500 for the wrong-length ones"
  - "tsconfig.json gains allowImportingTsExtensions (noEmit is already true) so the Deno-style ./x.ts imports in _shared type-check in the root program; next build passes and does not rewrite it"
  - "The injected insert returns { data, error }, not only { error }: the 200/207 bodies echo the inserted rows as today's insert().select().single() did"
metrics:
  duration: "14 min (this session; Task 1 was begun by an earlier executor)"
  completed: "2026-09-26"
  tasks: 3
  files: 25
---

# Phase 6 Plan 03: Credential the Async Edge Summary

**The async edge no longer has an uncredentialed HTTP entry. Both dead `/api/cron/*` handlers are deleted, and the ESLint service-role boundary now covers all of `src/**` with an empty ratchet (committed=0 live=0). zod 4.6.5 is installed on its verified tarball. The events-webhook's signature check, payload contract and dedupe are now Deno-free shared modules that Jest proves: a wrong-length signature answers 401 instead of 500, and a replayed payload is reported per event as `duplicate`. Both changes take effect when the owner redeploys the function (DI-81).**

## What was done

**Task 1: delete the dead cron handlers** (`ffd973e`, resumed from an uncommitted start)
- Kept the earlier executor's work after checking it against the plan. That work was the two `git rm` deletions, the removed override block and import in `eslint.config.mjs`, the empty `eslint.elevated-allowlist.mjs`, and the ratchet's empty-list rendering and empty PASS line.
- Confirmed that the ratchet's new-entry FAIL branch runs before the empty PASS branch, so the failure is not weakened. Confirmed that `--write` regenerates the allow-list byte-identically.
- `npx tsc --noEmit` had failed on two stale `.next/types/validator.ts` entries. `npx next typegen`, which the installed Next 16 docs describe, fixed it; `npm run build` was not needed.
- Recorded proofs: lint exit 0; a scratch service-module import fails the boundary and is removed; ratchet `committed=0 live=0 delta=0`; allow-list length 0; `test ! -e src/app/api/cron`; full Jest 95 suites / 1769 tests passed (1 suite and 1 test skipped); `endpoints.json` left for 06-15.

**Task 2: zod, then the contract and signature, red first** (`097e928`, `db839a7`)
- The live `npm view zod@4.6.5 dist.integrity` matched the bundle's INTEGRITY line before the install.
- Installed with `npm install --save-exact zod@4.6.5`. The lockfile diff is 8 lines: the root dependency, and `node_modules/zod` moving 4.1.13 (dev) to 4.6.5. The eslint-plugin-react-hooks copy deduped because its range `^3.25.0 || ^4.0.0` allows 4.6.5. `npm audit --audit-level=high --omit=dev` exits 0.
- `verify-signature.test.ts` and `webhook-contract.test.ts` failed first (modules absent), then passed (59 tests).
- `verifySignature` compares UTF-8 byte lengths before `timingSafeEqual`, so an upper-case digest is still rejected, as it is today.
- The contract reproduces validateEvent's six messages, their order and its truthiness rules: a falsy category or time passes, `""` is "date is required", and a whitespace-only title fails.
- The `ExtractedEvent` drift guard is a type-level assertion. A mutation (`title: number`) makes `npx tsc --noEmit` fail at the assertion. It is not caught under Jest, because ts-jest runs transpile-only here.
- `classifier.ts`: only the stale pipeline comment changed.

**Task 3: handleWebhook, content_hash, replay, the thin adapter** (`239b7cd`)
- The handler suite failed first (module absent). The parity suite was green from the start because it guards a copy that already existed.
- After the handler landed, 118 webhook tests passed.
- The handler suite reproduces all 17 rows of the characterization table. It adds the wrong-length 401 (8 cases), the replay (4 cases: full, cross-header, mixed → 207, edited description), header precedence, and the full mapped row shape.
- Two mutation checks went red and were restored with `cmp`: M1 removed the length check (6 rows red), and M2 dropped `content_hash` (6 rows red). The fake's index is partial, like the real one.
- `index.ts` is now about 50 lines: `Deno.serve` → `handleWebhook(req, { secret, configured, insertEvent })`, with the service client created on the first insert. It contains no `timingSafeEqual`.
- `deno.json` maps `zod` to `npm:zod@4.6.5`.
- The Deno suite was updated: its old "Invalid signature" test sent a 23-character signature and was already failing (500). Added a right-length test, a replay test and a `content_hash` assertion. It was not run, because Deno is absent.
- Two F-039 rows were added to the defect ledger, with hash `239b7cd`.

## Floor after this plan

| Check | Result |
|---|---|
| `npx jest --ci` | 99 passed, 1 skipped; 1887 tests passed, 1 skipped; exit 0 (4 suites and 118 tests more than the start) |
| `npx jest --ci src/__tests__/webhook` | 4 suites, 118 tests, exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | 0 errors, 18 warnings (the pre-existing set) |
| `node scripts/check-elevated-ratchet.mjs` | `committed=0 live=0 delta=0`, PASS, exit 0 |
| `npm audit --audit-level=high --omit=dev` | exit 0 (2 pre-existing moderates) |
| `npm run build` | exit 0 (run once, after the tsconfig change) |
| `node -p "require('./package.json').dependencies.zod"` | `4.6.5` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `allowImportingTsExtensions` added to `tsconfig.json`**
- **Found during:** Task 3
- **Issue:** `webhook-handler.ts` must import its siblings as `./x.ts` for the Deno runtime, and tsc type-checks it through the test's import graph. Without the flag, tsc fails with TS5097 on all three imports.
- **Fix:** One line in `tsconfig.json`. It is valid because `noEmit` is already true. tsc, Jest (ts-jest) and `npm run build` all pass, and `next build` does not rewrite the file.
- **Files modified:** tsconfig.json
- **Commit:** `239b7cd`

**2. [Rule 1 - Correctness] Header prefix guard in the handler**
- **Found during:** Task 3
- **Issue:** The plan's `verifySignature` strips a `sha256=` prefix, but today only `x-hub-signature-256` is stripped. Calling it unguarded would newly accept `sha256=<digest>` on `x-signature` and `x-webhook-signature`. That would be a third behaviour change, and it contradicts characterization row 5, which expects 401.
- **Fix:** The handler keeps today's header selection and refuses a selected signature that still starts with `sha256=`. The accepted inputs are exactly today's.
- **Commit:** `239b7cd`

**3. [Plan detail] The injected insert returns `{ data, error }`**
- The plan wrote the dependency as `Promise<{ error }>`. Today's 200 and 207 bodies echo the inserted rows (`insert().select().single()`), so `data` is needed to reproduce them.

### Acceptance-criterion note (not a deviation in behaviour)
- The criterion says `command grep -rnE 'CRON_SECRET|ADMIN_API_KEY|ADMIN_EMAILS' src` "prints nothing", but it still prints hits.
- Every hit is in a characterization or defect test (env fixture names and comments) or in a comment in the test helper `adminArmTable.ts`. No production source reads any of the three names, so F-040's last clause (no reader) holds.
- The test files are PRESERVE characterization and were not edited to satisfy a grep (constraint 2). The evidence is in `cron-deletion.txt` § 3–4.

## Issues

- The resumed state was exactly as described. Nothing had to be redone; the only fix needed was the typegen regeneration.
- `state.add-decision` rejected `--summary-file` paths in the session scratchpad ("Path escapes allowed directory"). The second attempt wrote the files under the gitignored `.planning/research/.cache/` and succeeded for all three decisions; the files were then removed. Every other state call succeeded first time.

## Requirements

REFAC-14 and REFAC-15 are **not** marked complete. This plan closes only REFAC-14's credential clause for the cron and webhook routes, plus the webhook's slice of REFAC-15. The rest continues in 06-04, 06-05 and 06-06 (REFAC-14) and 06-04 through 06-10 (REFAC-15).

## Owner actions carried forward

- **DI-81:** redeploy `events-webhook` from CI and confirm `WEBHOOK_SECRET` is set. Until then, production still answers 500 to a wrong-length signature and still re-inserts replays. The DEC-60 zod countersignature is also carried there.
- **DI-78:** a signed-timestamp window is not built. `content_hash` refuses a replay only while the original row exists.
- F-039 stays Open at "08" for its deployment-record clause.

## Known Stubs

None.

## Threat Flags

None. The plan's threat model covers every surface touched: T-06-03-01 and -05 in Task 1, T-06-03-SC in Task 2, and T-06-03-02, -03 and -04 in Task 3. No new endpoint, auth path or schema change was introduced.

## Self-Check: PASSED

- All 12 created files found; `src/app/api/cron` is gone.
- Commits `ffd973e`, `097e928`, `db839a7`, `239b7cd` found in `git log`.
- `webhook-handler.test.ts` is 572 lines (min 120); `defect-ledger.md` has two F-039 rows with hash `239b7cd`.
