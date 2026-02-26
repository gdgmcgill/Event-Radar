# Stack Research

**Domain:** Club organizer dashboard — tabbed UI, member management, email invitations, inline event editing
**Researched:** 2026-02-25
**Confidence:** HIGH

## Context: Milestone Scope

This is a SUBSEQUENT MILESTONE on an existing Next.js 16 / Supabase / shadcn/ui platform.
The base stack (Next.js, Supabase, TypeScript strict, Tailwind, shadcn/ui, Zustand, SWR) is validated and in production.
This document covers ONLY net-new additions required for v1.1 Club Organizer UX Overhaul.

---

## What the Milestone Needs

| Feature | New Capability Required |
|---------|------------------------|
| Tabbed dashboard `/my-clubs/[id]` | shadcn/ui `Tabs` component (not installed) |
| Club settings editing (name, description, logo) | Form library — controlled, validated forms |
| Organizer invitation by email | Transactional email API |
| Member list with role badges | shadcn/ui `Avatar`, `Tooltip` (not installed) |
| Invitation/permission feedback | shadcn/ui `Alert` (not installed) |
| Inline event editing | Reuses existing `PATCH /api/events/[id]` — frontend only |

---

## New Stack Additions Required

### Missing shadcn/ui Components (install via CLI)

Current `src/components/ui/` has: badge, button, card, carousel, dialog, input, select, sheet, skeleton, slider, switch.

These are MISSING and needed for v1.1:

| Component | shadcn CLI name | Purpose | Required By |
|-----------|----------------|---------|-------------|
| Tabs | `tabs` | Primary dashboard navigation (Overview / Events / Members / Settings tabs) | `/my-clubs/[id]` dashboard |
| Textarea | `textarea` | Multi-line club description in Settings tab | Club settings form |
| Avatar | `avatar` | Member list display with initials fallback when no profile photo | Members tab |
| Alert | `alert` | Invitation success/error feedback, permission warnings for non-owners | Invitation flow, Settings tab |
| Tooltip | `tooltip` | Role badge explanations (Owner vs Organizer), icon-only button labels | Members tab UI |
| Form | `form` | react-hook-form integration (field, label, error message wrappers) | Settings edit form, event edit form |

**Install command:**
```bash
npx shadcn@latest add tabs textarea avatar alert tooltip form
```

All are Radix UI primitives under the hood. Zero version conflicts with existing `@radix-ui/*` packages already in `package.json`.

### New npm Packages

| Package | Version | Purpose | Why This One |
|---------|---------|---------|--------------|
| `react-hook-form` | `^7.54.0` | Settings form and event edit form state management | Zero-dependency, TypeScript-native, uncontrolled inputs (no re-render on each keystroke). shadcn/ui `Form` component is built as a thin wrapper around it — they are a matched pair per shadcn docs. |
| `@hookform/resolvers` | `^3.9.0` | Zod schema validation adapter for react-hook-form | Required bridge between Zod schemas and react-hook-form. Must match react-hook-form major version (v7 → resolvers v3). |
| `zod` | `^3.23.0` | Runtime schema validation for form inputs | Already the TypeScript strict-mode ecosystem standard; shadcn/ui Form documentation examples assume Zod. Likely already a transitive dependency — verify with `npm ls zod` first. |
| `resend` | `^4.0.0` | Transactional email for organizer invitation emails | Simple REST API, generous free tier (3,000 emails/month). Next.js Route Handler native — no SMTP config, no Node.js `net` module issues in serverless. One import, one function call. |

**Install command:**
```bash
npm install react-hook-form @hookform/resolvers zod resend
```

> Run `npm ls zod` first. If zod is already a transitive dep, omit it from the install command to avoid version conflicts.

---

## What to Reuse Without Changes

| Existing Capability | How It Serves v1.1 |
|--------------------|-------------------|
| `@supabase/supabase-js` + `@supabase/ssr` | All `club_members`, `club_invitations` table ops via existing client/server pattern |
| `swr` | Data fetching for member lists and club events — matches existing `useEvents` / `useUser` hook pattern |
| `zustand` | Auth store already holds user role (`club_organizer`) — read from existing store, no new store needed |
| shadcn/ui `Dialog` | Confirmation modals for remove-member and role-change actions — already installed |
| shadcn/ui `Badge` | Role labels (Owner / Organizer) on member cards — already installed |
| shadcn/ui `Card` | Dashboard section containers — already installed |
| shadcn/ui `Select` | Role selector dropdown in member management — already installed |
| shadcn/ui `Input` | Club name, Instagram handle fields in Settings — already installed |
| `lucide-react` | All dashboard icons (Settings, Users, Calendar, Mail, Crown) — already installed |
| `date-fns` | Event date display in Events tab — already installed |
| `react-easy-crop` | Club logo upload and crop in Settings tab — already installed |
| `PATCH /api/events/[id]` | Inline event editing backend — already exists with organizer auth checks |
| `GET /api/clubs/[id]/events` | Events tab data source — already exists, organizer-only |

---

## Architecture Integration Notes

### Tabbed Dashboard at `/my-clubs/[id]`

Sync tab state to URL via `useSearchParams` so deep links and browser back work:

```typescript
// Client component — tab state from URL search param
const searchParams = useSearchParams()
const router = useRouter()
const activeTab = searchParams.get('tab') ?? 'overview'

// On tab change: router.push(`/my-clubs/${id}?tab=${value}`)
```

Pattern: Outer page is a Client Component for tab switching. Each tab panel fetches its own data via SWR hooks. This keeps data fetching co-located with display and avoids prop-drilling.

### Email Invitations (Resend)

New API route: `POST /api/clubs/[id]/invite`

```typescript
// src/app/api/clubs/[id]/invite/route.ts
import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)

// Flow:
// 1. Verify requesting user is owner of club [id]
// 2. Insert pending row into club_invitations (id, club_id, invitee_email, token uuid, expires_at)
// 3. Send email via resend with acceptance link: /api/clubs/[id]/invite/accept?token=[uuid]
// 4. Accept route: validate token, insert club_members row, delete invitation
```

No new auth library. The invitation token is a `uuid` stored in Supabase, validated server-side by the accept route. Supabase RLS on `club_invitations` restricts reads to service role only.

New table needed: `club_invitations` (id, club_id, invitee_email, token, role, expires_at, created_at).

### Inline Event Editing

Backend exists. Frontend is the only work:

- Reuse `CreateEventForm` (accepts optional `clubId` prop already coded but never passed)
- Add `initialValues` prop to pre-fill existing event data
- Wrap in shadcn/ui `Dialog` (already installed) from the Events tab
- Submit hits existing `PATCH /api/events/[id]`

Zero new packages for event editing.

### Role-Based UI (Owner vs Organizer)

All authorization happens server-side via Supabase RLS and existing API route auth checks. Client-side role checks are UI-only (show/hide buttons):

```typescript
// Fetch user's role in this club via SWR
const { data: membership } = useSWR(`/api/clubs/${id}/membership`)
const isOwner = membership?.role === 'owner'

// Conditionally render Settings tab, Remove Member buttons, Invite button
{isOwner && <TabsTrigger value="settings">Settings</TabsTrigger>}
```

Database: Add `CHECK (role IN ('owner', 'organizer'))` constraint to `club_members.role` via a SQL migration in `supabase/migrations/`.

---

## New Environment Variables Required

```bash
# Append to .env.local
RESEND_API_KEY=re_...              # From resend.com dashboard
NEXT_PUBLIC_APP_URL=https://...   # Base URL for invitation links (e.g. https://uni-verse.ca)
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `resend` | `nodemailer` + SMTP | Requires SMTP server, not serverless-native, complex TLS config in Next.js Route Handlers |
| `resend` | `@sendgrid/mail` | More account verification friction, heavier SDK, no meaningful advantage for a single email type |
| `react-hook-form` | Controlled React state (`useState`) | Re-renders on every keystroke, no built-in validation integration, verbose boilerplate for multi-field forms |
| `react-hook-form` | `formik` | Effectively unmaintained (last meaningful release 2022); `react-hook-form` has 10x adoption in current ecosystem |
| shadcn/ui `Tabs` | Custom tab component | Radix `Tabs` handles keyboard navigation, ARIA roles, and focus management out of the box |
| URL-synced tab state | `useState` for active tab | useState loses tab on page refresh; deep linking breaks; browser Back button does not work correctly |
| UUID token for invitations | JWT for invitations | JWT requires a signing secret and decode step; a UUID stored in Supabase is simpler, auditable, and revocable |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `tanstack-query` / `react-query` | Project standardized on `swr` — two data-fetching libraries creates inconsistency and bundle bloat | `swr` (already installed) |
| `framer-motion` | Tab transitions are not worth a 34KB+ bundle addition for a dashboard with 4 tabs | CSS `transition-opacity` via Tailwind classes |
| `react-table` / `tanstack-table` | Member lists are small (< 50 members per club); a plain Tailwind-styled `<table>` suffices | HTML `<table>` with Tailwind |
| `react-email` | Resend accepts plain HTML strings; a template library is overkill for one invitation email type | Inline HTML string in the Route Handler |
| `immer` | No deeply nested state mutations in this milestone; Zustand's built-in setter pattern is sufficient | Zustand's existing pattern |
| Any push notification library | PROJECT.md explicitly defers push notifications — email invitation is the only delivery mechanism here | `resend` for email only |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `react-hook-form@^7.54.0` | `react@^18.3.0` | React 18 fully supported; no issues |
| `@hookform/resolvers@^3.9.0` | `zod@^3.23.0` + `react-hook-form@^7.54.0` | Resolvers major version must match react-hook-form major — both at v7/v3 is correct |
| `resend@^4.0.0` | Next.js 16 Route Handlers (Node.js runtime) | Works in Node.js runtime; do NOT use Edge Runtime for invite route (Resend SDK uses Node APIs) |
| shadcn/ui `Tabs` | `@radix-ui/react-tabs@^1.1.x` (added automatically by shadcn CLI) | Compatible with all existing `@radix-ui/*` in package.json |
| shadcn/ui `Form` | `react-hook-form@^7.x` | shadcn Form is a thin wrapper — requires react-hook-form v7+ |
| shadcn/ui `Avatar` | `@radix-ui/react-avatar@^1.1.x` (added automatically) | No conflicts with existing Radix packages |

---

## Installation Summary

```bash
# 1. New shadcn/ui components
npx shadcn@latest add tabs textarea avatar alert tooltip form

# 2. Form + validation libraries
npm install react-hook-form @hookform/resolvers zod resend

# 3. Verify zod is not already a transitive dep first
npm ls zod
```

No Supabase Edge Functions, no new Supabase extensions, and no cron jobs are needed for this milestone.

---

## Confidence Assessment

| Decision | Confidence | Basis |
|----------|------------|-------|
| shadcn/ui Tabs for tab navigation | HIGH | shadcn official docs, existing Radix UI pattern in project |
| react-hook-form + Zod for settings form | HIGH | shadcn/ui Form docs explicitly pair with react-hook-form + Zod |
| Resend for invitation email | MEDIUM | Official Resend Next.js guide, free tier confirmed; specific limits unverified |
| URL-synced tab state via useSearchParams | HIGH | Next.js App Router docs pattern |
| UUID token invitation flow | HIGH | Standard stateless invitation pattern, Supabase UUID generation built-in |
| Reuse existing PATCH /api/events/[id] | HIGH | Confirmed in PROJECT.md context section — endpoint verified to exist |
| No new packages for event editing | HIGH | CreateEventForm already accepts clubId prop per PROJECT.md |

---

## Sources

- `package.json` — current installed dependencies (HIGH confidence, direct file read)
- `src/components/ui/` directory listing — confirmed missing shadcn components (HIGH confidence, direct inspection)
- `.planning/PROJECT.md` — feature requirements and existing API capabilities (HIGH confidence, direct file read)
- shadcn/ui docs https://ui.shadcn.com/docs/components/form — Form + react-hook-form + Zod integration (MEDIUM, training data + known stable API)
- Resend Next.js guide https://resend.com/docs/send-with-nextjs — Route Handler integration pattern (MEDIUM, training data)
- Next.js App Router docs https://nextjs.org/docs/app/api-reference/functions/use-search-params — useSearchParams for URL state (HIGH, stable API)

---
*Stack research for: Club organizer dashboard — v1.1 milestone additions only*
*Researched: 2026-02-25*
