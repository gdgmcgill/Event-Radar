import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OpportunityEditor } from "./OpportunityEditor";
import { EventDiscoveryEditor } from "./EventDiscoveryEditor";
import {
  OpportunityCreateBody,
  EventEditorialMetadata,
} from "@/contracts/opportunities";
const fetchMock = jest.fn();
const id = "10000000-0000-4000-8000-000000000010";
const data = OpportunityCreateBody.parse({
  title: "Editor fixture",
  slug: "editor-fixture",
  description: "Prepared description",
  organization: "Fixture organization",
  listing_type: "job",
  work_mode: "remote",
  source_url: "https://example.org/role",
  action_url: "https://example.org/apply",
  relevance_scope: "cross_campus",
  location: "Old location",
});
const item = {
  ...data,
  id,
  status: "draft",
  updated_at: "2026-09-29T00:00:00Z",
  created_at: "2026-09-29T00:00:00Z",
  published_at: null,
  created_by: id,
  canonical_event_id: null,
  canonical_opportunity_id: null,
};
const response = (body: unknown) =>
  ({ ok: true, json: async () => body }) as Response;
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});
it("saving without blur retains typed fields and permits clearing optional location", async () => {
  let sent: Record<string, unknown> | undefined;
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/api/universities") return response({ universities: [] });
    if (init?.method === "PATCH") {
      sent = JSON.parse(String(init.body)).data;
      return response({ item: { ...item, ...sent }, duplicates: [] });
    }
    if (url.endsWith(id)) return response({ item, duplicates: [] });
    return response({ items: [item] });
  });
  render(<OpportunityEditor canAssignPick />);
  fireEvent.click(
    await screen.findByRole("button", { name: /Editor fixture/ })
  );
  await screen.findByDisplayValue("Old location");
  fireEvent.change(screen.getByLabelText("Location"), {
    target: { value: "" },
  });
  const tags = screen.getByLabelText("Fields (comma separated)");
  fireEvent.change(tags, { target: { value: "technology, design" } });
  // Enter submits without requiring a blur event.
  fireEvent.submit(tags.closest("form")!);
  await waitFor(() =>
    expect(sent).toMatchObject({
      location: "",
      fields: ["technology", "design"],
    })
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Draft changes saved"
  );
});
it("event enrichment saves the current field text when submitted without blur", async () => {
  let sent: Record<string, unknown> | undefined;
  const metadata = EventEditorialMetadata.parse({
    relevance_scope: "cross_campus",
  });
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/api/universities") return response({ universities: [] });
    if (init?.method === "PUT") {
      sent = JSON.parse(String(init.body)).data;
      return response({ data: sent });
    }
    return response({
      event: { id, title: "Existing event" },
      data: metadata,
      updated_at: null,
      can_assign_pick: true,
    });
  });
  render(<EventDiscoveryEditor />);
  fireEvent.click(screen.getByText("Enrich an existing campus event"));
  fireEvent.change(screen.getByLabelText("Existing event UUID"), {
    target: { value: id },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load event" }));
  const tags = await screen.findByLabelText("Fields (comma separated)");
  fireEvent.change(tags, { target: { value: "science, community" } });
  fireEvent.submit(tags.closest("form")!);
  await waitFor(() =>
    expect(sent).toMatchObject({ fields: ["science", "community"] })
  );
});
describe("?id= preselect (M3 final review, finding 2)", () => {
  afterEach(() => window.history.replaceState({}, "", "/"));

  it("opens a listing absent from the first 100 rows and keeps the form disabled until it loads", async () => {
    const olderId = "10000000-0000-4000-8000-000000000099";
    window.history.replaceState({}, "", `/moderation/opportunities?id=${olderId}`);
    let release: (value: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    let sent: Record<string, unknown> | undefined;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/universities") return response({ universities: [] });
      if (url === `/api/admin/opportunities/${olderId}` && init?.method === "PATCH") {
        sent = JSON.parse(String(init.body)).data;
        return response({ item: { ...item, id: olderId, ...sent }, duplicates: [] });
      }
      if (url === `/api/admin/opportunities/${olderId}`) return pending;
      // The list never contains the preselected listing.
      return response({ items: [item] });
    });
    render(<OpportunityEditor canAssignPick />);
    await screen.findByRole("button", { name: /Editor fixture/ });
    // Nothing can be typed into the blank draft while the record is loading.
    expect(screen.getByLabelText("Title")).toBeDisabled();
    expect(screen.getByLabelText("Location")).toBeDisabled();
    release(response({ item: { ...item, id: olderId, title: "Older draft" }, duplicates: [] }));
    await screen.findByDisplayValue("Older draft");
    const title = screen.getByLabelText("Title");
    expect(title).not.toBeDisabled();
    // An edit made after the load survives and is what Save sends.
    fireEvent.change(title, { target: { value: "Edited title" } });
    fireEvent.submit(title.closest("form")!);
    await waitFor(() => expect(sent).toMatchObject({ title: "Edited title" }));
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/admin/opportunities/${olderId}`,
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("without ?id= the form is editable while the list is still loading", async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
    render(<OpportunityEditor canAssignPick />);
    expect(screen.getByLabelText("Title")).not.toBeDisabled();
  });
});
