# Social Features & Onboarding Design

## Overview

Add a friend system, onboarding wizard, enriched profiles, and social event features to Uni-Verse. Students can follow each other, become friends (mutual follows), see what events friends are attending, and invite friends to events.

## Data Model

### New Tables

**`user_follows`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| follower_id | uuid FK -> users | |
| following_id | uuid FK -> users | |
| created_at | timestamptz | |

Unique constraint on `(follower_id, following_id)`. Mutual follows = friends (no separate table).

**`event_invites`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| inviter_id | uuid FK -> users | |
| invitee_id | uuid FK -> users | |
| event_id | uuid FK -> events | |
| created_at | timestamptz | |

Unique constraint on `(inviter_id, invitee_id, event_id)`.

### Modified Tables

**`users`** — add columns:
| Column | Type | Default |
|--------|------|---------|
| pronouns | text | null |
| year | text | null |
| faculty | text | null |
| visibility | text | 'public' |
| onboarding_completed | boolean | false |

Migration sets `onboarding_completed = true` for all existing users.

### Friendship Logic

No dedicated friends table. Two users are friends when both rows exist in `user_follows`:
- `(follower=A, following=B)` AND `(follower=B, following=A)`

## Onboarding Wizard

**Trigger:** After Google OAuth, if `users.onboarding_completed` is false/null, redirect to `/onboarding`.

**Steps (single page, multi-step):**
1. Welcome — greeting with Google avatar preview
2. Basics — display name (pre-filled), pronouns dropdown, year dropdown, faculty dropdown (optional)
3. Interests — reuse existing interest tag picker
4. Done — confirmation with CTA to browse events

All steps required except faculty. Sets `onboarding_completed = true` on completion.

## Profile Pages

### Own Profile (`/profile`)
Everything existing, plus:
- Pronouns, year, faculty display
- Public/private toggle
- Friends list (mutual follows)
- Event history section (past attended events) — **self-only, never shown to others**
- Edit support for new fields

### Public Profiles (`/users/[id]`)
New page. Shows: avatar, name, pronouns, year, faculty, interest tags, clubs following.

**Visibility rules:**
- **Public profile:** all info visible to anyone, including saved/upcoming events and friends list
- **Private profile, not friends:** only name, avatar, and Follow button
- **Private profile, friends:** full access (same as public)

Follow/unfollow button. "Friends" badge if mutual follow.

## Event Social Features

### Social Proof
- Event cards and detail pages show "N friends going" with stacked avatars
- Only appears when you have friends who saved the event

### Invite Friends
- Button on event detail page opens modal with friends list + checkboxes
- Sends in-app notification to selected friends
- Share button copies event URL to clipboard

### Home Feed
- "Friends' Activity" section near top of home feed
- Shows events where 2+ friends have saved/RSVP'd, sorted by friend count
- Hidden entirely if no friend activity (no empty state)

## Notifications (New Types)

| Type | Message | Trigger |
|------|---------|---------|
| follow | "[Name] started following you" | Someone follows you |
| friend | "You and [Name] are now friends!" | Follow becomes mutual |
| event_invite | "[Name] invited you to [Event]" | Friend sends invite |

No "friend is attending" notifications — social proof lives on the feed only.

## Phases

1. **DB migrations & onboarding wizard** — schema changes, onboarding UI, auth redirect
2. **Profile enrichment** — update `/profile`, build `/users/[id]`, visibility logic, event history
3. **Friend system** — follow/unfollow API + UI, friendship detection, friends list, notifications
4. **Social features on events** — friends going indicator, invite modal, share link, invite notifications
5. **Home feed social integration** — friends' activity section on home feed

## Decisions

| Decision | Rationale |
|----------|-----------|
| Mutual follow = friends | Low friction to follow, privacy-respecting for social features |
| Simple public/private toggle | Per-field visibility is overengineered for a campus app |
| No "friend attending" notifications | Would get spammy; social proof on feed is sufficient |
| In-app invite + share link | Students share via messaging apps, not email |
| Event history self-only | Privacy — others shouldn't see your full attendance history |
| Single-page onboarding wizard | Fewer routes, smoother flow than multi-page |
