/**
 * Unit tests for the per-request context.
 *
 * The properties that matter are: the context awaits the EXISTING server
 * factory rather than constructing a fourth Supabase client; it reads the
 * revalidating user accessor; and an anonymous request never reaches the
 * profile table.
 */

type QueryResult = { data: unknown; error: unknown };

function createChain(result: QueryResult) {
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.single = jest.fn(() => Promise.resolve(result));
  chain.maybeSingle = jest.fn(() => Promise.resolve(result));
  return chain;
}

const mockGetUser = jest.fn();
const mockFrom = jest.fn();

const mockSupabase = {
  auth: { getUser: mockGetUser },
  from: mockFrom,
};

const mockCreateClient = jest.fn(() => Promise.resolve(mockSupabase));

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

import { createRequestContext, getRequestContext } from "../context";

const AUTHENTICATED_USER = { id: "user-1", email: "someone@mail.mcgill.ca" };

const PROFILE_ROW = {
  id: "user-1",
  roles: ["user"],
  onboarding_completed: true,
};

let profileResult: QueryResult;
let lastChain: Record<string, jest.Mock> | null;
let lastTable: string | null;

beforeEach(() => {
  jest.clearAllMocks();
  profileResult = { data: PROFILE_ROW, error: null };
  lastChain = null;
  lastTable = null;
  mockGetUser.mockResolvedValue({
    data: { user: AUTHENTICATED_USER },
    error: null,
  });
  mockFrom.mockImplementation((table: string) => {
    lastTable = table;
    lastChain = createChain(profileResult);
    return lastChain;
  });
});

describe("createRequestContext", () => {
  it("returns the client produced by the existing server factory", async () => {
    const ctx = await createRequestContext();

    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    expect(ctx.supabase).toBe(mockSupabase);
  });

  it("reads the revalidating user accessor rather than a session", async () => {
    // The mock's `auth` deliberately exposes the revalidating accessor and
    // nothing else, so an implementation that reached for a session-only
    // accessor would throw here rather than pass quietly.
    await createRequestContext();

    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(Object.keys(mockSupabase.auth)).toEqual(["getUser"]);
  });

  it("carries the authenticated user", async () => {
    const ctx = await createRequestContext();

    expect(ctx.user).toEqual(AUTHENTICATED_USER);
  });

  it("reads the five-column profile slice from the users table", async () => {
    const ctx = await createRequestContext();

    expect(lastTable).toBe("users");
    const selected = String(lastChain?.select.mock.calls[0][0]);
    expect(selected.split(",").map((column) => column.trim())).toEqual([
      "id",
      "roles",
      "onboarding_completed",
      "banned_at",
      "ban_expires_at",
    ]);
    expect(ctx.profile).toEqual(PROFILE_ROW);
  });

  it("scopes the profile read to the authenticated user's id", async () => {
    await createRequestContext();

    expect(lastChain?.eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("returns a null user and a null profile for an anonymous request", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const ctx = await createRequestContext();

    expect(ctx.user).toBeNull();
    expect(ctx.profile).toBeNull();
  });

  it("never reaches the profile table for an anonymous request", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await createRequestContext();

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns a null profile when the row is missing rather than throwing", async () => {
    profileResult = { data: null, error: { message: "no rows" } };

    const ctx = await createRequestContext();

    expect(ctx.user).toEqual(AUTHENTICATED_USER);
    expect(ctx.profile).toBeNull();
  });

  it("stamps a distinct request id on each call", async () => {
    const first = await createRequestContext();
    const second = await createRequestContext();

    expect(first.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(second.requestId).not.toBe(first.requestId);
  });
});

describe("getRequestContext", () => {
  it("is callable and produces the same context shape", async () => {
    const ctx = await getRequestContext();

    expect(ctx.user).toEqual(AUTHENTICATED_USER);
    expect(ctx.profile).toEqual(PROFILE_ROW);
    expect(typeof ctx.requestId).toBe("string");
  });

  it("falls back to the un-memoized function on a React without `cache`", () => {
    // React is pinned to 18.3.x, which exports `cache` from neither build. The
    // alias must therefore BE `createRequestContext` here — and the fallback is
    // correct, just un-memoized. Asserting the identity pins the fallback in
    // place so it cannot silently become a module-level cache, which would be
    // scoped to the process rather than the request.
    expect(getRequestContext).toBe(createRequestContext);
  });
});
