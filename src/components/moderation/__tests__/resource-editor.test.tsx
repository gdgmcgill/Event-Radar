import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ResourceEditor } from "../ResourceEditor";

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const fetchMock = jest.fn();
const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

beforeEach(() => {
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
