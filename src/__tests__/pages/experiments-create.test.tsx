import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ExperimentsPage from "@/app/admin/experiments/page";

const originalFetch = global.fetch;
const experiment = {
  id: "created-experiment", name: "Recoverable experiment", description: "",
  status: "draft", target_metric: "ctr", created_at: "2026-09-28", total_assignments: 0,
  variants: [{ id: "control", name: "control", config: {}, weight: 50 }],
};
const response = (data: unknown, ok = true) => ({ ok, json: async () => data } as Response);
afterEach(() => { global.fetch = originalFetch; });

async function openForm() {
  render(<ExperimentsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "New Experiment" }));
  fireEvent.change(screen.getByLabelText("Name", { exact: true }), { target: { value: experiment.name } });
}

it("rejects malformed JSON without a request, then creates successfully after correction", async () => {
  const request = jest.fn()
    .mockResolvedValueOnce(response({ experiments: [] }))
    .mockResolvedValueOnce(response({ experiment }))
    .mockResolvedValueOnce(response({ experiments: [experiment] }));
  global.fetch = request;
  await openForm();
  fireEvent.change(screen.getByLabelText("Variant 1 configuration"), { target: { value: "{" } });
  fireEvent.click(screen.getByRole("button", { name: "Create Experiment" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("must be valid JSON");
  expect(request).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Create Experiment" })).toBeEnabled();
  fireEvent.change(screen.getByLabelText("Variant 1 configuration"), { target: { value: "{}" } });
  fireEvent.click(screen.getByRole("button", { name: "Create Experiment" }));
  expect(await screen.findByRole("link", { name: experiment.name })).toBeVisible();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  const post = request.mock.calls.find(([, init]) => init?.method === "POST");
  expect(JSON.parse(post?.[1].body)).toMatchObject({ name: experiment.name, variants: [{ name: "control", config: {} }, { name: "treatment", config: { lambda: 0.3 } }] });
});

it.each(["HTTP failure", "network failure"])("preserves form entries and permits retry after %s", async (failure) => {
  const request = jest.fn().mockResolvedValueOnce(response({ experiments: [] }));
  if (failure === "HTTP failure") request.mockResolvedValueOnce(response({ error: "rejected" }, false));
  else request.mockRejectedValueOnce(new Error("connection lost"));
  global.fetch = request;
  await openForm();
  fireEvent.click(screen.getByRole("button", { name: "Create Experiment" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/Could not/);
  await waitFor(() => expect(screen.getByRole("button", { name: "Create Experiment" })).toBeEnabled());
  expect(screen.getByLabelText("Name", { exact: true })).toHaveValue(experiment.name);
  expect(screen.getByLabelText("Variant 2 configuration")).toHaveValue('{"lambda": 0.3}');
});

it.each(["HTTP failure", "network failure"])("shows a recoverable load error instead of false empty data on %s", async (failure) => {
  const request = jest.fn();
  if (failure === "HTTP failure") request.mockResolvedValueOnce(response({}, false));
  else request.mockRejectedValueOnce(new Error("connection lost"));
  request.mockResolvedValueOnce(response({ experiments: [experiment] }));
  global.fetch = request;
  render(<ExperimentsPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load experiments");
  expect(screen.queryByText(/No experiments yet/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry loading experiments" }));
  expect(await screen.findByRole("link", { name: experiment.name })).toBeVisible();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
