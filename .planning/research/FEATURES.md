# Feature Landscape

**Domain:** Campus event platform -- club organizer management dashboard
**Researched:** 2026-03-05
**Overall confidence:** MEDIUM-HIGH

## Table Stakes

Features organizers expect from any event management platform. Missing any of these and organizers will abandon the platform for Instagram DMs and Google Forms.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Club profile page (public)** | Every platform (Luma, Eventbrite, CampusGroups) has an org landing page. Students need somewhere to land when they discover a club. | Low | Existing `/clubs/[id]` page exists but is broken. Needs: logo, name, description, follower count, upcoming events list, past events list. |
| **Club profile editing** | Organizers must be able to update name, description, logo, Instagram handle, category without admin intervention. | Low | Basic CRUD. Existing API at `/api/clubs/[id]` supports PATCH but the UI is incomplete. |
| **Event creation flow** | The core action. If organizers cannot create events easily, there is no platform. | Medium | Existing `/api/events/create` works. Needs: club selector for multi-club organizers, image upload, tag selection, date/time picker, location input. Form validation is critical. |
| **Event list with status** | Organizers need to see all their events and know which are pending/approved/rejected. Status visibility is table stakes on Eventbrite, Luma, and CampusGroups. | Low | Existing `ClubEventsTab` component fetches events by club with status filtering. Needs polish, not a rebuild. |
| **Event editing** | Organizers must fix typos, update times, change locations after creation. Every platform supports this. | Low | API exists at `/api/events/[id]`. UI for editing within the dashboard is missing. |
| **Member/team management** | Clubs have multiple organizers. Luma has "co-hosts", Eventbrite has "team members". Organizers expect to invite others to help manage. | Medium | Existing `club_members` table with roles (owner/organizer), `club_invitations` table with token-based invites. `ClubMembersTab` component exists. Needs: invite flow completion, role display, remove member action. |
| **Follower count visibility** | Social proof. Every org page shows follower/subscriber count. Organizers want to see their reach. | Low | `club_followers` table exists. Count is already passed to `ClubDashboard`. Just needs prominent display. |
| **Follow/unfollow for students** | The demand-side counterpart. Students expect to follow clubs like they follow accounts on any social platform. | Low | `FollowButton` component and `/api/clubs/[id]/follow` endpoint exist. Needs integration into public club page and event cards. |
| **Auto-approval for own-club events** | Organizers will not tolerate waiting for admin approval on their own club's events. Luma and Eventbrite publish instantly. | Low | Currently all events go through admin approval. Need a bypass: if `created_by` user is a `club_member` of the event's `club_id`, set status to "approved" automatically. |
| **My clubs list** | Organizers managing multiple clubs need a "home base" showing all their clubs at a glance. | Low | `/api/my-clubs` endpoint exists. Needs a proper UI page (currently fragmented). |
| **RSVP counts per event** | Organizers need to know how many people plan to attend. This is the most basic analytics signal. | Low | `rsvps` table exists with going/interested/cancelled statuses. `/api/events/[id]/rsvp` GET returns counts. Need to surface this in the organizer dashboard. |

## Differentiators

Features that would set Uni-Verse apart from generic event platforms and make it genuinely useful for McGill club organizers. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Event-level analytics dashboard** | Show organizers views, clicks, saves, calendar adds, and RSVP counts for each event. Most campus platforms (CampusGroups, Suitable) do NOT offer granular analytics -- this is a Luma/Eventbrite feature that campus tools lack. | Medium | Data already exists in `user_interactions` and `event_popularity_scores` tables. Need to aggregate and display: views over time, save rate, click-through rate, RSVP breakdown. No new data collection needed -- just a read-only dashboard view querying existing tables. |
| **Club-level analytics trends** | Follower growth over time, total event attendees across all events, most popular event tags, engagement trends. Gives organizers a "health check" on their club's presence. | Medium | Requires time-series aggregation across `club_followers` (need `created_at` tracking, which exists), `rsvps`, and `user_interactions` filtered by club's events. More complex queries but no schema changes. |
| **Post-event review system (organizer-facing)** | After an event ends, prompt attendees (users who RSVP'd "going") to rate it (1-5 stars) and leave optional text feedback. Show aggregate scores to organizers only. This closes the feedback loop -- organizers learn what worked and what didn't. | Medium | New table needed: `event_reviews` (user_id, event_id, rating, comment, created_at). Trigger: event_date has passed + user RSVP'd going. Display: average rating, rating distribution, anonymized comments in organizer dashboard. |
| **Multi-club quick-switcher** | Dropdown in the dashboard header that lets organizers switch between their clubs without navigating back to a list. Follows the Slack/Discord workspace-switcher pattern. | Low | Query `club_members` for user's clubs, render a dropdown. Update URL to `/my-clubs/[new-id]`. Simple UI, high convenience. |
| **Event duplication** | "Create similar event" button that pre-fills the event creation form from an existing event. Recurring events (weekly club meetings) are common -- organizers should not re-enter the same data every week. | Low | Copy event fields into creation form state. No new API needed -- just client-side pre-fill. |
| **Notification to followers on new event** | When a club publishes a new event, automatically notify all followers. Luma does this via email; Uni-Verse already has a `notifications` table and system. | Low | On event creation (or approval), insert notification rows for all `club_followers` of that club. Hook into existing notification infrastructure. |
| **Event image upload with preview** | Drag-and-drop or click-to-upload event image with immediate preview. Better than a URL input field. | Low | `/api/events/upload-image` endpoint exists. Need client-side upload component with preview, crop guidance, and Supabase Storage integration. |
| **Engagement comparison across events** | Side-by-side metrics for multiple events so organizers can see which events perform best and why. | Medium | Comparative visualization component. Requires querying `event_popularity_scores` for multiple events. Useful but not essential for V1. |

## Anti-Features

Features to explicitly NOT build in this milestone. Each has a clear reason.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Public-facing event reviews** | Surfacing reviews to students creates moderation burden, potential for abuse, and discourages honest organizer feedback. PROJECT.md explicitly defers this. | Build organizer-facing reviews first. Validate that organizers actually use feedback before exposing it publicly. |
| **Ticketing / payment processing** | Massive complexity (Stripe integration, refunds, tax handling). McGill club events are overwhelmingly free. Premature optimization for a use case that barely exists. | Use RSVP system (already built) as the attendance signal. If paid events become needed, that is a separate milestone. |
| **Real-time chat / messaging** | PROJECT.md explicitly marks this out of scope. High complexity (WebSocket infrastructure), tangential to event discovery, and solved by existing tools (Discord, GroupMe). | Link to club's existing communication channels (Instagram, Discord) from the club profile page. |
| **Complex role hierarchies** | Three tiers (admin > owner > organizer) is enough. Adding "editor", "viewer", "moderator" roles creates permission complexity that a campus platform does not need. | Stick with owner (full control) and organizer (can create/edit events, view analytics). Admin is a separate platform-level role. |
| **Event templates system** | Over-engineering for the scale. Templates suggest a product with hundreds of recurring event types. McGill clubs have 2-5 event formats at most. | Event duplication (copy existing event) solves 90% of the template use case with 10% of the complexity. |
| **Custom event registration forms** | Eventbrite's custom questions feature is powerful but complex. Organizers would need a form builder, response storage, export tools. Overkill for campus events. | Standard RSVP (going/interested) covers the need. If organizers need custom data, they link to a Google Form. |
| **Sponsorship / promoted events** | PROJECT.md explicitly defers monetization to a separate milestone. Mixing monetization into the organizer UX before core flows work would be premature. | Get club management right first. Sponsorships can layer on top later. |
| **Attendance check-in system** | QR code scanning, check-in lists, attendance verification. Useful for large events but adds significant complexity (mobile scanning, offline support). | Use RSVP counts as a proxy for attendance. Post-event reviews implicitly confirm attendance. Physical check-in is a future enhancement. |
| **User-to-user social features** | Friends, following users, "who's attending" visibility. PROJECT.md explicitly marks this as a separate milestone after clubs are solid. | Focus entirely on the organizer-to-platform and student-to-club relationships in this milestone. |

## Feature Dependencies

```
Club Profile Page (public) --> Follow/Unfollow (needs a page to put the button on)
Club Profile Editing --> Club Profile Page (must exist before you can edit it)
Event Creation Flow --> Club Profile Page (events belong to clubs)
Event Creation Flow --> Auto-Approval (should ship together so organizers see instant results)
My Clubs List --> Club Profile Page (list links to individual club pages)
Multi-Club Quick-Switcher --> My Clubs List (switcher needs the same data source)
Event-Level Analytics --> Event List with Status (analytics lives inside the event management view)
Club-Level Analytics --> Event-Level Analytics (club trends aggregate event-level data)
Post-Event Reviews --> RSVP System (only users who RSVP'd can review; RSVP already exists)
Notification to Followers --> Follow/Unfollow (must have followers to notify)
Notification to Followers --> Auto-Approval (notification triggers on publish, not on pending)
Event Duplication --> Event Creation Flow (duplication pre-fills the creation form)
Engagement Comparison --> Event-Level Analytics (comparison requires per-event metrics)
```

## MVP Recommendation

Prioritize in this order:

1. **Club profile page + editing** -- The foundation. Everything else hangs off this. Partially exists, needs completion.
2. **Event creation flow with club selector** -- The core organizer action. Must work smoothly for single and multi-club organizers.
3. **Auto-approval for own-club events** -- Ship with event creation. Organizers need instant gratification.
4. **My clubs list + multi-club switcher** -- Home base for organizers. Low complexity, high daily-use value.
5. **Event list with status + RSVP counts** -- Organizers need to see their events and know how many people are coming. Mostly exists, needs surfacing.
6. **Member/team management** -- Invite co-organizers. Critical for clubs with executive teams. Partially built.
7. **Follow/unfollow + follower notifications** -- Completes the student-to-club loop. Both partially exist.
8. **Event-level analytics** -- Differentiator. Data already collected, just needs a dashboard view.

**Defer to later in the milestone:**
- Club-level analytics trends: Depends on event analytics being solid first
- Post-event reviews: New table + new UX flow. Build after core dashboard is stable
- Event duplication: Nice-to-have, add once creation flow is proven
- Engagement comparison: Power-user feature, not needed at launch

## Existing Infrastructure Leverage

The codebase already has significant infrastructure that reduces complexity for many features:

| Existing Asset | Features It Enables |
|----------------|-------------------|
| `user_interactions` table + `/api/interactions` | Event-level analytics (views, clicks, saves, shares) |
| `event_popularity_scores` table | Event-level analytics (pre-aggregated scores) |
| `rsvps` table + `/api/events/[id]/rsvp` | RSVP counts, post-event review eligibility |
| `club_members` table | Multi-club support, team management, auto-approval logic |
| `club_invitations` table | Member invitation flow |
| `club_followers` table | Follow/unfollow, follower counts, notification targeting |
| `notifications` table + API | Follower notifications on new events |
| `ClubDashboard` component with tabs | Dashboard shell (overview, events, members, settings) |
| `ClubEventsTab`, `ClubMembersTab`, `ClubOverviewTab` | Partial tab implementations to build on |

This means many "table stakes" features are **completion work, not greenfield work**. The complexity estimates account for this.

## Sources

- [Luma Help Center](https://help.luma.com/) -- organizer dashboard feature reference
- [Luma Review 2026](https://efficient.app/apps/luma) -- current feature set and pricing
- [Eventbrite Event Management Software](https://www.eventbrite.com/organizer/features/event-management-software/) -- organizer tools reference
- [Eventbrite Event Data Analysis](https://www.eventbrite.com/blog/event-data-analysis/) -- analytics best practices
- [CampusGroups by Ready Education](https://www.readyeducation.com/en-us/campusgroups) -- campus-specific club management features
- [Suitable Student Org Management](https://www.suitable.co/products/student-organization-management) -- university org management patterns
- [iCommunify Student Clubs Platform](https://icommunify.com/) -- campus club/event platform features
- [Event Feedback Best Practices - ConferenceTap](https://www.conferencetap.com/post/event-feedback-5-key-considerations-for-event-organizers) -- post-event review system design
- [WorkOS B2B Organization Modeling](https://workos.com/blog/model-your-b2b-saas-with-organizations) -- multi-org UX patterns
- [UX of Switching Accounts in Web Apps](https://medium.com/ux-power-tools/breaking-down-the-ux-of-switching-accounts-in-web-apps-501813a5908b) -- org-switcher patterns
