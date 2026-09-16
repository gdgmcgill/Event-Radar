# Three defects the Supabase client casts were hiding

**Plan:** 03-06 · **Phase:** 03-refactor-foundations-schema-truth-and-the-seam-kit · **Recorded:** 2026-09-15

This is the audit-side evidence for **F-071**, **F-072** and **F-073**. It lives under
`.planning/audit/` because the finding register's schema requires every `evidence` value to
resolve there; the plan-side narrative, including the per-site triage of all nine type errors,
is in
`.planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/type-fixes-note.md`.

`(supabase as any)` erases the **whole** client type — the return types, and, decisively, the
**argument** types of every chained method. Forty-seven of them were in the tree. Removing them
produced nine `tsc` errors across five files. Seven were genuine type noise and were fixed.
Two were latent defects, and chasing the second one to its root turned up a third.

None of the three is fixed here. Fixing a behaviour inside a typing change is the exact thing the
program's characterize-first rule exists to prevent, so each has a characterization test that pins
today's behaviour and a register row naming the phase that closes it.

---

## 1. F-071 — a query builder where an array of ids is required

`src/app/api/events/[id]/friends/route.ts`, the fallback taken when the
`get_friends_going_to_event` RPC errors:

```ts
.in(
  "user_id",
  (supabase as any)
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", user.id)
);
```

The second argument is a `PostgrestFilterBuilder`, not an array. postgrest-js's `in()` begins:

```js
in(column, values) {
  const cleanedValues = Array.from(new Set(values)).map(…).join(',')
  …
}
```

`new Set(x)` requires `x` to be iterable. A builder is not, so the call throws `TypeError`. The
throw is caught by the handler's own outer `catch`, which answers **HTTP 200 with
`{ friends: [], count: 0 }`** — indistinguishable, from the caller's side, from "nobody you
follow saved this event".

Removing the cast:

```
src/app/api/events/[id]/friends/route.ts(38,11): error TS2345:
  Argument of type 'PostgrestFilterBuilder<…>' is not assignable to parameter of
  type 'readonly (string | null)[]'.
```

Characterized by `src/__tests__/api/events/friends-defect.test.ts` (5 assertions). The test
reimplements `in()` rather than stubbing it, because the defect lives in the library's argument
handling and a `jest.fn()` that merely records its arguments would prove nothing.

---

## 2 and 3. F-072 / F-073 — `admin_audit_log.admin_email` does not exist

The second named defect was expected to be type noise: a builder asserted
`as Promise<{ data: AuditEntry[] | null }>` inside a `Promise.all`, which works at runtime because
a builder is a thenable. Typing the tuple honestly instead of asserting it produced eight errors,
each of which states the real problem verbatim:

```
src/app/moderation/page.tsx(414,23): error TS2339:
  Property 'admin_email' does not exist on type
  SelectQueryError<"column 'admin_email' does not exist on 'admin_audit_log'.">
```

Three code paths use the column. The live schema has seven columns and none of them is it:

| Path | Direction | File |
|---|---|---|
| Recent Activity panel | read | `src/app/moderation/page.tsx:80` |
| Full audit log page | read | `src/app/moderation/audit-log/page.tsx:17,226` |
| `logAdminAction` | write | `src/lib/audit.ts:38` |

### Measured against the local stack

Rebuilt from the reconciled migrations, which plan 03-04 proved match production statement for
statement. Four calls through PostgREST, service role:

```
select id, admin_email, action, target_type, metadata, created_at
  -> 400  42703     column admin_audit_log.admin_email does not exist

select id, action, target_type, metadata, created_at
  -> 200  []

insert { admin_user_id, admin_email, action, target_type, target_id, metadata }
  -> 400  PGRST204  Could not find the 'admin_email' column of 'admin_audit_log'
                    in the schema cache

insert { admin_user_id, action, target_type, target_id, metadata }
  -> 409  23503     …violates foreign key constraint admin_audit_log_admin_user_id_fkey
```

The fourth line is the control: with `admin_email` removed the payload is **accepted** and reaches
the foreign-key check, so the column name is the only thing standing between `logAdminAction` and
a written row.

### Where the column went

`supabase/migrations/_archive_pre_baseline/20260308000002_admin_audit_log.sql:4` declares
`admin_email TEXT`. That migration is in the pre-baseline archive and never ran against
production — the F-043 divergence this phase exists to close. The application was written against
a schema the database never received.

### Why nobody noticed

`logAdminAction` does not read the result of its insert:

```ts
await supabase.from("admin_audit_log").insert({ … });
```

No `const { error } =`, no throw, no log. All fourteen callsites wrap the call in a `try/catch`
that only fires on a throw, and a rejected insert does not throw. On the read side the page does
`auditLogRes.data ?? []`, so a failed query renders the panel's empty state — "No recent activity
yet" — and an operator reads a healthy-looking dashboard with a quiet feed.

**This is the mechanism behind F-007's observation** that `admin_audit_log` holds zero rows in
production despite moderation having taken place. F-007 read the count and recorded that a forged
entry would be the only entry; this finding explains why the count is zero.

Characterized by `src/__tests__/moderation/audit-shape.test.ts` (6 assertions), which reads the
`admin_audit_log` Row block out of the generated types file rather than importing a type, because
types do not survive to runtime — and that file is now a product of the migrations with a CI job
asserting it stays one, so reading it is reading the schema.

---

## Direction of the fix

F-072 and F-073 share one root cause and must be resolved the same way. The preferred direction is
one line of DDL:

```sql
alter table public.admin_audit_log add column if not exists admin_email text;
```

It matches the archived migration's intent, needs no application change, fixes the read and the
write together, and lets both the client cast and the `as Promise<…>` assertion delete cleanly once
types are regenerated. The alternative — dropping `admin_email` from two pages, the `AuditEntry`
interface and the insert, attributing by `admin_user_id` instead — is larger and loses information.

Either way the production side is gated behind **D-02** in plan 03-08, and F-073's first half (make
`logAdminAction` surface a rejected write instead of discarding it) is independent of the column
question and worth doing regardless.
