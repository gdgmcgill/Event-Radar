/** CERT-18 local outage/recovery exercise.
 * Real Supabase query serialization and real route/cache/error handling run
 * against an injected fetch transport. No live backend, Docker service, or
 * production configuration is read or interrupted. */
// eslint-disable-next-line @typescript-eslint/no-restricted-imports -- CERT-18 tests the real SDK transport, injected with an in-memory fetch; no application client or live credentials are created.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { captureServerError } from "@/server/observability/sentry";

let mockClient: SupabaseClient;
jest.mock("@/lib/supabase/server", () => ({ createClient: async () => mockClient }));
jest.mock("@/server/observability/sentry", () => ({ captureServerError: jest.fn() }));

const outage = new TypeError("private upstream outage sentinel");
const routes = [
  { path: "/api/clubs/new", key: "clubs", call: async () => (await import("@/app/api/clubs/new/route")).GET() },
  { path: "/api/clubs/trending", key: "clubs", call: async () => (await import("@/app/api/clubs/trending/route")).GET(new NextRequest("https://app.invalid/api/clubs/trending")) },
  { path: "/api/events/new", key: "events", call: async () => (await import("@/app/api/events/new/route")).GET() },
];

beforeEach(() => {
  jest.mocked(captureServerError).mockClear();
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it.each(routes)("$path fails privately during transport outage and recovers without restart", async ({ key, call }) => {
  let unavailable = true;
  const transport = jest.fn(async (input: Parameters<typeof fetch>[0]) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    expect(url.origin).toBe("http://chaos.invalid");
    expect(url.pathname).toBe(`/rest/v1/${key}`);
    if (unavailable) throw outage;
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  });
  mockClient = createClient("http://chaos.invalid", "local-chaos-anon-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    // Retry timing belongs to the SDK; exercise its terminal transport-error
    // result without waiting through backoff in a deterministic unit check.
    db: { retry: false },
    global: { fetch: transport },
  });
  const failed = await call();
  expect(failed.status).toBe(500);
  expect(failed.headers.get("cache-control")).toBe("private, no-store");
  expect(await failed.text()).not.toContain(outage.message);
  expect(captureServerError).toHaveBeenCalledTimes(1);
  expect(transport).toHaveBeenCalled();

  unavailable = false;
  const recovered = await call();
  expect(recovered.status).toBe(200);
  expect(recovered.headers.get("cache-control")).toBe("public, s-maxage=60, stale-while-revalidate=300");
  expect(await recovered.json()).toEqual({ [key]: [] });
  expect(captureServerError).toHaveBeenCalledTimes(1);
});
