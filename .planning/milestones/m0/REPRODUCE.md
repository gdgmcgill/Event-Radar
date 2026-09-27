# Reproduce M0 local verification

Use Node 24, npm 11, Docker and Supabase CLI **2.115.0**. Use the installed `supabase` command: an unpinned `npx supabase` may resolve a different generator/runtime. Run from the repository root. These commands reset the disposable **local Event-Radar database**; they do not use `--linked` or production credentials. Do not run against valuable local data.

The checked-in harness derives its credentials from the local stack, rejects nonlocal targets, overrides provider variables, and starts its own production Next build. Do not export production credentials for these tests or print credential values into evidence.

## Static and unit checks

```sh
npm ci
npm run lint
npx tsc --noEmit
node scripts/check-migration-filenames.mjs
node scripts/check-rls-coverage.mjs
node scripts/check-elevated-ratchet.mjs
node scripts/check-contracts.mjs
node scripts/check-contracts.mjs --client
node scripts/check-server-console.mjs
node scripts/check-characterization-tags.mjs --all
npm run test:ci -- --runInBand
npm audit --audit-level=high --omit=dev
npx --yes --package=deno@2.9.6 deno test --frozen --config supabase/functions/events-webhook/deno.json supabase/functions/tests/webhook-handler.test.ts
```

The audit is a High/Critical gate; its passing exit code permits the three recorded Low/Moderate advisories. Jest's real Upstash contract is skipped without provider credentials.

## Database, Edge and browser checks

```sh
supabase start
supabase db reset --local
supabase gen types typescript --local --schema public > /tmp/universe-m0-types.gen.ts
diff -u src/lib/supabase/types.ts /tmp/universe-m0-types.gen.ts
supabase test db --local
npx tsx scripts/seed/load.ts
supabase test db --local
python3 scripts/test-m0-atomic-concurrency.py
npx tsx scripts/test-edge-local.ts
npx playwright install chromium
npx playwright test
```

Run pgTAP before mutable browser probes. Both database runs report 626 assertions, not 1,252 distinct assertions. The unseeded run explicitly skips fixture-dependent assertions. The final recorded browser result is 1,800 passed and 118 skipped OAuth admission cells. It uses a single worker because scoring and reminders have global effects; this is a disposable local harness, not a production probe. Reset and reload the default seed before another full run if fixtures have been mutated or the opt-in datasets below have been loaded. Avoid rapid repeated auth setup runs that exhaust the local Auth sign-in limiter.

## Deterministic certification datasets

After a local reset and `scripts/seed/load.ts`, independently load each dataset twice and compare its generated/persisted hash fields. Repeat after another reset to establish reproducibility. Runtime timestamps and derived popularity fields are explicitly excluded; functional Storage bytes are included.

```sh
npx tsx scripts/seed/certification-functional.ts --load
npx tsx scripts/seed/certification-functional.ts --verify
npx tsx scripts/seed/certification.ts adversarial --load
npx tsx scripts/seed/certification.ts adversarial --verify
npx tsx scripts/seed/certification.ts scale --load
npx tsx scripts/seed/certification.ts scale --verify
```

The opt-in functional dataset adds a running experiment, and the scale dataset adds 2,000 users and 4,000 events. **Reset/reseed before running the default browser suite or full pgTAP again.** Global scoring over scale fixtures is intentionally not part of the ordinary test floor. The final matching hashes are in [dataset-idempotency.json](evidence/dataset-idempotency.json).

For bounded local/staging load instructions and predeclared thresholds, see [load-tests/README.md](../../../load-tests/README.md). The recorded local 3-VU smoke does not establish staging peak capacity. External certification steps are listed in [REPORT.md](REPORT.md); none can be replaced by these local commands.
