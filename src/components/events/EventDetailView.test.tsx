/**
 * `EventDetailView` (P1-06 fix round 1, finding 1): a closed discovery
 * event must show "This event has ended" and hide EVERY registration
 * control, not just the external "Register on organizer site" CTA — the
 * in-app RSVP control (`rsvpSlot`) must be hidden too. With `discovery`
 * absent or present-but-not-closed, `rsvpSlot` renders unchanged.
 */

import { render, screen } from "@testing-library/react";
import type { Event } from "@/types";
import type { DiscoveryItem } from "@/contracts/discovery";
import { EventDetailView } from "./EventDetailView";

jest.mock("@/store/useAuthStore", () => ({
  useAuthStore: () => ({ user: null }),
}));

const baseEvent: Event = {
  id: "11111111-0000-4000-8000-000000000001",
  title: "Test Event",
  description: "A test event",
  start_date: "2026-10-01T18:00:00.000Z",
  end_date: "2026-10-01T20:00:00.000Z",
  location: "Test Location",
  organizer: null,
  club_id: null,
  tags: [],
  image_url: null,
  category: null,
  source: "manual",
  source_url: null,
  content_hash: null,
  rsvp_count: 0,
  is_free: true,
  price: null,
  rsvp_link: "https://example.com/register",
  created_by: null,
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
  status: "approved",
  deleted_at: null,
};

const baseDiscoveryItem: DiscoveryItem = {
  kind: "event",
  id: baseEvent.id,
  slug: null,
  title: baseEvent.title,
  description: baseEvent.description ?? "",
  listing_type: "event",
  subtype: null,
  organization: "Organization",
  organizer_university_id: null,
  location: "Montréal, QC",
  work_mode: "in_person",
  fields: [],
  relevance_scope: "cross_campus",
  university_ids: [],
  eligibility_text: null,
  source_type: "manual",
  source_url: null,
  action_url: null,
  application_mode: "none",
  action_note: null,
  starts_at: baseEvent.start_date,
  ends_at: baseEvent.end_date,
  deadline_at: null,
  deadline_date: null,
  deadline_precision: "none",
  source_timezone: "America/Toronto",
  timezone_assumed: false,
  review_at: null,
  checked_at: null,
  published_at: "2026-09-01T00:00:00Z",
  curator_note: null,
  pick_reason: null,
  is_pick: false,
  editorial_priority: 0,
  actionable_at: null,
  expires_at: null,
  closed: false,
  canonical_kind: null,
  canonical_id: null,
};

describe("EventDetailView — discovery-closed RSVP gating", () => {
  it("hides rsvpSlot and shows the ended notice when discovery.closed is true", () => {
    render(
      <EventDetailView
        event={baseEvent}
        discovery={{ ...baseDiscoveryItem, closed: true }}
        rsvpSlot={<button>RSVP control</button>}
      >
        <div>Other children</div>
      </EventDetailView>
    );
    expect(screen.getByText("This event has ended")).toBeInTheDocument();
    expect(screen.queryByText("RSVP control")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Register on organizer site")
    ).not.toBeInTheDocument();
    // Children unrelated to registration (Friends Going, Invite, Reviews in
    // production) still render.
    expect(screen.getByText("Other children")).toBeInTheDocument();
  });

  it("renders rsvpSlot when discovery is absent (switch off, unchanged rendering)", () => {
    render(
      <EventDetailView event={baseEvent} rsvpSlot={<button>RSVP control</button>}>
        <div>Other children</div>
      </EventDetailView>
    );
    expect(screen.getByText("RSVP control")).toBeInTheDocument();
    expect(screen.queryByText("This event has ended")).not.toBeInTheDocument();
  });

  it("renders rsvpSlot when discovery is present but not closed", () => {
    render(
      <EventDetailView
        event={baseEvent}
        discovery={{ ...baseDiscoveryItem, closed: false }}
        rsvpSlot={<button>RSVP control</button>}
      >
        <div>Other children</div>
      </EventDetailView>
    );
    expect(screen.getByText("RSVP control")).toBeInTheDocument();
    expect(screen.queryByText("This event has ended")).not.toBeInTheDocument();
  });
});
