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
| F-003 (config half; census step one of two) | `src/lib/__tests__/env-assertions-defect.test.ts` (DEFECT; the file is unchanged apart from its expected list, the comment over that list, and the count in the first test's title) | `EXPECTED_TODAY` = the 15 pairs measured on a7b02a5: auth-debug `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL` ×2; callback `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL` ×2, `SUPABASE_SERVICE_ROLE_KEY`; signout `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`; `lib/supabase/client.ts` ANON_KEY, URL; `lib/supabase/server.ts` ANON_KEY, URL; `lib/supabase/service.ts` URL, `SUPABASE_SERVICE_ROLE_KEY` | `EXPECTED_TODAY` = the callback's four: `src/app/auth/callback/route.ts` `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL` ×2, `SUPABASE_SERVICE_ROLE_KEY`. Protocol steps 2–4 are in `evidence/env-and-guards.txt` §1e: unedited suite red (−11), moved suite green, pre-fix source red (+11), and the fixed source restored `cmp`-identical. No wire bytes change, so this is not an INTENTIONAL BEHAVIOUR CHANGE row. | refactor(05-04) `7bef995` | 05-04 |
| F-003 (proxy half) | `src/proxy-defect.test.ts` (DEFECT) | row a: NEXT_PUBLIC_SUPABASE_URL unset, anonymous `/profile` → no Location, status 200, `createServerClient` not called (the env pass-through) | row a: → 500, body `Internal Server Error`, not JSON, no Location, `createServerClient` not called, `[Middleware] Error:` logged with a `MissingEnvError`. Protocol steps 2–4: `evidence/proxy-refactor.txt` §1–§3. | fix(05-05) proxy commit (hash filled in by the 05-05 callback commit) (INTENTIONAL BEHAVIOUR CHANGE) | 05-05 |
| F-003 (proxy half) | `src/proxy-defect.test.ts` (DEFECT) | none: row a had no `/api/*` variant (added in the move, as the plan requires) | row a2: NEXT_PUBLIC_SUPABASE_URL unset, anonymous `/api/events` → 500, JSON content type, body `{"error":"Failed to process request"}`, no client built. Protocol steps 2–4: `evidence/proxy-refactor.txt` §1–§3. | fix(05-05) proxy commit (hash filled in by the 05-05 callback commit) (INTENTIONAL BEHAVIOUR CHANGE) | 05-05 |
| F-088 | `src/proxy-defect.test.ts` (DEFECT) | row b: `auth.getUser` rejecting → no Location, status 200, logged (the catch passed the request through) | row b: → 500 `Internal Server Error`, no Location, `console.error("[Middleware] Error:", failure)`. Protocol steps 2–4: `evidence/proxy-refactor.txt` §1–§3. | fix(05-05) proxy commit (hash filled in by the 05-05 callback commit) (INTENTIONAL BEHAVIOUR CHANGE) | 05-05 |
| F-088 | `src/proxy-defect.test.ts` (DEFECT) | row c: users read error XX000 on `/my-events` → one users read, no Location, status 200 (a failed read counted as not banned) | row c: → one users read, 500, no Location, no sign-out. Protocol steps 2–4: `evidence/proxy-refactor.txt` §1–§3. | fix(05-05) proxy commit (hash filled in by the 05-05 callback commit) (INTENTIONAL BEHAVIOUR CHANGE) | 05-05 |
| F-088 (with DEC-35) | `src/proxy-defect.test.ts` (DEFECT) | row d (POST `/api/events/x/save`): PGRST116 → one users read, no Location, status 200, no sign-out | row d-api: → one users read, 403, JSON content type, body `{"error":"Profile not found"}`, no Location, no sign-out. Protocol steps 2–4: `evidence/proxy-refactor.txt` §1–§3. | fix(05-05) proxy commit (hash filled in by the 05-05 callback commit) (INTENTIONAL BEHAVIOUR CHANGE) | 05-05 |
| F-088 (with DEC-35) | `src/proxy-defect.test.ts` (DEFECT) | row d (GET `/my-events`): PGRST116 → one users read, no Location, status 200, no sign-out | row d-page: → one users read, `auth.signOut` called once, 307 to `https://proxy.test/?error=profile_sync_failed`, and the sign-out's clearing cookie (`Max-Age=0`) is on the redirect. Protocol steps 2–4: `evidence/proxy-refactor.txt` §1–§3. An extra mutation (§4) drops the cookie copy and turns only this row red. | fix(05-05) proxy commit (hash filled in by the 05-05 callback commit) (INTENTIONAL BEHAVIOUR CHANGE) | 05-05 |
| F-062 | `src/proxy-defect.test.ts` (DEFECT) | row e: banned POST `/api/events/x/save` → 307 to `/banned`, content type not JSON | row e: → 403, no Location, content type contains `application/json`, body `{"error":"Account suspended"}`. Protocol steps 2–4: `evidence/proxy-refactor.txt` §1–§3. | fix(05-05) proxy commit (hash filled in by the 05-05 callback commit) (INTENTIONAL BEHAVIOUR CHANGE) | 05-05 |
| F-089 | `src/proxy-defect.test.ts` (DEFECT) | row f: un-onboarded (DB `false`), no `needs_onboarding` cookie, `/my-events` → no Location, status 200 | row f: → 307 to `/onboarding` after one users read (database truth). Protocol steps 2–4: `evidence/proxy-refactor.txt` §1–§3. | fix(05-05) proxy commit (hash filled in by the 05-05 callback commit) (INTENTIONAL BEHAVIOUR CHANGE) | 05-05 |
| F-089 | `src/proxy-defect.test.ts` (DEFECT) | row g: onboarded (DB `true`) with a stale `needs_onboarding=1` cookie on `/` → 307 to `/onboarding` | row g: → no Location, status 200. Protocol steps 2–4: `evidence/proxy-refactor.txt` §1–§3. | fix(05-05) proxy commit (hash filled in by the 05-05 callback commit) (INTENTIONAL BEHAVIOUR CHANGE) | 05-05 |
