# RSVP attendance privacy

M0 closes F-011 with a database policy and matching server behavior. This changes
attendance disclosure intentionally; account profile visibility does not grant
permission to inspect a student's RSVPs.

| Caller | Attendance rows |
| --- | --- |
| Anonymous | None |
| Student | Their own RSVPs |
| Event creator or member of its organizing club | Attendee rows for their events |
| Administrator | Attendee rows across events |

The RSVP API still returns the caller's own RSVP and public going/interested
counts. `get_public_event_rsvp_counts(uuid)` returns only two counts for one
approved, non-deleted event. Cancelled RSVPs are excluded. Pending, rejected,
suspended, deleted and missing events return zero totals from that public
function; the route's existing visibility check still runs first. Event and
club analytics retain their authorized organizer reads. There is no separate
event visibility column in the current schema.

Counts are computed in Postgres, so PostgREST's row limit does not truncate large
event totals. The aggregate is an intentional public disclosure implemented by
a narrowly scoped SECURITY DEFINER function with an empty search path, no user
selector, no row identifiers in its output, and explicit execution grants.

Two former elevated reads were removed: people suggestions no longer use shared
attendance, and another user's profile no longer lists their RSVP events.
Profiles explain that attendance is private rather than falsely claiming the
person has no events. A user's own profile redirect and own RSVP/calendar flows
remain available. RSVP writes remain restricted to the caller's own rows;
organizer read access grants no ability to rewrite another attendee's RSVP.

The forward migration is `20260927220141_m0_rsvp_attendance_privacy.sql`.
The role and aggregate tests live in
`supabase/tests/database/085-rsvp-attendance-privacy.test.sql`, with API and
profile regression tests under `src/__tests__`. The SQL tests use isolated
transactional fixtures and roll back all changes.
