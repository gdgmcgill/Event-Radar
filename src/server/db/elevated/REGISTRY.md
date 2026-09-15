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
