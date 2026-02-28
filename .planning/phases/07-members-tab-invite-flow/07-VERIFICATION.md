---
phase: 07-members-tab-invite-flow
verified: 2026-02-26T00:00:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 7: Members Tab and Invite Flow — Verification Report

**Phase Goal:** Club owners can view all members, remove organizers, invite new organizers by email with a copy-link mechanism, and see pending invitations — completing the member management loop
**Verified:** 2026-02-26
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /api/clubs/:id/members returns member list with user info and roles for authorized club members | VERIFIED | `route.ts` L57-93: Supabase join query `club_members` -> `users`, returns `{ members, pendingInvites }` |
| 2 | DELETE /api/clubs/:id/members removes an organizer when called by an owner, rejects self-removal | VERIFIED | `route.ts` L103-177: ownership check (L142), self-removal guard (L150-155), delete by `club_id + user_id` |
| 3 | POST /api/clubs/:id/invites creates an invitation row and returns a token when called by an owner | VERIFIED | `invites/route.ts` L18-149: full validation chain (owner, McGill email, account exists, no duplicate), insert returns token |
| 4 | Invitee SELECT policy exists on club_invitations so acceptance page can read the invite row | VERIFIED | `20260226000001_invitee_select_update_policy.sql` L7-13: CREATE POLICY "Invitees can view their own invitations" |
| 5 | Members tab displays all club members with role badge (owner/organizer) and joined date | VERIFIED | `ClubMembersTab.tsx` L213-262: role badge (L236-245), `formatDate(member.created_at)` (L230) |
| 6 | An owner sees a Remove button on organizer rows and can remove them via a confirmation dialog | VERIFIED | `ClubMembersTab.tsx` L247-257: Remove button (role+row guard), Dialog L354-386: Cancel/Remove (destructive) |
| 7 | An owner can enter a McGill email and generate an invitation link that copies to clipboard | VERIFIED | `ClubMembersTab.tsx` L265-315: email form (L275-291), link display (L297-312), `navigator.clipboard.writeText` (L140) |
| 8 | Pending invitations appear in a separate section showing invitee email and invitation date | VERIFIED | `ClubMembersTab.tsx` L317-351: owner+count-gated section, `formatDate(invite.created_at)` (L337) |
| 9 | An owner can revoke a pending invitation from the Members tab | VERIFIED | `ClubMembersTab.tsx` L145-157: DELETE fetch to `/api/clubs/:id/invites`; `invites/route.ts` L151-219: updates status to 'revoked' |
| 10 | A user who opens /invites/:token while logged in with matching email is added to the club as organizer and redirected to dashboard | VERIFIED | `page.tsx` L112-119: insert club_members as organizer; L132-137: status -> accepted; L148-169: success page with link to `/my-clubs/:id` |
| 11 | An unauthenticated user is redirected to home with a signin prompt and next URL preserving the invite link | VERIFIED | `page.tsx` L47-50: `redirect(\`/?next=/invites/${token}\`)` |
| 12 | An expired invitation, mismatched email, or already-accepted token shows an appropriate error message | VERIFIED | `page.tsx` L62-97: "Invitation not found" (invalid/mismatch), "Invitation unavailable" (accepted/revoked), "Invitation expired" (expiry) |

**Score:** 12/12 truths verified

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/app/api/clubs/[id]/members/route.ts` | VERIFIED | 178 lines; exports GET and DELETE; substantive DB queries with auth, ownership, self-removal guards |
| `src/app/api/clubs/[id]/invites/route.ts` | VERIFIED | 220 lines; exports POST and DELETE (revocation); full validation chain in POST |
| `supabase/migrations/20260226000001_invitee_select_update_policy.sql` | VERIFIED | 37 lines; 3 idempotent RLS policies (DROP IF EXISTS + CREATE): invitee SELECT, invitee UPDATE (accept), owner UPDATE (revoke) |
| `src/lib/supabase/types.ts` | VERIFIED | `club_invitations` block uses `inviter_id` (not `invited_by`), no `role`, no `updated_at`, `expires_at` is `string` (non-nullable) |
| `src/components/clubs/ClubMembersTab.tsx` | VERIFIED | 389 lines; "use client"; full member list, removal dialog, invite form with copy-link, pending invites with revocation |
| `src/components/clubs/ClubDashboard.tsx` | VERIFIED | Imports `ClubMembersTab` (L11); renders `<ClubMembersTab clubId={club.id} role={role} userId={userId} />` (L89); placeholder stub replaced |
| `src/app/my-clubs/[id]/page.tsx` | VERIFIED | Passes `userId={user.id}` to ClubDashboard (L71) |
| `src/app/invites/[token]/page.tsx` | VERIFIED | 171 lines; server component (no "use client"); all error paths rendered; success flow inserts member + updates invite |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `members/route.ts` | `club_members` + `users` tables | Supabase join query | WIRED | `.from("club_members").select("..., users(...)")` (L59-74) |
| `invites/route.ts` | `club_invitations` table | Supabase insert | WIRED | `.from("club_invitations").insert({club_id, inviter_id, invitee_email})` (L122-129) |
| `ClubMembersTab.tsx` | `/api/clubs/:id/members` | fetch in useCallback/useEffect | WIRED | `fetch(\`/api/clubs/${clubId}/members\`)` (L68, L93) |
| `ClubMembersTab.tsx` | `/api/clubs/:id/invites` | fetch POST for invite + DELETE for revoke | WIRED | `fetch(…/invites, { method: "POST" })` (L118), `fetch(…/invites, { method: "DELETE" })` (L147) |
| `ClubDashboard.tsx` | `ClubMembersTab` | import and render in members TabsContent | WIRED | `import { ClubMembersTab }` (L11); `<ClubMembersTab … />` in `<TabsContent value="members">` (L88-90) |
| `invites/[token]/page.tsx` | `club_invitations` table | Supabase token lookup | WIRED | `.from("club_invitations").select(…).eq("token", token).single()` (L55-59) |
| `invites/[token]/page.tsx` | `club_members` table | Supabase insert for new member | WIRED | `.from("club_members").insert({ club_id, user_id, role: "organizer" })` (L113-119) |
| `invites/[token]/page.tsx` | `/my-clubs/:id?tab=overview` | redirect after acceptance | WIRED | `href={\`/my-clubs/${invite.club_id}?tab=overview\`}` (L164) |
| `my-clubs/[id]/page.tsx` | `ClubDashboard` via `userId` prop | `userId={user.id}` | WIRED | `userId={user.id}` (L71) flows through to `ClubMembersTab` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MEM-01 | 07-01 | GET /api/clubs/[id]/members — returns members with user info and roles | SATISFIED | `members/route.ts` GET handler with full join query |
| MEM-02 | 07-02 | Member list UI with role badges and joined date | SATISFIED | `ClubMembersTab.tsx` L213-262 |
| MEM-03 | 07-01 | Member removal by owner — confirmation dialog, self-removal guard, DELETE endpoint | SATISFIED | `members/route.ts` DELETE (L103-177) + `ClubMembersTab.tsx` dialog (L354-386) |
| MEM-04 | 07-02 | Direct organizer invitation by email — owner enters McGill email, generates invite with copy-link | SATISFIED | `ClubMembersTab.tsx` L265-315 |
| MEM-05 | 07-01 | POST /api/clubs/[id]/invites — owner-only, hardcodes role='organizer' server-side, validates invitee email exists | SATISFIED | `invites/route.ts` POST (L18-149); role hardcoded at acceptance in `page.tsx` L118 |
| MEM-06 | 07-03 | Invitation acceptance flow — /invites/[token] page, validates token not expired, email match, inserts organizer | SATISFIED | `invites/[token]/page.tsx` — all validation steps present |
| MEM-07 | 07-02 | Pending invitations visible in Members tab — separate section showing email and date | SATISFIED | `ClubMembersTab.tsx` L317-351: owner+count gated |
| MEM-08 | 07-02 | Invitation revocation by owner — delete/revoke pending invitation from Members tab (P2) | SATISFIED | `ClubMembersTab.tsx` L145-157 + `invites/route.ts` DELETE (L151-219): status -> 'revoked' |

All 8 requirements (MEM-01 through MEM-08) are satisfied. No orphaned requirements found for Phase 7.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ClubDashboard.tsx` | 94 | "Club settings coming soon." in Settings tab | Info | Expected — Settings tab is Phase 8 scope, not Phase 7 |
| `ClubMembersTab.tsx` | 219 | Comment text "Avatar placeholder" | Info | Not a code stub — describes intentional first-letter circle avatar design |
| `ClubMembersTab.tsx` | 280 | `placeholder="organizer@mcgill.ca"` | Info | HTML input placeholder attribute, not a code stub |

No blockers or warnings found. The Settings tab placeholder is explicitly out of Phase 7 scope.

---

### Human Verification Required

#### 1. Copy-Link UX End-to-End

**Test:** As a club owner, open the Members tab, enter a valid McGill email (an existing user), click "Send Invite". Verify the invite link appears in a readonly input and the Copy button copies it to clipboard (icon changes to a checkmark for 2 seconds).
**Expected:** Link is `{origin}/invites/{uuid}`, clipboard contains the same link, checkmark icon reverts to copy icon after 2 seconds.
**Why human:** `navigator.clipboard.writeText` behavior and visual icon toggle require browser interaction to verify.

#### 2. Invite Acceptance Happy Path

**Test:** As the invited user (matching email), open the invite link `/invites/:token`. Verify: success page shows "You're in!" with the correct club name and a "Go to Club Dashboard" button.
**Expected:** User is added to `club_members` with role `organizer`, invitation status becomes `accepted`, success page rendered.
**Why human:** Requires two authenticated users and RLS-enforced DB operations — cannot verify without live Supabase instance.

#### 3. Email Mismatch / Unauthenticated Redirect

**Test:** (a) Open an invite link while signed out. Verify redirect to `/?next=/invites/:token`. (b) Open an invite link while signed in as a different user (email does not match invitee_email). Verify "Invitation not found" error page.
**Expected:** (a) Redirected to home with next param preserved. (b) Error page shown — not a 404.
**Why human:** Requires testing with real RLS policies active in Supabase.

#### 4. Role Visibility Gating

**Test:** Sign in as an organizer (not owner) and open the Members tab. Verify: no Remove buttons, no Invite form, no Pending Invitations section visible.
**Expected:** Organizer sees only the member list (own row per RLS). No owner-only UI elements rendered.
**Why human:** Requires a real organizer account and active RLS policy to confirm single-row return.

---

### Gaps Summary

No gaps. All 12 observable truths verified, all 8 artifacts substantive and wired, all 9 key links confirmed, all 8 requirements (MEM-01 through MEM-08) satisfied. TypeScript compilation passes with 0 errors in project files (pre-existing unrelated error in `demo-video/src/index.ts` excluded by plan scope).

---

_Verified: 2026-02-26_
_Verifier: Claude (gsd-verifier)_
