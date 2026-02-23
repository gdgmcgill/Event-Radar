# Clubs UI Design

**Date:** 2026-02-23
**Scope:** Browse clubs, club detail, create club, admin moderation

## Overview

Build user-facing club pages: browse/search clubs, view club profiles, create new clubs (with admin approval), and admin moderation for pending clubs.

## Data Model Changes

Add two columns to `clubs` table:

- **`status`** (`text`, default `'approved'`): `pending | approved | rejected` — gates public visibility. Default `approved` preserves existing clubs.
- **`category`** (`text`, nullable): Reuses `EventTag` values (`academic`, `social`, `sports`, `career`, `cultural`, `wellness`).

## Pages

### 1. Browse Clubs (`/clubs`)

- **Public page** (no auth required)
- Grid layout: 1/2/3 columns responsive (matches `/my-clubs`)
- Top bar: search input + category filter chips
- Club card: logo (or Building2 fallback), name, category badge, description (2-line clamp), Instagram handle
- Client-side filtering (small dataset)
- Click card → `/clubs/[id]`

### 2. Club Detail (`/clubs/[id]`)

- **Public page** (no auth required)
- Header: logo, name, category badge, description, Instagram link
- Body: list of upcoming approved events (reuse `EventCard`)
- "Request Organizer Access" button — shown to authenticated users who are not already organizers. Uses existing `OrganizerRequestDialog`.
- Data: existing `GET /api/clubs/[id]` endpoint

### 3. Create Club (`/clubs/create`)

- **Requires auth**
- Form: name (required), description (optional), category (required dropdown), Instagram handle (optional), logo URL (optional)
- `POST /api/clubs` → creates club with `status: 'pending'`
- Confirmation: "Your club has been submitted for admin review"

### 4. Club Moderation (`/moderation/clubs`)

- **Requires admin role**
- Lists pending clubs with approve/reject buttons
- Same pattern as `/moderation/organizer-requests`
- On approve: `status → approved`, creator added to `club_members` as organizer, gets `club_organizer` role
- APIs: `GET /api/admin/clubs` (list by status), `PATCH /api/admin/clubs/[id]` (approve/reject)

## Navigation

- Add "Clubs" to `guestNavItems` and `baseNavItems` → `/clubs`
- Add "Clubs" to `adminNavItems` → `/moderation/clubs`

## API Changes

| Endpoint | Method | Change |
|----------|--------|--------|
| `/api/clubs` | GET | Filter to `status = 'approved'` |
| `/api/clubs` | POST | **New** — create club (auth required) |
| `/api/admin/clubs` | GET | **New** — list clubs by status (admin) |
| `/api/admin/clubs/[id]` | PATCH | **New** — approve/reject club (admin) |
