/**
 * `ListingFacts` (Task 6): the shared `<dl>` of public listing facts. No
 * provenance label ever says "Verified" (Global Constraint) — `provenanceLabel`
 * only distinguishes who added a listing, never claims anyone verified it.
 */

import { render } from "@testing-library/react";
import type { DiscoveryItem } from "@/contracts/discovery";
import { ListingFacts } from "../ListingFacts";

const BASE_ITEM: DiscoveryItem = {
  kind: "opportunity",
  id: "10000000-0000-4000-8000-000000000001",
  slug: null,
  title: "Fixture listing",
  description: "Description",
  listing_type: "job",
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
  starts_at: null,
  ends_at: null,
  deadline_at: null,
  deadline_date: null,
  deadline_precision: "none",
  source_timezone: "America/Toronto",
  timezone_assumed: false,
  review_at: null,
  checked_at: null,
  published_at: "2026-09-29T00:00:00Z",
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

describe("ListingFacts", () => {
  it("shows a fallback when eligibility_text is null", () => {
    const { getByText } = render(<ListingFacts item={BASE_ITEM} />);
    expect(getByText("Check eligibility with organizer")).toBeInTheDocument();
  });

  it("labels an indexed listing as automatically indexed and never says Verified", () => {
    const item: DiscoveryItem = { ...BASE_ITEM, source_type: "indexed" };
    const { getByText, container } = render(<ListingFacts item={item} />);
    expect(getByText("Automatically indexed")).toBeInTheDocument();
    expect(container.textContent).not.toContain("Verified");
  });

  it("labels a manual listing and a partner listing without ever saying Verified", () => {
    const manual = render(<ListingFacts item={{ ...BASE_ITEM, source_type: "manual" }} />);
    expect(manual.getByText("Added by the Uni-Verse team")).toBeInTheDocument();
    expect(manual.container.textContent).not.toContain("Verified");
    manual.unmount();

    const partner = render(<ListingFacts item={{ ...BASE_ITEM, source_type: "partner" }} />);
    expect(partner.getByText("Submitted by the organizer")).toBeInTheDocument();
    expect(partner.container.textContent).not.toContain("Verified");
  });

  it("renders a date-only deadline with the end-of-day and assumed-timezone notes", () => {
    const item: DiscoveryItem = {
      ...BASE_ITEM,
      deadline_precision: "date",
      deadline_date: "2026-10-15",
      timezone_assumed: true,
      source_timezone: "America/Toronto",
    };
    const { container } = render(<ListingFacts item={item} />);
    expect(container.textContent).toContain("end of day, America/Toronto");
    expect(container.textContent).toContain(
      "Time zone assumed: America/Toronto"
    );
  });

  it("omits the Deadline fact when there is no deadline", () => {
    const { queryByText } = render(<ListingFacts item={BASE_ITEM} />);
    expect(queryByText("Deadline")).not.toBeInTheDocument();
  });

  it("shows the pick reason only for an editorial pick", () => {
    const notPicked = render(<ListingFacts item={BASE_ITEM} />);
    expect(notPicked.queryByText("Pick reason")).not.toBeInTheDocument();
    notPicked.unmount();

    const picked = render(
      <ListingFacts
        item={{ ...BASE_ITEM, is_pick: true, pick_reason: "Great mentorship." }}
      />
    );
    expect(picked.getByText("Great mentorship.")).toBeInTheDocument();
  });

  it("shows a not-yet-checked fallback and a formatted date when checked", () => {
    const notChecked = render(<ListingFacts item={BASE_ITEM} />);
    expect(notChecked.getByText("Not yet checked")).toBeInTheDocument();
    notChecked.unmount();

    const checked = render(
      <ListingFacts item={{ ...BASE_ITEM, checked_at: "2026-09-20T12:00:00Z" }} />
    );
    expect(checked.container.textContent).toMatch(/Sep 2\d, 2026/);
  });
});
