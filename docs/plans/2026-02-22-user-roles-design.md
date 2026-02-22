# User Roles & Permissions Design

**Date:** 2026-02-22
**Status:** Approved

## Overview

Replace the binary `is_admin` boolean with a multi-role system supporting four user types: students, club organizers, admins, and non-club event creators. Roles are additive — a user can hold multiple roles simultaneously (e.g., `{user, club_organizer, admin}`). Adopt a Luma-style unified app with contextual nav items instead of a separate admin portal.

## User Types

| Type | Description | How they get the role |
|------|-------------|----------------------|
| **User** | Default. Browse, save, RSVP, create events (pending approval). | Automatic on sign-up |
| **Club Organizer** | Trusted poster for specific clubs. Events auto-approved. Can edit their club's events. | Self-serve request → admin approval |
| **Admin** | Moderate events, manage users/roles, review organizer requests. | Manually assigned by existing admin |
| **Non-club event creator** | Regular user posting non-club events. | No special role — uses `user` role, events go pending |

## Database Schema

### 1. Role enum and users table migration

```sql
CREATE TYPE user_role AS ENUM ('user', 'club_organizer', 'admin');

ALTER TABLE users
  ADD COLUMN roles user_role[] NOT NULL DEFAULT '{user}';

-- Migrate existing admins
UPDATE users SET roles = '{user, admin}' WHERE is_admin = true;
UPDATE users SET roles = '{user}' WHERE is_admin = false;

-- Drop old column
ALTER TABLE users DROP COLUMN is_admin;
```

### 2. Club members table (many-to-many)

```sql
CREATE TABLE club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'organizer',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, club_id)
);

CREATE INDEX idx_club_members_user ON club_members(user_id);
CREATE INDEX idx_club_members_club ON club_members(club_id);
```

### 3. Organizer requests table

```sql
CREATE TABLE organizer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, club_id)
);
```

### 4. RLS policies

```sql
-- Club members: users see their own memberships, admins see all
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own memberships" ON club_members
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage memberships" ON club_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND 'admin' = ANY(roles))
  );

-- Organizer requests: users see own, admins see all
ALTER TABLE organizer_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own requests" ON organizer_requests
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own requests" ON organizer_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage requests" ON organizer_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND 'admin' = ANY(roles))
  );
```

## Permission Matrix

| Action | User | Club Organizer | Admin |
|--------|------|----------------|-------|
| Browse / save / RSVP | Yes | Yes | Yes |
| Create event (pending) | Yes | Yes | Yes |
| Create event for own club (auto-approved) | No | Yes | Yes |
| Edit own club's events | No | Yes | Yes |
| Edit any event | No | No | Yes |
| Approve/reject pending events | No | No | Yes |
| Delete any event | No | No | Yes |
| Manage users & roles | No | No | Yes |
| Request organizer access | Yes | Yes | No |
| Review organizer requests | No | No | Yes |

## Event Creation Flow

1. User submits event via `POST /api/events/create`
2. If user has `club_organizer` role AND `club_id` is in their `club_members` → `status: 'approved'`
3. If user has `admin` role → `status: 'approved'`
4. Otherwise → `status: 'pending'`

## Event Editing Flow

1. `PATCH /api/events/[id]`
2. Admin → allow edit on any event
3. Club organizer AND `event.club_id` in their `club_members` → allow edit
4. Otherwise → 403

## Organizer Request Flow

1. User clicks "Request Organizer Access" on a club page
2. Submits message/proof → saved to `organizer_requests` with `status: 'pending'`
3. Admin reviews in Moderation section:
   - **Approve** → add `club_organizer` to user's `roles` array (if not present), insert `club_members` row, mark request `approved`
   - **Reject** → mark request `rejected`
4. Duplicate requests blocked by unique constraint on `(user_id, club_id)`
5. Admin can also manually add organizers without a request

## Unified App (Luma-style)

No separate `/admin` portal. The sidebar conditionally renders based on roles:

**All users:** Discover / Calendar / My Events / Profile

**Club organizers additionally:** My Clubs → club dashboard (create event, edit events, view stats)

**Admins additionally:** Moderation (pending events, organizer requests, flagged content) / Users

Existing `/admin/*` routes migrate to `/moderation/*`. API routes stay at `/api/admin/*` for admin-only actions; new `/api/clubs/[id]/events` for organizer-scoped actions.

## TypeScript Types

```typescript
export type UserRole = 'user' | 'club_organizer' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  interest_tags: string[];
  roles: UserRole[];
  created_at: string | null;
  updated_at: string | null;
}

export interface ClubMember {
  id: string;
  user_id: string;
  club_id: string;
  role: string;
  created_at: string;
  club?: Club;
  user?: User;
}

export interface OrganizerRequest {
  id: string;
  user_id: string;
  club_id: string;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  club?: Club;
  user?: User;
}
```

## Helper Utilities

```typescript
// src/lib/roles.ts
export const hasRole = (user: User, role: UserRole): boolean =>
  user.roles.includes(role);

export const isAdmin = (user: User): boolean => hasRole(user, 'admin');
export const isOrganizer = (user: User): boolean => hasRole(user, 'club_organizer');
```

## Migration from is_admin

- All existing `verifyAdmin()` calls switch to checking `roles.includes('admin')`
- Admin layout guard switches from `is_admin` to roles check
- Auth store updated to expose `roles` instead of `is_admin`
- Existing admin pages move from `/admin/*` to `/moderation/*`
