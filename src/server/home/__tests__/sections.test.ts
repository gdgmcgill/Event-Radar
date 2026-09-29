/**
 * `homeSections` (Task 5): each of the three homepage sections is computed
 * independently, so one section throwing never blocks or fakes another. The
 * editorial-picks query is asserted by its filters, ordering and limit
 * rather than by a live database, since this suite runs against a recording
 * fake of the cookie-client query builder.
 */

import type { RequestContext } from "@/server/context";
import { discover } from "@/server/discovery/service";
import { listResources } from "@/server/resources/service";
import { log } from "@/server/log";
import { homeSections } from "../sections";

jest.mock("@/server/discovery/service", () => ({ discover: jest.fn() }));
jest.mock("@/server/resources/service", () => ({ listResources: jest.fn() }));

const mockDiscover = discover as jest.MockedFunction<typeof discover>;
const mockListResources = listResources as jest.MockedFunction<typeof listResources>;

interface RecordedCall {
  method: string;
  args: unknown[];
}

function makeContext(rows: unknown[], calls: RecordedCall[]): RequestContext {
  const record = (method: string, args: unknown[]) => {
    calls.push({ method, args });
    return chain;
  };
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    select: (...args: unknown[]) => record("select", args),
    eq: (...args: unknown[]) => record("eq", args),
    is: (...args: unknown[]) => record("is", args),
    lte: (...args: unknown[]) => record("lte", args),
    gt: (...args: unknown[]) => record("gt", args),
    order: (...args: unknown[]) => record("order", args),
    limit: (...args: unknown[]) => {
      calls.push({ method: "limit", args });
      return Promise.resolve({ data: rows, error: null });
    },
  };
  return {
    supabase: { from: () => chain } as unknown as RequestContext["supabase"],
    user: null,
    profile: null,
    requestId: "test-request",
  };
}

describe("homeSections", () => {
  beforeEach(() => {
    mockDiscover.mockReset();
    mockListResources.mockReset();
    jest.spyOn(log, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("isolates a thisWeek failure: picks and resources stay ok", async () => {
    mockDiscover.mockRejectedValue(new Error("discovery down"));
    mockListResources.mockResolvedValue([]);
    const ctx = makeContext([], []);

    const result = await homeSections(ctx);

    expect(result.thisWeek).toEqual({ status: "error" });
    expect(result.picks).toEqual({ status: "ok", items: [] });
    expect(result.resources).toEqual({ status: "ok", items: [] });
    expect(log.error).toHaveBeenCalledWith("home section failed", { section: "thisWeek" });
  });

  it("isolates a resources failure: thisWeek and picks stay ok", async () => {
    mockDiscover.mockResolvedValue({ items: [], next_cursor: null, as_of: "2026-09-29T00:00:00Z" });
    mockListResources.mockRejectedValue(new Error("resources down"));
    const ctx = makeContext([], []);

    const result = await homeSections(ctx);

    expect(result.resources).toEqual({ status: "error" });
    expect(result.thisWeek).toEqual({ status: "ok", items: [] });
    expect(result.picks).toEqual({ status: "ok", items: [] });
    expect(log.error).toHaveBeenCalledWith("home section failed", { section: "resources" });
  });

  it("requests thisWeek from discover() with the this_week window and a limit of 6", async () => {
    mockDiscover.mockResolvedValue({ items: [], next_cursor: null, as_of: "2026-09-29T00:00:00Z" });
    mockListResources.mockResolvedValue([]);
    const ctx = makeContext([], []);

    await homeSections(ctx);

    expect(mockDiscover).toHaveBeenCalledWith(ctx, { q: "", window: "this_week", limit: 6 });
  });

  it("filters picks by is_pick and a null canonical_id, orders by editorial_priority desc then actionable_at asc, and limits to 4", async () => {
    mockDiscover.mockResolvedValue({ items: [], next_cursor: null, as_of: "2026-09-29T00:00:00Z" });
    mockListResources.mockResolvedValue([]);
    const calls: RecordedCall[] = [];
    const ctx = makeContext([], calls);

    await homeSections(ctx);

    expect(calls).toContainEqual({ method: "eq", args: ["is_pick", true] });
    expect(calls).toContainEqual({ method: "is", args: ["canonical_id", null] });
    expect(calls).toContainEqual({ method: "order", args: ["editorial_priority", { ascending: false }] });
    expect(calls).toContainEqual({ method: "order", args: ["actionable_at", { ascending: true }] });
    expect(calls.find((call) => call.method === "limit")?.args).toEqual([4]);
  });

  it("marks every returned pick as not closed", async () => {
    mockDiscover.mockResolvedValue({ items: [], next_cursor: null, as_of: "2026-09-29T00:00:00Z" });
    mockListResources.mockResolvedValue([]);
    const row = { id: "pick-1", closed: true };
    const ctx = makeContext([row], []);

    const result = await homeSections(ctx);

    expect(result.picks).toEqual({ status: "ok", items: [{ id: "pick-1", closed: false }] });
  });
});
