# Deferred Items — Phase 04

**Plan:** 04-01 · **Phase:** 04-slices-1-2-saved-events-rsvp-and-the-event-read-path · **Recorded:** 2026-09-23

This is Phase 4's deferred-item register, opened by plan 04-01. It follows the format of
`.planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/deferred-items.md`,
the authoritative Phase 3 register. It continues that register's `DI-` sequence: **the next new
item this phase defers is `DI-36`.** Decisions carry the `DEC-` prefix and live in
`evidence/phase-04-decisions.md` (DEC-23 through DEC-32). The prefix rule is Phase 3's, in that
register's § "The two D- sequences, disambiguated".

The rule is unchanged from Phase 3: **deferring silently is forbidden, and there is no row below
without an owner.** Later Phase 4 plans append to this file. They do not start a second one.

---

# Part 1 — Every inherited item, disposed

Phase 3's register assigns items to Phase 4, carries items with other owners through it, and closed
three more before Phase 4 began. Every one gets a row. "Untouched" means Phase 4 neither advances nor
re-plans the item and its existing owner stands.

| Item | What it is | Disposition in Phase 4 | Owner |
|---|---|---|---|
| **DI-19** | The elevated-callsite ratchet's false positive | **CLOSED by 03-08.** Not re-planned. Ratchet measured `committed=24 live=24 delta=0` on the base commit (`evidence/floor.before.txt` block 6) | — |
| **DI-20** | `src/hooks/useEvents.test.ts` intermittently flaky | **CLOSED before Phase 4** (quick task `260916-nst`, `33f5783`). Not re-planned | — |
| **DI-28** | `.claude/CLAUDE.md` correction gitignored | **CLOSED before Phase 4** (quick task `260916-nst`, `33f5783`, owner chose to track the file). Not re-planned | — |
| **DI-32** | The CI `e2e` job red on a real runner | **CLOSED before Phase 4** (`855da7f` + `b9f9bcb`; CI run `35055404669` green on all three jobs). Not re-planned | — |
| **DI-24** | tsconfig excludes `**/*.test.ts(x)`, and F-066's "zero skipped suites" clause is unmet | **Split across two plans.** 04-06 removes the test-file exclusion from the type-check (F-066's second clause; 77 errors / 8 files per 04-RESEARCH.md § Q(g), to be re-measured there). 04-09 revives `src/app/api/events/route.test.ts` against the DEC-25 contract, giving zero skipped suites (F-066's first clause). Before-floor: 1 skipped suite, 5 skipped tests (`evidence/floor.before.txt` block 1) | 04-06, 04-09 |
| **DI-25** | `@supabase/supabase-js` 2.81.1 → 2.116.0 minor, and the `@supabase/ssr` 0.7 → 0.12 major | **Re-deferred per DEC-28, on an enumerated premise.** `evidence/di-25-enumeration.txt`: the bump raises 7 `TS2345` + 1 `TS2322`. Six are admin/club routes, one is `src/lib/audit.ts:38` (F-073), and one is `src/app/api/events/[id]/route.ts:318`, which is that file's PATCH handler, not the GET Phase 4 owns. No blocking site is in a Phase 4 handler. No dependency moves in Phase 4 | **Phase 5** for the minor (with the site list); **Phase 5 at the earliest** for the `ssr` major |
| **DI-30** | REFAC-04's cast clause at 45 of 47, on F-071 / F-072 / F-073 | **F-071 is fixed in Phase 4** by 04-05 (the friends fallback, uncast). Census on the base commit: 2 code sites of `(supabase as any)`, at `friends/route.ts:48` and `moderation/page.tsx:78` (`evidence/floor.before.txt` block 15). F-072/F-073 untouched | **04-05** for F-071; **Phase 5** for F-072/F-073 |
| **DI-31** | The `no-restricted-properties` companion rule, and wiring `check-elevated-ratchet.mjs` into CI | **To 04-03** for the companion rule (designed together with DI-34) and the CI wiring. **No shrink available in Phase 4, by measurement — none of the 13 slice handlers is in the 24-entry allow-list.** The CI wiring does not need a shrink to be an enforcement gain, so it is not deferred to wait for one | **04-03** |
| **DI-34** | The elevated boundary and the ratchet see `src/app/**` only; `src/lib/audit.ts` reaches the service role invisibly | **To 04-03.** Widen to `src/` with carve-outs for the credential's home (`src/lib/supabase/**`, `src/server/db/elevated/**`) and for type-only imports, so the census grows by exactly one row (`src/lib/audit.ts`). Prove it with a red/green fixture on an indirect import before any allow-list regeneration | **04-03** |
| **DI-35** | The seam reads ban state no guard consumes | **To 04-03, per DEC-24:** narrow `RequestProfile` to `id`, `roles`, `onboarding_completed`, and correct its docblock. No ban guard is added. `checkBanStatus()` stays on save POST and rsvp POST only, and its asymmetry is pinned by PRESERVE tests (04-02) | **04-03**; the fail-closed ban check is **Phase 5** (REFAC-11) |
| **DI-21** | The CSP has no local-development entry; the harness runs with `bypassCSP` | **Untouched.** Playwright measured 27 passed with `bypassCSP` on (`evidence/floor.before.txt` block 13) | Phase 6 |
| **DI-22** | `/moderation?status=pending` deep link ignored | **Untouched** | Phase 5 |
| **DI-23** | The production migration-history repair is not performed | **Untouched, and binding on every Phase 4 plan:** no `supabase db push`, no `--linked`. Orchestrator decision 3 | Phase 8 |
| **DI-26** | The blanket shared-cache directive (`vercel.json` `s-maxage=60`), and `/api/events`' own `s-maxage=30` | **Untouched.** No Phase 4 slice may add or remove a cache header | Phase 6 (REFAC-19) |
| **DI-27** | The five signed-in Tier 3 manual acceptance steps | **Untouched** | the phase owner; CERT-05, Phase 7 |
| **DI-29** | No staging Supabase project for REFAC-07's staging clause | **Untouched.** Phase 4 needs no staging environment | the phase owner to provision; CERT-01, Phase 7 |
| **DI-33** | Three storage buckets and three pg_cron jobs exist only in production | **Untouched** | Phase 8 (buckets); Phase 6 (the two cron jobs) |

---

# Part 2 — Every research assumption, disposed

`04-RESEARCH.md` § Assumptions Log lists eight `[ASSUMED]` claims. Each gets a written disposition
and an owner, so no Phase 4 plan executes on an assumption nobody is holding.

| Assumption | Claim | Disposition | Owner |
|---|---|---|---|
| **A1** | Production's PostgREST `max_rows` equals the local 1000 | **Stays ASSUMED.** Production is not read in Phase 4 (orchestrator decision 3). F-079's `severity_rationale` states the value is unverified and argues Low on the local value, so no severity rests on the assumption silently. Closeable by one credentialed read of the project's API settings | Phase 8 (operational certification, the first phase that reads production configuration) |
| **A2** | The `"` and `\` rows of the escaping table follow the two-layer model | **Closes by 04-08's live probe** (`scripts/probes/search-escape-probe.ts` against local PostgREST), which discriminates both characters directly. `%`, `_` and the quoted comma were re-measured on 2026-09-23 (`.planning/audit/quality/phase-04-slice-defects.md` § F-082) | 04-08 |
| **A3** | Adding `rsvps` rows to the seed will not unpin the determinism proof | **MOOT per DEC-30.** No seed change in Phase 4, and the seed already carries two RSVPs (`scripts/seed/personas.ts:566-579`) | — (moot) |
| **A4** | Adding the club embed to `/api/events/[id]` and `/api/users/saved-events` costs no meaningful latency | **Closes by 04-10's latency measurement** (a timed local request or an `EXPLAIN`), per DEC-27 | 04-10 |
| **A5** | The `supabase-js` bump's blocking sites are outside Phase 4's slices | **CLOSED here, by measurement.** `evidence/di-25-enumeration.txt`: 7 `TS2345` + 1 `TS2322`, none in a Phase 4 handler. The nearest is the PATCH handler of a Phase 4 file. DEC-28 | 04-01 (closed) |
| **A6** | Rewriting the skipped suite to the cursor contract is what the owner wants | **DECIDED by DEC-25** on the research's evidence, because no discuss-phase ran. The phase owner may override before 04-09 executes | 04-09 (executes); the phase owner (may override) |
| **A7** | The tag mapping's visual change is acceptable in Phase 4 if logged | **To the 04-11 owner checkpoint** (DEC-26), with deferral as the default. The non-visual half ships regardless in 04-07 | 04-11; the phase owner |
| **A8** | pgTAP still reports 86 and Playwright still reports 27 | **CLOSED by 04-01 Task 1, by measurement.** pgTAP 86 unseeded (040-seed-coverage 21/21 SKIP) and 86 seeded (21 executed, 0 SKIP); Playwright 27 passed, 0 failed, 0 skipped. `evidence/floor.before.txt` blocks 10, 10b, 12, 12b, 13 | 04-01 (closed) |

---

# Part 3 — Items plan 04-01 found

**No new `DI-` id was needed.** Everything 04-01 found that is not fixed in this plan attaches to a
registered finding or a decision, which is where it will be looked for:

- `TAG_HIERARCHY` (`src/lib/constants.ts:342-351`) also disagrees with the read path on
  `competition` (career against sports), in addition to the three keys the plan named. It is recorded
  on **F-081**, whose recommended fix reconciles `TAG_HIERARCHY` when the identity mappings land.
- `/api/events/export` writes the never-maintained `events.rsvp_count` into its CSV
  (`route.ts:32,231`). It is recorded on **F-084** (owner Phase 6, DEC-31).
- The `supabase-js` bump now raises a seventh `TS2345` that Phase 2 did not see
  (`src/app/api/admin/featured/[id]/route.ts:43`). It is recorded in DI-25's row and
  `evidence/di-25-enumeration.txt`.

**One method note for every later plan that captures a pgTAP floor.** `supabase test db` prints
`Tests=86` on both an unseeded and a seeded database, because a TAP SKIP is still a counted test,
and the CLI has no verbose flag. A later "after" capture that wants to prove the 21 seed-coverage
assertions executed rather than skipped must use the same per-assertion probe as
`evidence/floor.before.txt` blocks 10b and 12b (reproduced verbatim in that file's appendix).

---

# Part 4 — Items later Phase 4 plans defer

*(Empty at 04-01. Append new items here as `DI-36`, `DI-37`, … with: found by, what it is, why it was
not fixed in the plan that found it, why it is not merely cosmetic, and its owner.)*

## DI-36 — `GET /api/events/[id]` never returns `pending_edits`, to anyone; its visibility gate is dead

- **Found by:** 04-04, Task 2, while writing `events-detail-characterization.test.ts`. The plan's
  behaviour list said "the creator gets `pending_edits`; an admin gets `pending_edits`". Measured: they
  do not.
- **What it is.** The detail GET (`src/app/api/events/[id]/route.ts:106-126`) transforms the row with
  `transformEventFromDB`, then strips `pending_edits` for anyone who is neither the creator nor an admin.
  But `transformEventFromDB` (`src/lib/tagMapping.ts:146-173`) builds a fresh object and never copies
  `pending_edits`, so the key is absent before the gate runs. With the real transform, no caller receives
  it. The stripping branch is dead at the response level. Probe (`evidence/slice-2-characterization.txt`,
  Task 2): "input has pending_edits: true / transform output has pending_edits: false". Mutation cycle 4
  in `evidence/slice-2-mutation-check.txt` shows that deleting the branch changes no real-transform
  response.
- **Consequence.** `EventDetailView.tsx:207` renders "Your changes to … will be reviewed by an admin" only
  when `event.pending_edits` is set, and `EventDetailClient.tsx:394` passes `event.pending_edits` to the
  edit form as `initialData`. Both read `/api/events/[id]` (`EventDetailClient.tsx:78`). So a creator whose
  title or image edit is awaiting moderation never sees the notice on the detail page, and opening the
  edit form from there shows the live values instead of the pending ones. (`/my-events` reads
  `pending_edits` through its own query and is unaffected.)
- **Why not fixed in 04-04.** 04-04 modifies no production file. The fix is also not in Slice 2's scope:
  none of F-080..F-083 covers it, and copying `pending_edits` in the transform would change it for
  every route that uses the transform (list, saved-events), which needs its own visibility decision.
  The gate is correct today, which is not the same thing as the gate being reachable.
- **Why not cosmetic.** A moderation-state notice the product built for creators cannot render, and the
  one piece of code that would keep that data from non-owners is untestable through the real path.
  `events-detail-characterization.test.ts` layer (b) pins the gate through a transform that carries the
  column, so a fix cannot widen visibility unnoticed.
- **Not yet registered** as an F-nnn. The register is edited only by generator-backed plans (04-01's
  method). The next plan that edits `findings.json` should register it, which is expected to be F-086.
- **Owner:** Phase 5 (REFAC-13, Slice 5 — admin/moderation containment, which owns the moderation
  flow that `pending_edits` belongs to: `admin/events/[id]/edits`, the moderation queue, and this route's
  PATCH, which writes the column). Note for 04-10/04-11: they edit this file's GET. They must not "fix" this in
  passing, because it is a visibility change.

## DI-37 — A database tag named after an `Object.prototype` key maps to a function, not an `EventTag`

- **Found by:** 04-07, Task 2, while re-implementing `mapTags` as `partitionTags(...).mapped`.
- **What it is.** The lookup is `TAG_ALIASES[lowerTag]` on a plain object literal, so the lower-cased
  tag `constructor` resolves to `Object` and `__proto__` to `Object.prototype`, both truthy. Measured:
  `mapTags(["constructor"])` returns `[Object]` (`typeof` `function`), which JSON-serializes as `null`
  in a response's `tags` array, and `partitionTags` does not list it as unmapped. The pre-move line
  (`src/lib/tagMapping.ts:45` at `caf122c`, `tagMapping[lowerTag] || EventTag.SOCIAL`) behaves the same.
- **Why not fixed in 04-07.** 04-07 is "no mapped output changed" by construction (DEC-26, orchestrator
  decision 1), proved by a golden table and the unmodified F-081 DEFECT suite. An own-property lookup
  (`Object.hasOwn(TAG_ALIASES, lowerTag)`) changes the output for these inputs from `null` to `social`.
- **Why not cosmetic.** A scraped or organizer-typed tag is free text; one such tag puts a non-`EventTag`
  value into `Event.tags`, which the category theming keys on, and the new unmapped-tag warning misses it.
- **Owner:** 04-11, beside the F-081 identity-mapping decision, since both are one-place changes in
  `src/lib/eventTags.ts` that alter mapped output; if 04-11 defers, it travels with F-081.

*Phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path*
*Plan: 04-01*
