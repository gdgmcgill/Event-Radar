# Admin Interface Design

## Overview

A shared admin interface for GDG org team and lead to manage events, users, and clubs. Admins use a separate email/password account (not Azure OAuth) and can switch between user/admin experiences by logging into different accounts.

## Authentication & Authorization

- Admin login page at `/admin/login` with email/password
- `is_admin` boolean column on `public.users` table
- Admin layout guard checks `is_admin`, redirects unauthorized users
- SideNavBar shows admin links when logged in as admin
- Existing account: `admin@mcgill.ca`

## Pages

| Route | Purpose |
|-------|---------|
| `/admin/login` | Email/password login for admin accounts |
| `/admin` | Dashboard with live stats and recent activity |
| `/admin/pending` | Pending event review queue with approve/reject |
| `/admin/events` | All events table with search/filter, edit/delete |
| `/admin/events/create` | Create event (auto-approved) |
| `/admin/users` | User management table with admin toggle |
| `/admin/clubs` | Club management table |

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/admin/stats` | GET | Dashboard statistics |
| `/api/admin/events/[id]/status` | PATCH | Approve/reject event |
| `/api/admin/events` | GET | List all events (any status) |
| `/api/admin/events` | POST | Create event (auto-approved) |
| `/api/admin/events/[id]` | PUT | Edit event |
| `/api/admin/events/[id]` | DELETE | Delete event |
| `/api/admin/users` | GET | List all users |
| `/api/admin/users/[id]` | PATCH | Toggle admin, edit user |
| `/api/admin/clubs` | GET | List all clubs |

## DB Changes

- Add `is_admin boolean default false` to `public.users`
- Set `is_admin = true` for admin@mcgill.ca account

## Layout

Reuses existing app layout (SideNavBar, Header). Admin links appear conditionally when `is_admin` is true.

## Out of Scope (for now)

- Reported/flagged events
- Audit logs
- Per-admin accounts for interns
