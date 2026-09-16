# Elevated Operations Register

**Phase:** 03 · **Plan:** 03-03 · **Requirement:** REFAC-05

Every operation that reaches for the service-role client gets a row here. The
service-role key bypasses every row-level security policy, so an elevated
operation is a standing exception to the database's own access control. An
exception that nobody wrote down is indistinguishable from an oversight.

## The register

| Operation | Calling module | Why RLS cannot express it | Phase added |
| --------- | -------------- | ------------------------- | ----------- |
| _(none)_  | _(none)_       | _(none)_                  | _(none)_    |

**This register is empty in this phase, and that is the intended state.** Plan
03-03 builds the seam and applies it to **zero** routes (REFAC-05, ROADMAP SC3),
so no module calls `getElevatedClient()` yet. The twenty-four existing
service-role callsites under `src/app/**` still import the service factory
directly; they are held by the generated allow-list in
`eslint.elevated-allowlist.mjs`, which may only shrink, and Phases 4–6 migrate
them here one at a time — each migration adding its row below.

### One known elevated caller that neither control can see — read this before trusting "empty"

`src/lib/audit.ts` calls `createServiceClient()` and exports `logAdminAction`,
which **ten** route files under `src/app/api/admin/**` import, across fourteen
callsites (`grep -rl 'from "@/lib/audit"' src/app | wc -l`, and F-073 for the
callsite count). That is an RLS-bypassing write reachable from admin routes on
every moderation action, and it appears in **neither**
control: the ESLint boundary rule's `files` glob is `src/app/**`, and
`scripts/check-elevated-ratchet.mjs` walks `src/app` and nothing else, so an
*indirect* reach through `src/lib/` is invisible to both. None of those routes is
in `eslint.elevated-allowlist.mjs`, because none of them imports the service
module directly.

Recorded here because an elevated operation that exists and is written down
nowhere is precisely what this register was created to prevent, and because
"empty" without this paragraph is a claim this file cannot support. This is a
**note, not a row**: adding a row would imply the operation goes through
`getElevatedClient()`, which it does not.

The same hole lets any future contributor defeat the control in one move — put
`createServiceClient()` in a new `src/lib/foo.ts` and import `foo` from a route;
lint passes, the ratchet reports `delta=0`, and the credential is in the request
path. Widening both controls to `src/**` (with `src/lib/supabase/**` and
`src/server/db/elevated/**` exempted) and regenerating the allow-list once to
absorb `src/lib/audit.ts` as a pre-existing elevated caller is **DI-34**, owned
by Phase 4. Raised by 03-REVIEW.md CR-03.

An empty register with a stated reason is a control. An absent register is an
omission. The distinction is the whole point of writing this file now rather
than when the first row arrives.

## Adding a row

1. Establish that the operation genuinely cannot be expressed as an RLS policy.
   "It was easier" is not a reason; "the operation must read rows belonging to a
   user other than the caller, on behalf of a cron job with no caller at all" is.
2. Call `getElevatedClient()` from `@/server/db/elevated`. Do not import the
   service-role factory from `src/lib/supabase/` directly — the boundary rule
   rejects that under `src/app/**`, and this module exists so that there is
   exactly one place to audit.
3. Add the row, naming the calling module and the reason.
4. Delete the corresponding entry from `eslint.elevated-allowlist.mjs` when the
   migration retires a legacy callsite. The list may only shrink;
   `scripts/check-elevated-ratchet.mjs` enforces that.
