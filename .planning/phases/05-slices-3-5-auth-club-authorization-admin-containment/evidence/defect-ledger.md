# Defect ledger — Phase 5

**Plan:** 05-01 · **Phase:** 05-slices-3-5-auth-club-authorization-admin-containment · **Recorded:** 2026-09-24

Opened by plan 05-01, before any Phase 5 fix exists. There is one row per DEFECT assertion that
moved because the defect it pinned was deliberately fixed. Each row's assertions move in the same
commit as the fix. The finding's status and resolution in `.planning/audit/findings.json` are
edited by the fixing plan or its slice-close plan (DEC-57), not here.

**Characterization tags are file-level** (05-RESEARCH.md C15: `scripts/check-characterization-tags.mjs`
reads only the leading docblock). So a pin that must change and lives in a PRESERVE file is first
**moved** into a new `<name>-defect.test.ts` whose docblock says `DEFECT` and cites its F-nnn. The
move happens in the same commit as the fix, and it gets a row below with "moved out of PRESERVE" in
the Old assertion cell. A PRESERVE file is never edited to make it pass. The one sanctioned
exception is DEC-38's mock-seam change to the callback PRESERVE suite (zero assertion changes). It
gets its own row.

Protocol followed for every row:

1. Apply the fix.
2. Run the DEFECT suite unedited. It must go **red**: the before-assertions fail against the
   fixed code.
3. Move the assertions to the fixed shape. The suite must go **green**.
4. Put the pre-fix source back temporarily and run the moved suite. It must go **red**: the
   after-assertions fail against the defect. Then restore the fixed source and prove it is
   byte-identical with `cmp`.
5. The PRESERVE suites covering the same surface pass **unedited** throughout.

Commit hashes are filled in by the commit that follows each fix, because a commit cannot name its
own hash. Every row carries the `INTENTIONAL BEHAVIOUR CHANGE` commit it belongs to when the fix
changes wire bytes.

## Ledger

| F-nnn | Suite | Old assertion | New assertion | Commit | Plan |
|-------|-------|---------------|---------------|--------|------|
| F-003 (config half; census step one of two) | `src/lib/__tests__/env-assertions-defect.test.ts` (DEFECT; the file is unchanged apart from its expected list, the comment over that list, and the count in the first test's title) | `EXPECTED_TODAY` = the 15 pairs measured on a7b02a5: auth-debug `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL` ×2; callback `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL` ×2, `SUPABASE_SERVICE_ROLE_KEY`; signout `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`; `lib/supabase/client.ts` ANON_KEY, URL; `lib/supabase/server.ts` ANON_KEY, URL; `lib/supabase/service.ts` URL, `SUPABASE_SERVICE_ROLE_KEY` | `EXPECTED_TODAY` = the callback's four: `src/app/auth/callback/route.ts` `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL` ×2, `SUPABASE_SERVICE_ROLE_KEY`. Protocol steps 2–4 are in `evidence/env-and-guards.txt` §1e: unedited suite red (−11), moved suite green, pre-fix source red (+11), and the fixed source restored `cmp`-identical. No wire bytes change, so this is not an INTENTIONAL BEHAVIOUR CHANGE row. | refactor(05-04) `COMMIT_T1` | 05-04 |
