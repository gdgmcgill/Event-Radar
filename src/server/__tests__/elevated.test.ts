/**
 * Unit tests for the single sanctioned door to the service-role client.
 *
 * The module is mocked by RELATIVE specifier on purpose. The aliased form of
 * the service module must appear in exactly one file under src/server/ — the
 * elevated module itself — and that is an asserted property of this plan, so a
 * test may not be the second occurrence. Both specifiers resolve to the same
 * module, so the mock still applies.
 */

const mockServiceClient = { __brand: "service-role-client" };
const mockCreateServiceClient = jest.fn(() => mockServiceClient);

jest.mock("../../lib/supabase/service", () => ({
  createServiceClient: () => mockCreateServiceClient(),
}));

import { getElevatedClient } from "../db/elevated";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getElevatedClient", () => {
  it("returns exactly the client the existing service factory produced", () => {
    const client = getElevatedClient();

    expect(client).toBe(mockServiceClient);
  });

  it("delegates to the existing factory rather than constructing a client", () => {
    getElevatedClient();

    expect(mockCreateServiceClient).toHaveBeenCalledTimes(1);
  });

  it("produces a client per call, holding no module-level singleton", () => {
    getElevatedClient();
    getElevatedClient();

    expect(mockCreateServiceClient).toHaveBeenCalledTimes(2);
  });
});
