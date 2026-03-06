# Social Features & Onboarding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add onboarding wizard, enriched profiles, friend system (mutual follows), social proof on events, event invites, and friends' activity on the home feed.

**Architecture:** Five phases building on each other. Phase 1 lays the DB schema and onboarding flow. Phase 2 enriches the profile pages. Phase 3 adds the follow/friend system. Phase 4 adds social features to events. Phase 5 integrates friends' activity into the home feed. Each phase is independently shippable.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Supabase (DB + RLS + Auth), Tailwind CSS + shadcn/ui, Zustand (auth store), SWR hooks.

---

## Phase 1: DB Migrations & Onboarding Wizard

### Task 1.1: Add new columns to users table

**Files:**
- Create: `supabase/migrations/20260306_add_user_profile_fields.sql`

**Step 1: Write the migration**

```sql
-- Add profile enrichment columns
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS pronouns text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS year text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS faculty text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

-- Backfill: existing users have already "onboarded"
UPDATE public.users SET onboarding_completed = true WHERE onboarding_completed = false;
```

**Step 2: Apply migration**

Run via Supabase MCP tool `apply_migration`.

**Step 3: Commit**

```bash
git add supabase/migrations/20260306_add_user_profile_fields.sql
git commit -m "feat(db): add pronouns, year, faculty, visibility, onboarding_completed to users"
```

---

### Task 1.2: Create user_follows table

**Files:**
- Create: `supabase/migrations/20260306_create_user_follows.sql`

**Step 1: Write the migration**

```sql
CREATE TABLE public.user_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- RLS
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- Anyone can read follows
CREATE POLICY "Anyone can view follows"
  ON public.user_follows FOR SELECT
  USING (true);

-- Users can insert their own follows
CREATE POLICY "Users can follow others"
  ON public.user_follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

-- Users can delete their own follows
CREATE POLICY "Users can unfollow"
  ON public.user_follows FOR DELETE
  USING (auth.uid() = follower_id);

-- Index for friendship lookups
CREATE INDEX idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX idx_user_follows_following ON public.user_follows(following_id);
```

**Step 2: Apply migration via Supabase MCP tool.**

**Step 3: Commit**

```bash
git add supabase/migrations/20260306_create_user_follows.sql
git commit -m "feat(db): create user_follows table with RLS policies"
```

---

### Task 1.3: Create event_invites table

**Files:**
- Create: `supabase/migrations/20260306_create_event_invites.sql`

**Step 1: Write the migration**

```sql
CREATE TABLE public.event_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (inviter_id, invitee_id, event_id)
);

ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;

-- Users can see invites they sent or received
CREATE POLICY "Users can view own invites"
  ON public.event_invites FOR SELECT
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- Users can create invites
CREATE POLICY "Users can send invites"
  ON public.event_invites FOR INSERT
  WITH CHECK (auth.uid() = inviter_id);

CREATE INDEX idx_event_invites_invitee ON public.event_invites(invitee_id);
CREATE INDEX idx_event_invites_event ON public.event_invites(event_id);
```

**Step 2: Apply migration via Supabase MCP tool.**

**Step 3: Commit**

```bash
git add supabase/migrations/20260306_create_event_invites.sql
git commit -m "feat(db): create event_invites table with RLS policies"
```

---

### Task 1.4: Update TypeScript types

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add new fields to User interface and new interfaces**

Add to `User` interface (after `updated_at`):
```typescript
pronouns?: string | null;
year?: string | null;
faculty?: string | null;
visibility?: "public" | "private";
onboarding_completed?: boolean;
```

Add new interfaces after `ClubFollower`:
```typescript
export interface UserFollow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface EventInvite {
  id: string;
  inviter_id: string;
  invitee_id: string;
  event_id: string;
  created_at: string;
}
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add UserFollow, EventInvite, and enriched User fields"
```

---

### Task 1.5: Add profile constants

**Files:**
- Modify: `src/lib/constants.ts`

**Step 1: Add pronoun, year, and faculty options**

Add after `RECOMMENDATION_THRESHOLD`:
```typescript
export const PRONOUNS = [
  "he/him",
  "she/her",
  "they/them",
  "he/they",
  "she/they",
  "any pronouns",
  "prefer not to say",
] as const;

export const YEARS = [
  "U0",
  "U1",
  "U2",
  "U3",
  "U4",
  "Graduate",
  "Alumni",
] as const;

export const FACULTIES = [
  "Arts",
  "Science",
  "Engineering",
  "Management",
  "Medicine",
  "Law",
  "Education",
  "Music",
  "Dentistry",
  "Agriculture & Environmental Sciences",
  "Continuing Studies",
] as const;
```

**Step 2: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat(constants): add PRONOUNS, YEARS, FACULTIES arrays"
```

---

### Task 1.6: Build onboarding wizard page

**Files:**
- Create: `src/app/onboarding/page.tsx`
- Create: `src/components/onboarding/OnboardingWizard.tsx`

**Step 1: Create the page route**

`src/app/onboarding/page.tsx` — server component that checks auth and redirects if already onboarded:
```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) redirect("/");

  const { data: profile } = await supabase
    .from("users")
    .select("onboarding_completed, name, avatar_url")
    .eq("id", user.id)
    .single();

  if (profile?.onboarding_completed) redirect("/");

  return (
    <OnboardingWizard
      userId={user.id}
      initialName={(user.user_metadata?.name as string) ?? (user.user_metadata?.full_name as string) ?? ""}
      avatarUrl={(user.user_metadata?.avatar_url as string) ?? null}
    />
  );
}
```

**Step 2: Create the wizard component**

`src/components/onboarding/OnboardingWizard.tsx` — client component with 4 steps:

1. Welcome step — greeting with avatar preview
2. Basics step — name input, pronouns dropdown (Select), year dropdown (Select), faculty dropdown (Select, optional)
3. Interests step — reuse `InterestTagSelector` component from `@/components/profile/InterestTagSelector`
4. Done step — success message with "Browse Events" button

State: `step` (0-3), `name`, `pronouns`, `year`, `faculty`, `tags`.

On final step submit, PATCH `/api/users/${userId}` with all fields + `onboarding_completed: true`, then `router.push("/")`.

Use shadcn `Select`, `Input`, `Button` components. Progress indicator showing step 1/4, 2/4, etc.

**Step 3: Commit**

```bash
git add src/app/onboarding/page.tsx src/components/onboarding/OnboardingWizard.tsx
git commit -m "feat(onboarding): add multi-step onboarding wizard"
```

---

### Task 1.7: Update users API to accept new fields

**Files:**
- Modify: `src/app/api/users/[id]/route.ts`

**Step 1: Read current file and add new fields to the PATCH handler**

The existing PATCH handler accepts `name`, `avatar_url`, `interest_tags`. Extend it to also accept `pronouns`, `year`, `faculty`, `visibility`, `onboarding_completed`.

Add these to the update object built from the request body, with validation:
- `pronouns`: string or null
- `year`: string or null
- `faculty`: string or null
- `visibility`: must be "public" or "private"
- `onboarding_completed`: boolean

**Step 2: Commit**

```bash
git add src/app/api/users/[id]/route.ts
git commit -m "feat(api): accept pronouns, year, faculty, visibility, onboarding_completed in user PATCH"
```

---

### Task 1.8: Add onboarding redirect to auth flow

**Files:**
- Modify: `src/app/auth/callback/route.ts` (or wherever the OAuth callback lives)

**Step 1: After successful auth, check `onboarding_completed`**

After the user is authenticated, query `users.onboarding_completed`. If false/null, redirect to `/onboarding` instead of `/`.

**Step 2: Commit**

```bash
git add src/app/auth/callback/route.ts
git commit -m "feat(auth): redirect new users to onboarding wizard"
```

---

## Phase 2: Profile Enrichment

### Task 2.1: Update own profile page with new fields

**Files:**
- Modify: `src/app/profile/page.tsx`

**Step 1: Display new fields**

After the profile header, add a card showing:
- Pronouns (if set)
- Year (if set)
- Faculty (if set)
- Public/private badge
- Stats: "N events attended" (count of saved_events where event_date < today) and "N events organized" (count of events created by this user)

**Step 2: Add event history section (self-only)**

Query `saved_events` joined with `events` where `event_date < today`, ordered by date descending. Show as a list of past event cards. This section is only rendered on your own profile (already guaranteed since `/profile` requires auth).

**Step 3: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "feat(profile): display pronouns, year, faculty, stats, and event history"
```

---

### Task 2.2: Update EditProfileModal with new fields

**Files:**
- Modify: `src/components/profile/EditProfileModal.tsx`

**Step 1: Add pronouns, year, faculty, visibility fields**

Add `Select` dropdowns for pronouns, year, faculty using the constants from `@/lib/constants`. Add a toggle/switch for visibility (public/private). Include these in the PATCH body.

Update `EditProfileButton` props to pass initial values for the new fields.

**Step 2: Commit**

```bash
git add src/components/profile/EditProfileModal.tsx src/components/profile/EditProfileButton.tsx src/app/profile/page.tsx
git commit -m "feat(profile): add pronouns, year, faculty, visibility to edit modal"
```

---

### Task 2.3: Build public user profile page

**Files:**
- Create: `src/app/users/[id]/page.tsx`

**Step 1: Create the page**

Server component that:
1. Fetches the target user's profile from `users` table
2. Fetches current logged-in user (if any)
3. If viewing own profile, redirect to `/profile`
4. Checks follow status (does current user follow them? do they follow back?)
5. Determines friendship (mutual follow)
6. Checks target user's `visibility` setting

Display logic:
- **Always visible:** name, avatar, pronouns, year, faculty, public stats (events attended count, events organized count), Follow/Unfollow button, "Friends" badge if mutual
- **Public OR friends:** interest tags, clubs following, saved/upcoming events, friends list
- **Private AND not friends:** "This profile is private" message

Stats queries:
- Events attended: `SELECT count(*) FROM saved_events WHERE user_id = target AND event_id IN (SELECT id FROM events WHERE event_date < today)`
- Events organized: `SELECT count(*) FROM events WHERE created_by = target AND status = 'approved'`

**Step 2: Commit**

```bash
git add src/app/users/[id]/page.tsx
git commit -m "feat(users): add public user profile page with visibility rules"
```

---

## Phase 3: Friend System

### Task 3.1: Create follow/unfollow API

**Files:**
- Create: `src/app/api/users/[id]/follow/route.ts`

**Step 1: Build the API**

`POST /api/users/[id]/follow` — follow a user
- Auth required
- Insert into `user_follows` (follower_id = current user, following_id = target)
- Check if mutual follow now exists — if yes, create `friend` notification for both users
- Otherwise, create `follow` notification for target user
- Return `{ following: true, isFriend: boolean }`

`DELETE /api/users/[id]/follow` — unfollow a user
- Auth required
- Delete from `user_follows`
- Return `{ following: false, isFriend: false }`

**Step 2: Commit**

```bash
git add src/app/api/users/[id]/follow/route.ts
git commit -m "feat(api): add follow/unfollow endpoints with friend detection"
```

---

### Task 3.2: Create FollowUserButton component

**Files:**
- Create: `src/components/users/FollowUserButton.tsx`

**Step 1: Build the component**

Client component. Props: `userId`, `initialFollowing`, `initialIsFriend`.

Renders:
- "Follow" button (default state)
- "Following" button with checkmark (when following, not friends)
- "Friends" badge (when mutual follow)

On click: POST or DELETE to `/api/users/${userId}/follow`, optimistic UI update.

Pattern: same as `src/components/clubs/FollowButton.tsx` but for users.

**Step 2: Wire into `/users/[id]` page**

**Step 3: Commit**

```bash
git add src/components/users/FollowUserButton.tsx src/app/users/[id]/page.tsx
git commit -m "feat(users): add FollowUserButton with optimistic UI"
```

---

### Task 3.3: Add friends list to profile pages

**Files:**
- Modify: `src/app/profile/page.tsx`
- Modify: `src/app/users/[id]/page.tsx`

**Step 1: Query friends**

Friends = users where mutual follow exists. Query:
```sql
SELECT u.* FROM users u
JOIN user_follows f1 ON f1.following_id = u.id AND f1.follower_id = :user_id
JOIN user_follows f2 ON f2.follower_id = u.id AND f2.following_id = :user_id
```

**Step 2: Render friends section**

Card with grid of friend avatars + names, linking to `/users/[id]`. Show count in header.

On own profile: always show. On other profiles: show if public or friends.

**Step 3: Commit**

```bash
git add src/app/profile/page.tsx src/app/users/[id]/page.tsx
git commit -m "feat(profile): add friends list section"
```

---

### Task 3.4: Add notification types for follow/friend

**Files:**
- Already handled in Task 3.1 (API creates notifications)
- No additional work needed — existing notification system reads from `notifications` table

Verify the existing notification bell and notification page display the new types correctly. The `type` field is a string, and the UI already renders `title` + `message` generically.

**Step 1: Commit (if any tweaks needed)**

```bash
git commit -m "feat(notifications): verify follow/friend notification rendering"
```

---

## Phase 4: Social Features on Events

### Task 4.1: Create friends-going API

**Files:**
- Create: `src/app/api/events/[id]/friends/route.ts`

**Step 1: Build the API**

`GET /api/events/[id]/friends` — returns friends who saved this event.

Query: join `saved_events` with `user_follows` (mutual) to find friends of current user who saved this event. Return `{ friends: { id, name, avatar_url }[], count: number }`.

Auth required (no auth = return empty).

**Step 2: Commit**

```bash
git add src/app/api/events/[id]/friends/route.ts
git commit -m "feat(api): add friends-going endpoint for events"
```

---

### Task 4.2: Add "Friends going" indicator to event detail page

**Files:**
- Modify: `src/app/events/[id]/page.tsx` (or the event detail component)
- Create: `src/components/events/FriendsGoing.tsx`

**Step 1: Build FriendsGoing component**

Client component. Fetches `/api/events/${eventId}/friends` via SWR. If count > 0, shows stacked friend avatars (max 3) + "N friends going" text. If 0, renders nothing.

**Step 2: Wire into event detail page**

Place below the event info / above the save button area.

**Step 3: Commit**

```bash
git add src/components/events/FriendsGoing.tsx src/app/events/[id]/page.tsx
git commit -m "feat(events): show friends-going indicator on event detail"
```

---

### Task 4.3: Build "Invite Friends" modal

**Files:**
- Create: `src/components/events/InviteFriendsModal.tsx`

**Step 1: Build the component**

Client component. Props: `eventId`.

Opens a dialog. Fetches current user's friends list. Shows checkboxes next to each friend. "Send Invites" button POSTs to `/api/events/[id]/invite` for each selected friend.

**Step 2: Create invite API**

`POST /api/events/[id]/invite` — body: `{ invitee_ids: string[] }`
- Auth required
- Verify each invitee is a friend (mutual follow)
- Insert into `event_invites`
- Create `event_invite` notification for each invitee
- Return `{ sent: number }`

**Step 3: Wire into event detail page**

Add "Invite Friends" button next to existing save/RSVP buttons. Only show when user is authenticated.

**Step 4: Commit**

```bash
git add src/components/events/InviteFriendsModal.tsx src/app/api/events/[id]/invite/route.ts src/app/events/[id]/page.tsx
git commit -m "feat(events): add invite friends modal and API"
```

---

### Task 4.4: Add share button

**Files:**
- Modify: `src/app/events/[id]/page.tsx`

**Step 1: Add share button**

Button that copies the event URL (`window.location.href`) to clipboard. Show toast/tooltip "Link copied!" on success. Use the `Share2` or `Link` icon from lucide-react.

**Step 2: Commit**

```bash
git add src/app/events/[id]/page.tsx
git commit -m "feat(events): add share link button with clipboard copy"
```

---

## Phase 5: Home Feed Social Integration

### Task 5.1: Create friends-activity API

**Files:**
- Create: `src/app/api/events/friends-activity/route.ts`

**Step 1: Build the API**

`GET /api/events/friends-activity` — returns events where 2+ friends have saved.

Query logic:
1. Get current user's friend IDs (mutual follows)
2. Query `saved_events` where `user_id IN (friend_ids)` and `events.event_date >= today`
3. Group by event_id, count friends, filter count >= 2
4. Order by friend count descending, limit 5
5. Return events with friend avatars + count

Auth required.

**Step 2: Commit**

```bash
git add src/app/api/events/friends-activity/route.ts
git commit -m "feat(api): add friends-activity endpoint for home feed"
```

---

### Task 5.2: Build FriendsActivity section component

**Files:**
- Create: `src/components/events/FriendsActivitySection.tsx`

**Step 1: Build the component**

Client component. Fetches `/api/events/friends-activity` via SWR. If no data, renders nothing (no empty state). If data exists, renders a horizontal section:
- Section title: "Popular with Friends"
- Cards showing event name, date, and "N friends going" with stacked avatars
- Each card links to `/events/[id]`

**Step 2: Commit**

```bash
git add src/components/events/FriendsActivitySection.tsx
git commit -m "feat(events): add FriendsActivitySection component"
```

---

### Task 5.3: Wire FriendsActivity into home feed

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Add to home page**

Import `FriendsActivitySection`. Place it after `HappeningNowSection` and before `RecommendedEventsSection` / `PopularEventsSection`. Only render when user is authenticated.

**Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(home): add friends activity section to home feed"
```

---

## Summary

| Phase | Tasks | Key deliverables |
|-------|-------|-----------------|
| 1 | 1.1–1.8 | DB schema, types, constants, onboarding wizard, auth redirect |
| 2 | 2.1–2.3 | Enriched profile, edit modal updates, public user profiles |
| 3 | 3.1–3.4 | Follow/unfollow API, FollowUserButton, friends list, notifications |
| 4 | 4.1–4.4 | Friends-going indicator, invite modal, share button |
| 5 | 5.1–5.3 | Friends-activity API, home feed section |
