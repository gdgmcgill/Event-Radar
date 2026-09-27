import { render, screen, within } from "@testing-library/react";
import ExperimentDetailPage from "@/app/admin/experiments/[id]/page";

// Next supplies React's promise-unwrapping use() in its client runtime. This
// React 18 unit renderer receives the same already-resolved route parameter.
jest.mock("react", () => ({ ...jest.requireActual("react"), use: () => ({ id: "experiment-1" }) }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const experiment = {
  id: "experiment-1", name: "Contract-backed experiment", status: "draft",
  description: null, target_metric: "ctr", start_date: null, end_date: null,
  created_at: "2026-01-01", updated_at: "2026-01-01", total_assignments: 4,
  variants: [{ id: "v1", name: "Control", config: {}, weight: 1, assignments: 4 }],
};
const savedFetch = global.fetch;
afterEach(() => { global.fetch = savedFetch; });

it.each([null, { statistic: 4, pValue: 0.03, significant: true }])(
  "renders the results API's canonical shape and percentage units (%j significance)", async (significance) => {
    // Shape and units match GET /api/admin/experiments/[id]/results exactly.
    global.fetch = jest.fn(async (input) => ({
      ok: true,
      json: async () => String(input).endsWith("/results") ? {
        experiment: { id: experiment.id, target_metric: "ctr" },
        variant_metrics: [{ variant_id: "v1", variant_name: "Control", impressions: 4, clicks: 1, saves: 0, dismisses: 0, ctr_percent: 25, save_rate_percent: 0, dismiss_rate_percent: 0 }],
        significance,
      } : { experiment },
    } as Response));
    render(<ExperimentDetailPage params={Promise.resolve({ id: experiment.id })} />);
    expect(await screen.findByRole("heading", { name: experiment.name })).toBeVisible();
    const table = screen.getByRole("table");
    expect(within(table).getByText("25.00%")).toBeVisible();
    expect(within(table).queryByText("2500.00%")).not.toBeInTheDocument();
    expect(screen.getByText(significance?.significant ? "Results are statistically significant." : "Results are not yet statistically significant.")).toBeVisible();
  }
);
