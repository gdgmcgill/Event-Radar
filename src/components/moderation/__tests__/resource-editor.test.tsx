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

it("renders the preview pane through SafeMarkdown", async () => {
  render(<ResourceEditor />);
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  fireEvent.change(screen.getByLabelText("Body (Markdown)"), {
    target: { value: "**bold text**" },
  });
  const preview = screen.getByLabelText("Draft preview");
  expect(preview.querySelector("strong")).toHaveTextContent("bold text");
});
