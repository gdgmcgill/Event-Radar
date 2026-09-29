/**
 * `EditorialHome` (P1-06 fix round 1, finding 4): a failed `picks` section
 * must render the same one-line error notice the other sections use — it
 * was previously silently omitted, indistinguishable from "no picks today".
 */

import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { getRequestContext } from "@/server/context";
import { homeSections } from "@/server/home/sections";
import { EditorialHome } from "./EditorialHome";

jest.mock("@/server/context", () => ({ getRequestContext: jest.fn() }));
jest.mock("@/server/home/sections", () => ({ homeSections: jest.fn() }));

const mockGetRequestContext = getRequestContext as jest.MockedFunction<typeof getRequestContext>;
const mockHomeSections = homeSections as jest.MockedFunction<typeof homeSections>;

beforeEach(() => {
  mockGetRequestContext.mockResolvedValue({} as never);
});

async function renderEditorialHome() {
  const element = (await EditorialHome()) as ReactElement;
  return render(element);
}

describe("EditorialHome — Ady's Picks section", () => {
  it("shows the section-failed notice when picks errors, not silence", async () => {
    mockHomeSections.mockResolvedValue({
      thisWeek: { status: "ok", items: [] },
      picks: { status: "error" },
      resources: { status: "ok", items: [] },
    });
    await renderEditorialHome();
    expect(screen.getByText("Ady’s Picks")).toBeInTheDocument();
    expect(
      screen.getByText(/This section couldn.t load\./)
    ).toBeInTheDocument();
  });

  it("omits the section entirely when picks is ok and empty", async () => {
    mockHomeSections.mockResolvedValue({
      thisWeek: { status: "ok", items: [] },
      picks: { status: "ok", items: [] },
      resources: { status: "ok", items: [] },
    });
    await renderEditorialHome();
    expect(screen.queryByText("Ady’s Picks")).not.toBeInTheDocument();
  });
});
