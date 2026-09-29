/**
 * `/` (Task 5): the homepage is the switch itself. `HomePage()` must return
 * an element of `LegacyHome`'s type when discovery is disabled and of
 * `EditorialHome`'s type when it is enabled — never a third component, and
 * never invoke either subtree just to pick between them (both are only
 * referenced by identity here, not rendered).
 */

import type { ReactElement } from "react";

let discoverySurfaceResult: { enabled: boolean; preview: boolean };

jest.mock("@/server/discoveryAccess", () => ({
  discoverySurface: () => Promise.resolve(discoverySurfaceResult),
}));

import HomePage from "@/app/page";
import { LegacyHome } from "@/components/home/LegacyHome";
import { EditorialHome } from "@/components/home/EditorialHome";

describe("HomePage switch", () => {
  it("renders LegacyHome when discovery is disabled", async () => {
    discoverySurfaceResult = { enabled: false, preview: false };
    const element = (await HomePage()) as ReactElement;
    expect(element.type).toBe(LegacyHome);
  });

  it("renders EditorialHome when discovery is enabled", async () => {
    discoverySurfaceResult = { enabled: true, preview: false };
    const element = (await HomePage()) as ReactElement;
    expect(element.type).toBe(EditorialHome);
  });

  it("renders EditorialHome for an enabled admin preview too", async () => {
    discoverySurfaceResult = { enabled: true, preview: true };
    const element = (await HomePage()) as ReactElement;
    expect(element.type).toBe(EditorialHome);
  });
});
