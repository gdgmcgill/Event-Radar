/**
 * M3 final review, finding 1b (DEC-80, docs/time-semantics.md): the stale
 * queue trusts the server's wall-clock `is_past`, shows a legacy start as
 * the Toronto time it stores, offers "Reject as expired" only for past
 * items, and never sends a past item to Pending Review (which hides it).
 */
import { render, screen, within } from "@testing-library/react";
import type { IngestionStatusRecord } from "@/contracts/ingestion";
import { IngestionPanel } from "../IngestionPanel";

const fetchMock = jest.fn();
const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

const status: IngestionStatusRecord = {
  summary: {
    last_ingest_at: "2026-09-29T15:00:00Z",
    last_delivery_at: "2026-09-29T15:00:00Z",
    last_success_at: "2026-09-29T15:00:00Z",
    last_failure_at: null,
    last_error_code: null,
    pending_review: 2,
    stale_pending: 2,
  },
  deliveries: [],
  stale: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      title: "Upcoming hackathon",
      created_at: "2026-09-20T00:00:00Z",
      // Hackboard-like: 11:59 PM Toronto stored with a +00 label.
      start_date: "2026-10-01T23:59:00+00:00",
      source: "instagram",
      source_url: null,
      is_past: false,
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      title: "Past info session",
      created_at: "2026-09-20T00:00:00Z",
      start_date: "2026-09-25T18:00:00+00:00",
      source: "instagram",
      source_url: null,
      is_past: true,
    },
  ],
};

let previousTz: string | undefined;
beforeAll(() => {
  // A Toronto viewer is where a naive local-time format goes 4 hours wrong.
  previousTz = process.env.TZ;
  process.env.TZ = "America/Toronto";
});
afterAll(() => {
  process.env.TZ = previousTz;
});
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(response(status));
  global.fetch = fetchMock;
});

it("shows the stored Toronto wall-clock time, not a converted one", async () => {
  render(<IngestionPanel />);
  const rows = await screen.findAllByTestId("ingestion-stale-event");
  expect(rows[0]).toHaveTextContent(/11:59\s?p\.m\. Toronto time/);
  expect(rows[0].textContent).not.toMatch(/7:59/);
});

it("offers Review only for upcoming items and Reject as expired only for past ones", async () => {
  render(<IngestionPanel />);
  const [upcoming, past] = await screen.findAllByTestId("ingestion-stale-event");
  expect(within(upcoming).getByRole("link", { name: "Review" })).toHaveAttribute("href", "/moderation/pending");
  expect(within(upcoming).queryByRole("button", { name: "Reject as expired" })).toBeNull();
  expect(within(past).queryByRole("link", { name: "Review" })).toBeNull();
  expect(within(past).getByRole("button", { name: "Reject as expired" })).toBeInTheDocument();
  expect(past).toHaveTextContent(/^Past info sessionStarted/);
});
