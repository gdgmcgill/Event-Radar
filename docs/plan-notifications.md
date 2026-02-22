# Plan: Notifications (`/notifications`)

## Overview
Two-phase approach:
- **Phase A (implement now)**: In-app notifications page, DB schema, notification bell with unread count
- **Phase B (future)**: Email reminder architecture (documented below but not implemented)

---

## Phase A: In-App Notifications

### DB Changes
```sql
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read) WHERE read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
```

### Files to Create
| File | Purpose |
|------|---------|
| `src/app/notifications/page.tsx` | Notifications list page |
| `src/components/notifications/NotificationList.tsx` | Renders list of notification items |
| `src/components/notifications/NotificationItem.tsx` | Single notification card |
| `src/components/notifications/NotificationBell.tsx` | Bell icon with unread count badge for Header |
| `src/app/api/notifications/route.ts` | GET (list) + POST (mark-all-read) |
| `src/app/api/notifications/[id]/route.ts` | PATCH (mark single as read) |

### Files to Modify
| File | Change |
|------|--------|
| `src/components/layout/Header.tsx` | Add `NotificationBell` next to auth button |

### API Design
- `GET /api/notifications` - User's notifications, sorted by created_at desc
- `PATCH /api/notifications/[id]` - Mark single notification as read
- `POST /api/notifications?action=mark-all-read` - Mark all as read

### Notification Types & Icons
| Type | Icon | Color |
|------|------|-------|
| `event_reminder_24h` | Clock | Blue |
| `event_reminder_1h` | AlertCircle | Orange |
| `event_approved` | CheckCircle | Green |
| `event_rejected` | XCircle | Red |

---

## Phase B: Email Reminders (Future - Not Implemented)

### DB Changes Needed
```sql
CREATE TABLE IF NOT EXISTS public.email_reminder_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  event_id UUID NOT NULL REFERENCES public.events(id),
  reminder_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, event_id, reminder_type)
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT true;
```

### Architecture
- **Scheduler**: Supabase Edge Function triggered by pg_cron (runs every hour)
- **Logic**: Query saved_events JOIN events WHERE start_date is 23-25h away (24h reminder) or 0-2h away (1h reminder), LEFT JOIN email_reminder_log to exclude already-sent
- **Email service**: Resend (simpler API, generous free tier)
- **Templates**: Simple HTML email with event title, date/time, location, "View in Uni-Verse" button, unsubscribe link
