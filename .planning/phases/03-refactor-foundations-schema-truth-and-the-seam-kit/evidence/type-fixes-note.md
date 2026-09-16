# The nine type errors, site by site — and the four things this plan did not do

**Plan:** 03-06 · **Phase:** 03-refactor-foundations-schema-truth-and-the-seam-kit · **Recorded:** 2026-09-15

Removing all 47 `(supabase as any)` casts produced exactly nine `tsc` errors across five files —
the file set, the line numbers and the error codes 03-RESEARCH.md § Code Examples 7 predicted, and
it held against the types **regenerated in this plan's task 1** rather than the ones the research
measured. Fixing them produced a tenth. This note accounts for all ten and for the three defects
the exercise uncovered.

The raw transcripts are in `cast-removal-tsc.txt`. The census that established 47-in-scope versus
61-of-any-kind is in `cast-census.txt`.

---

## 1. The per-site table

| # | File : line | Code | Class | What was done | Why |
|---|---|---|---|---|---|
| 1 | `src/app/api/events/[id]/friends/route.ts:38` | TS2345 | **latent defect** | Characterized and registered as **F-071**. Cast retained. Not fixed. | A `PostgrestFilterBuilder` is passed where `readonly (string \| null)[]` is required. `in()` runs `Array.from(new Set(values))` and a builder is not iterable, so the call throws and the handler's outer catch answers 200 with an empty list. Fixing it is a behaviour change; Phase 4's event-and-friends slice owns the path. |
| 2 | `src/app/api/events/friends-activity/route.ts:51` | TS2345 | nullability from a nested join | `if (eventId === null) continue;` before the map lookup | `saved_events.event_id` is nullable. The map is keyed by it, and a null key would silently merge unrelated rows. Unreachable today because the select uses `events!inner`, which is why the guard is a guard and not a behaviour change — the comment at the site says so. |
| 3 | `src/app/api/events/friends-activity/route.ts:52` | TS2345 | same as #2 | covered by the same guard | The `Map.set()` on the same nullable key. |
| 4 | `src/app/api/events/friends-activity/route.ts:57` | TS2345 | same as #2 | covered by the same guard | The `Map.get()` on the same nullable key. |
| 5 | `src/app/api/events/friends-activity/route.ts:60` | TS2322 | nullability, different target | Local type widened: `name: string` → `name: string \| null` | `users.name` is nullable and the response has **always** carried the null. The declaration said `string`; the cast kept that contradiction compiling. Widening the declaration changes no payload — narrowing the value would have. The declaration was the thing that was wrong. |
| 6 | `src/app/api/events/route.ts:255` | TS2322 | `null` vs `undefined` | `time_of_day: timeOfDay ?? undefined` | `searchParams.get()` yields `string \| null`; the RPC argument is `text DEFAULT NULL`. Omitting the key and passing SQL NULL select the same branch of the function body (`time_of_day IS NULL OR …`), verified by reading the definition at `supabase/migrations/20260915214553_baseline.sql:252`. Payload-equivalent. |
| 7 | `src/app/api/events/route.ts:256` | TS2322 | same as #6 | `day_type: dayType ?? undefined` | Same argument, same `DEFAULT NULL`, same branch. |
| 8 | `src/app/moderation/page.tsx:67` | TS2352 | **latent defect** — worse than the research expected | Characterized and registered as **F-072**. Cast and assertion retained. Not fixed. | The research classed this "type noise (a thenable works at runtime)". Typing the tuple honestly instead of asserting it produced eight TS2339 errors, each reading `SelectQueryError<"column 'admin_email' does not exist on 'admin_audit_log'.">`. The query has never worked. See § 2. |
| 9 | `src/lib/audit.ts:31` | TS2769 | `Record<string, unknown>` vs `Json` | `metadata?: Record<string, unknown>` → `metadata?: Json` | The generated type, not a widened one. `unknown` admits values Postgres cannot store, which is exactly what the overload was objecting to. This is the same shape as five of the six errors that blocked the supabase-js bump in Phase 2 — see § 3.1. |
| 10 | `src/app/api/admin/featured/[id]/route.ts:55` | TS2322 | **ripple**, exposed by fix #9 | `const updates: Record<string, unknown>` → `Record<string, Json>` | The tenth error. It could not appear in the first measurement because the caller only became wrong once the callee became right. `updates` is both the PATCH body for `featured_events` and the audit-log metadata; `unknown` admits values neither column can hold. Narrowing, not widening. |

**Eight fixed, two characterized.** Nothing was silenced: no `as never`, no widening to a broad
record, no fresh cast. `git diff -- src/ | grep -cE "^\+.*as unknown as|^\+.*Record<string, *any>"`
returns 0. Phase 2's `supabase-js-decision.md` § 5 already ruled on the identical temptation —
*"the first hides whatever the new type is actually objecting to"* — and that sentence is why every
row above says what the compiler was told rather than what it was stopped from saying.

### 1.1 Where the plan and the measurement disagreed, and what was done about it

The plan's task 2 says the two defects are characterized rather than fixed, and its acceptance
criteria say the client-cast count reaches **0** and `tsc --noEmit` exits **0**. Measured on this
tree, those two requirements are **incompatible**: at both defect sites the cast is the only thing
making the file compile, and every route to a clean type-check runs through a behaviour change.

The resolution taken, recorded here because it is a deviation and not a judgement call to be
buried:

- **45 of 47 casts removed. Two retained**, one per defect site, and nowhere else. In
  `friends/route.ts` three of the four casts are gone and the fourth — the one on the `.in()`
  *argument* — stays. In `moderation/page.tsx` the single cast is itself the defect site.
- **Both retained casts are now annotated in source** with their finding id, the mechanism, why
  they are still there and which test pins them. A bare `(supabase as any)` is a hiding place; one
  that names a registered finding and a characterization test is a tripwire. That is the only
  defensible form for a cast to survive in after this plan.
- `tsc --noEmit` exits 0, `npm run lint` exits 0 with 0 errors and 19 warnings, and the two defects
  are visibly untouched in the diff — no `await` added to the `.in()` argument, no call reordered,
  no query string changed.

The alternative — fixing both defects here to reach a zero — is the exact move the phase's
characterize-first rule (L2) and the plan's own prohibition forbid, and at the moderation site it
would have meant deciding a schema question with production consequences inside a typing plan.
**The remaining two casts are the honest residue of that decision, not an oversight**, and the
decision itself is put to the user in the plan's checkpoint.

---

## 2. What the second defect turned out to be

The moderation site was expected to be cosmetic. It is not. `admin_audit_log.admin_email` is used
by three code paths and does not exist in the live schema:

| Path | Direction | File |
|---|---|---|
| Recent Activity panel | read | `src/app/moderation/page.tsx:80` |
| Full audit log page | read | `src/app/moderation/audit-log/page.tsx:17,226` |
| `logAdminAction` | write | `src/lib/audit.ts:38` |

Measured against the local stack rebuilt from the reconciled migrations, which plan 03-04 proved
matches production statement for statement:

```
select id, admin_email, action, …   ->  400  42703     column admin_audit_log.admin_email does not exist
select id, action, …                ->  200  []
insert { …, admin_email, … }        ->  400  PGRST204  Could not find the 'admin_email' column …
insert { …no admin_email }          ->  409  23503     …violates FK admin_audit_log_admin_user_id_fkey
```

The fourth line is the control: with the column name removed the payload is **accepted** and gets
as far as the foreign-key check. So the Recent Activity panel has always rendered "No recent
activity yet", and **every moderation action's audit row has always been rejected** — silently,
because `logAdminAction` never reads the result and all fourteen callsites wrap it in a `try/catch`
that only fires on a throw.

`supabase/migrations/_archive_pre_baseline/20260308000002_admin_audit_log.sql:4` declares
`admin_email TEXT`. That migration is in the pre-baseline archive and never reached production —
the F-043 divergence this phase exists to close. The application was written against a schema the
database never received.

**This is the mechanism behind F-007's observation** that `admin_audit_log` holds zero rows in
production despite moderation having taken place. F-007 read the count; this explains it.

Registered as **F-072** (read, Medium, Phase 5) and **F-073** (write, High, Phase 5), with the
audit-side evidence at `.planning/audit/quality/cast-removal-defects.md`. The register's markdown
view was regenerated through `gen-foundation-audit.mjs`; `--check` reports up to date and
`validate.mjs --check findings` passes 8 of 8.

Three findings were registered, not the two the plan anticipated. The third is the write path,
which is a different severity, a different category and a different reproduction from the read
path, and folding it into one row would have understated it.

---

## 3. The four things this plan deliberately did not do

### 3.1 The supabase-js bump is still deferred — but part of its blocker is retired

Fix #9 narrows `logAdminAction`'s `metadata` from `Record<string, unknown>` to the generated `Json`.
`02-.../evidence/supabase-js-decision.md` records that **five of the six errors** which failed the
SDK bump's gate share exactly this shape. Those five are now structurally answered: the project has
a worked example of the correct resolution, and one of the six sites is fixed outright.

**The bump itself is not done and is not attempted here.** The SDK version is where Phase 2 left
it. This note retires part of the *question*, not the change.

### 3.2 The tsconfig test-file exclusion is NOT closed here

The unclosed half of the type-coverage finding. `tsconfig.json` excludes `*.test.ts` from the main
program, so test files are linted but never type-checked. Phase 2's completion note named **this
phase** as its natural home, and this plan is not it.

- **Measured cost:** roughly **86 errors across 10 files**, almost all mechanical.
- **Why not here:** 86 mechanical edits landing in the same commits as a regenerated types file
  would make the regeneration diff — the thing this plan asks a reviewer to certify line by line —
  unreviewable. Task 1's six-hunk accounting only means something if the reviewer can see all six.
- **Who takes it:** **plan 03-08** carries the written deferral and dispositions it. It is not
  silently dropped; it has an owner and a document.

### 3.3 No route adopted the seam, and the importer census is unmoved

The zero-routes constraint (L3) still holds. Editing a route to fix a type error is in scope;
editing one to import from `src/server/` is not.

```
$ grep -rn "@/server/" src/app/ | wc -l
0
$ node scripts/check-elevated-ratchet.mjs
committed=24 live=25 delta=1
```

The census is **unchanged by this plan** — the live count was 25 before this plan's first edit and
25 after. The 24-versus-25 gap is a **pre-existing** ratchet false positive and is recorded in
`deferred-items.md` as **D-19**: `src/app/auth/callback/route.test.ts` (added by plan 03-02, in a
worktree branched before plan 03-03 took its census) contains the strings `@supabase/supabase-js`
and `@/lib/supabase/service` inside `jest.mock()` **calls**, not `import` statements. ESLint's
`no-restricted-imports` correctly ignores it; the ratchet's `text.includes()` census does not. No
new file reaches the service-role client.

### 3.4 The gate reads the local database, and that is a security property

`.github/workflows/ci.yml`'s new `types` job generates from the database the migrations build, not
from the linked remote project. A gate reading production would have passed before plan 03-04
landed and would pass forever after, proving nothing about whether the migrations and the types
agree — and it would need a production credential in CI. This one needs none. The workflow contains
no remote-generation flag, and the job has been observed failing on an injected schema change
(`drift-gate.red.txt`) and passing once it was removed (`drift-gate.green.txt`).

The job also pins `supabase/setup-cli` to **2.115.0**, because the generator's output is not stable
across CLI versions — postgres-meta v0.99.0 parenthesises four generic constraints that v0.98.0
leaves bare. A byte-for-byte gate on an unpinned generator goes red on an upgrade nobody asked for.

---

## 4. One more deviation worth stating plainly

The regenerated types **no longer carry the `__InternalSupabase.PostgrestVersion` block**. The
generator emits it only for a remote project, where the Management API supplies the version;
`--local` generation omits it, confirmed against CLI 2.115.0 and 2.117.0. The plan's must-have list
expected the block to survive, and it cannot.

It was **not** re-added by hand. Hand-editing the generated file is what put a phantom
`events_tests` table in it in the first place, and that prohibition outranks the block's presence.
The cost is nil: the client type instantiates at its default PostgREST version, and `tsc --noEmit`
exits 0 either way. The nine-error measurement above was taken with the block absent and matched
the research's measurement, which was taken with it present.
