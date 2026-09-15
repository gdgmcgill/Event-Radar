# Seam kit — what the boundary covers, and what it does not

**Plan:** 03-03 · **Phase:** 03 — Refactor Foundations: Schema Truth and the Seam Kit · **Recorded:** 2026-09-15

A build-time control that is described as total, and is not, is worse than no
control: it stops people looking. This note records the boundary's real reach.

---

## 1. The census, and the discrepancy between the program's own documents

| Source | Figure | Date |
| --- | --- | --- |
| `03-RESEARCH.md` § Code Examples 8 | **23** files | 2026-09-15 |
| Live re-derivation during planning | **24** files | 2026-09-15 |
| Live re-derivation at execution (this plan) | **24** files | 2026-09-15 |

**The live number — 24 — is authoritative.** Not because it is larger or later,
but because it is reproducible: anyone can re-run

    grep -rl "supabase/service\|@supabase/supabase-js" src/app/ | sort

against this tree and get the same list, which is printed in full in
`elevated-callsite-census.txt`. The research figure is a measurement taken once
against one working tree and cannot now be re-derived. Where a reproducible
measurement and a recorded one disagree, the reproducible one wins.

Neither figure was quietly adopted. A later reader who finds two numbers in the
program's own documents deserves to find the discrepancy already noticed rather
than to discover it.

Research's dependent figures survive the correction intact: **13** of the 24
entries are dynamic routes (research: "thirteen of the 23"), and the
unescaped-allow-list leak was measured at 12 errors.

---

## 2. What the boundary rule cannot catch

The rule is `no-restricted-imports`, and it sees exactly one thing: a **static
import specifier** in a file under `src/app/**`. Two evasions follow directly.

### Evasion A — a dynamic import

```ts
const { createServiceClient } = await import("@/lib/supabase/service");
```

`no-restricted-imports` inspects static `import` declarations. A call-expression
import is not one, so this passes lint. No file in the tree does this today.

### Evasion B — a bare read of the service-role key, with no top-level SDK import

`src/app/api/admin/calculate-popularity/route.ts` already builds a service-role
client inline rather than calling the shared factory:

```ts
import { createClient } from "@supabase/supabase-js";   // line 11
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;  // line 17
return createClient<Database>(supabaseUrl, serviceRoleKey, { … });  // line 23
```

That file **is** caught today — but only incidentally, by the
`@supabase/supabase-js` pattern on line 11, not by anything that understands
line 17. A future file that obtains an SDK client some other way, or that
forwards the key rather than constructing a client, reads the credential with
nothing to stop it.

### The companion rule, and why it is not shipped here

The belt-and-braces addition would be:

```js
"no-restricted-properties": ["error", {
  object: "process", property: "env",
  message: "Read SUPABASE_SERVICE_ROLE_KEY only inside src/server/db/elevated/.",
}],
```

**Not shipped in this phase, deliberately.** Scoped as written it bans
`process.env` outright in the app layer, and that is not a rule this tree can
carry: **12 `NEXT_PUBLIC_*` reads across 5 files under `src/app/**`** are
entirely legitimate and would all become errors. (Research anticipated this and
estimated "two"; the live count is 12 across
`auth/signout`, `auth/callback`, `api/health`, `api/admin/calculate-popularity`
and `api/auth-debug` — which makes the point more sharply, not less.)

Closing Evasion B needs a rule narrow enough to name the service-role key while
leaving public configuration alone. That is a design decision, and it is better
made alongside the first real shrink — when at least one route has actually
moved to `src/server/db/elevated/` and the shape of the replacement is known —
than guessed at now against zero migrated routes.

### What the rule DOES catch, proven rather than asserted

A new file under `src/app/**` with a static import of either the service module
or the raw SDK: **exit 1, two `no-restricted-imports` errors.** Captured in
`eslint-boundary-fixture.red.txt`, with the green counterpart after the fixture
was deleted. That is the common case and the one an unreviewed change actually
takes.

---

## 3. The seam is applied to zero routes, and the census is the tripwire

Plan 03-03 builds `src/server/` and wires it into **no route whatsoever**
(L3 / REFAC-05 / ROADMAP SC3). Not one file under `src/app/` was edited; two
independent checks hold the claim, because they fail for different reasons:

| Check | Catches |
| --- | --- |
| `git diff --name-only -- src/app/` is empty | a route being edited at all |
| the census count is unmoved at 24 | a route quietly gaining or losing a service-client import |

The second matters on its own: a route could be migrated to the seam without
the first check noticing it in a later commit range, and the count would drop.
A **lower** count is as much a violation of "zero routes" in this phase as a
higher one — it means a migration happened early. Both directions are reported
by `scripts/check-elevated-ratchet.mjs`, which fails on growth and names the
retired entries on shrinkage.

The ratchet was exercised in both directions during execution:

- adding a violating fixture under `src/app/` → **exit 1**, naming it
- temporarily retiring a real legacy callsite's import → **exit 0**, naming the
  retired entry; the file was restored immediately and `git status --porcelain
  src/app/` is empty

**CI wiring is deliberately deferred.** `check-elevated-ratchet.mjs` is invoked
by path and is not in `package.json` or `.github/workflows/ci.yml`. Three plans
in this phase touch the CI workflow and plan 03-06 owns the next edit to it;
adding a step here would put two plans in one file. The wiring lands later,
together with the first actual shrink — the moment the check has something to
shrink *toward*.

---

## 4. The elevated register is empty, and that is the control

`src/server/db/elevated/REGISTRY.md` ships with a table header, four columns —
operation, calling module, why RLS cannot express it, phase added — and **no
rows**. It says so in the file, with the reason.

An empty register with a stated reason is a control: it establishes the
obligation before there is anything to record, so the first elevated operation
in Phase 4 meets a form it has to fill in rather than a blank page it can skip.
An absent register is an omission, and the difference is only visible in
advance. That is the whole argument for writing the file now.

The 24 legacy callsites are **not** registry rows. They are pre-boundary
callsites held by the generated allow-list, and they are counted, not
justified. They become registry rows one at a time, in Phases 4-6, as each is
migrated — each migration deleting its allow-list entry and adding its row,
which is why the two artifacts move in opposite directions and why neither
alone tells the whole story.
