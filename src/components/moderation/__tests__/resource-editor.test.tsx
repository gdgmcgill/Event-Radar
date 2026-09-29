import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ResourceEditor } from "../ResourceEditor";

let mockSearch = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useSearchParams: () => mockSearch,
}));

const fetchMock = jest.fn();
const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

beforeEach(() => {
  mockSearch = new URLSearchParams();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(response({ items: [] }));
  global.fetch = fetchMock;
});

it("hides the external URL field and shows a file input for a template", async () => {
  render(<ResourceEditor />);
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  fireEvent.change(screen.getByLabelText("Type"), {
    target: { value: "template" },
  });
  expect(screen.queryByLabelText("External URL")).toBeNull();
  expect(screen.getByLabelText(/Template file/)).toBeInTheDocument();
});

it("flags unsafe markdown in the body and disables Save", async () => {
  render(<ResourceEditor />);
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  // Default type is "guide", so the body field is present.
  fireEvent.change(screen.getByLabelText("Body (Markdown)"), {
    target: { value: "<b>bold</b>" },
  });
  expect(await screen.findByRole("alert")).toHaveTextContent(/HTML/);
  expect(screen.getByRole("button", { name: /Save draft/ })).toBeDisabled();
});

it("clears the stale external_url when switching away from 'external' (fix round 1, minor)", async () => {
  render(<ResourceEditor />);
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "A resource" } });
  fireEvent.change(screen.getByLabelText("URL slug"), { target: { value: "a-resource" } });
  fireEvent.change(screen.getByLabelText("Summary"), { target: { value: "A summary" } });
  fireEvent.change(screen.getByLabelText("Audience"), { target: { value: "Everyone" } });
  fireEvent.change(screen.getByLabelText("Author name"), { target: { value: "Ady" } });
  fireEvent.change(screen.getByLabelText("Type"), { target: { value: "external" } });
  fireEvent.change(screen.getByLabelText("External URL"), {
    target: { value: "https://example.org" },
  });
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.change(screen.getByLabelText("Type"), { target: { value: "template" } });
  // Before the fix, the hidden external_url stayed in form state and the
  // shape rule ("A template cannot have an external URL") silently disabled
  // Save with no visible reason.
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("button", { name: /Save draft/ })).not.toBeDisabled();
});

it("renders the preview pane through SafeMarkdown", async () => {
  render(<ResourceEditor />);
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  fireEvent.change(screen.getByLabelText("Body (Markdown)"), {
    target: { value: "**bold text**" },
  });
  const preview = screen.getByLabelText("Draft preview");
  expect(preview.querySelector("strong")).toHaveTextContent("bold text");
});

it("?id= opens a resource absent from the list and keeps the form disabled until it loads (M3 final review, finding 2)", async () => {
  const id = "20000000-0000-4000-8000-000000000042";
  mockSearch = new URLSearchParams(`id=${id}`);
  let release: (value: Response) => void = () => undefined;
  const pending = new Promise<Response>((resolve) => {
    release = resolve;
  });
  fetchMock.mockImplementation(async (url: string) => {
    if (url === `/api/admin/resources/${id}`) return pending;
    return response({ items: [] });
  });
  render(<ResourceEditor />);
  // Disabled from the first render, before any fetch resolves.
  expect(screen.getByLabelText("Title")).toBeDisabled();
  await waitFor(() => expect(screen.queryByText(/Loading/)).toBeNull());
  expect(screen.getByLabelText("Title")).toBeDisabled();
  release(
    response({
      item: {
        slug: "older-guide",
        resource_type: "guide",
        title: "Older guide",
        summary: "A summary",
        body_markdown: "Body.",
        external_url: null,
        category: "career",
        audience: "Everyone",
        author_name: "Ady",
        author_url: null,
        source_note: null,
        id,
        file_path: null,
        file_name: null,
        file_size: null,
        status: "draft",
        reviewed_at: null,
        published_at: null,
        created_at: "2026-09-29T00:00:00Z",
        updated_at: "2026-09-29T00:00:00Z",
        created_by: null,
        updated_by: null,
        deleted_at: null,
      },
    })
  );
  const title = await screen.findByDisplayValue("Older guide");
  expect(title).not.toBeDisabled();
  fireEvent.change(title, { target: { value: "Edited guide" } });
  expect(screen.getByDisplayValue("Edited guide")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(`/api/admin/resources/${id}`, expect.objectContaining({ cache: "no-store" }));
});
