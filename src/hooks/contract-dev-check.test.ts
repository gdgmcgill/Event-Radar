/**
 * The development-only response check (plan 06-11, REFAC-16, DEC-67).
 *
 * checkResponseInDev(label, loadSchema, json) runs a contract's response
 * schema over what a hook received, and only outside production. This suite
 * holds its three promises:
 *
 *   - in development (here NODE_ENV "test") a response that does not match
 *     warns once, `console.warn("[contract]", label, path, message)`, and the
 *     body itself is never printed (T-06-11-01);
 *   - it never throws, and a loader that fails is swallowed (T-06-11-02);
 *   - with NODE_ENV "production" no schema is loaded and nothing is printed,
 *     so production behaviour is unchanged.
 *
 * It exercises the helper directly and through two hooks with a mocked
 * fetch: useNotificationCount and useFeaturedEvents. Each hook still returns
 * the data it received, matching or not.
 *
 * Runs in the jsdom project (src/hooks/**), because the hooks render.
 */
import { renderHook, waitFor } from "@testing-library/react";
import { checkResponseInDev } from "@/lib/contractCheck";
import { useNotificationCount } from "./useNotificationCount";
import { useFeaturedEvents } from "./useFeaturedEvents";
import { NotificationCountResponse } from "@/contracts/notifications";

const NOTIFICATION_COUNT_ROUTE = "GET /api/notifications/count";

const ENV = process.env as Record<string, string | undefined>;

const mockFetch = jest.fn();
global.fetch = mockFetch;

let warn: jest.SpyInstance;

beforeEach(() => {
  mockFetch.mockReset();
  warn = jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
});

/** Run `fn` with NODE_ENV set to `value`, restoring it afterwards. */
async function withNodeEnv(value: string, fn: () => Promise<void>) {
  const saved = ENV.NODE_ENV;
  ENV.NODE_ENV = value;
  try {
    await fn();
  } finally {
    if (saved === undefined) delete ENV.NODE_ENV;
    else ENV.NODE_ENV = saved;
  }
}

/** Let every pending promise (a dynamic import, a safeParse) settle. */
async function settle() {
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function respond(body: unknown, ok = true) {
  mockFetch.mockResolvedValue({ ok, json: async () => body });
}

/** A value that must never reach the console (a stand-in for personal data). */
const SECRET = "student.person@mail.mcgill.ca";

function printed(): string {
  return JSON.stringify(warn.mock.calls);
}

// ─── checkResponseInDev, directly ────────────────────────────────────────────

describe("checkResponseInDev", () => {
  const load = () => Promise.resolve(NotificationCountResponse);

  it("warns once with [contract], the label, the first issue's path and message", async () => {
    await checkResponseInDev(NOTIFICATION_COUNT_ROUTE, load, {
      unread_count: "seven",
      email: SECRET,
    });

    expect(warn).toHaveBeenCalledTimes(1);
    const [tag, label, path, message] = warn.mock.calls[0];
    expect(tag).toBe("[contract]");
    expect(label).toBe(NOTIFICATION_COUNT_ROUTE);
    expect(path).toBe("unread_count");
    expect(typeof message).toBe("string");
    expect(message.length).toBeGreaterThan(0);
    expect(warn.mock.calls[0]).toHaveLength(4);
  });

  it("never prints the response body", async () => {
    await checkResponseInDev(NOTIFICATION_COUNT_ROUTE, load, {
      unread_count: SECRET,
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(printed()).not.toContain(SECRET);
    expect(printed()).not.toContain("mcgill");
  });

  it("names the root when the body itself is the wrong shape", async () => {
    await checkResponseInDev(NOTIFICATION_COUNT_ROUTE, load, [SECRET]);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][2]).toBe("(root)");
    expect(printed()).not.toContain(SECRET);
  });

  it("is silent on a matching response, extra keys included", async () => {
    await checkResponseInDev(NOTIFICATION_COUNT_ROUTE, load, {
      unread_count: 3,
      unlisted: true,
    });

    expect(warn).not.toHaveBeenCalled();
  });

  it("never throws: a loader that rejects is swallowed", async () => {
    const failing = () => Promise.reject(new Error("chunk failed"));

    await expect(
      checkResponseInDev(NOTIFICATION_COUNT_ROUTE, failing, { unread_count: "x" })
    ).resolves.toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it("never throws: a schema whose safeParse throws is swallowed", async () => {
    const broken = () =>
      Promise.resolve({
        safeParse: () => {
          throw new Error("boom");
        },
      });

    await expect(
      checkResponseInDev(NOTIFICATION_COUNT_ROUTE, broken, {})
    ).resolves.toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it("in production loads no schema and prints nothing", async () => {
    const loader = jest.fn(load);

    await withNodeEnv("production", async () => {
      await checkResponseInDev(NOTIFICATION_COUNT_ROUTE, loader, {
        unread_count: "seven",
      });
    });

    expect(loader).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});

// ─── Through useNotificationCount ────────────────────────────────────────────

describe("useNotificationCount with the development check", () => {
  it("warns on a drifted body in development and still returns the data", async () => {
    respond({ unread_count: "7" });

    const { result } = renderHook(() => useNotificationCount());

    await waitFor(() => expect(result.current).toBe("7"));
    await waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    expect(warn.mock.calls[0].slice(0, 3)).toEqual([
      "[contract]",
      "GET /api/notifications/count",
      "unread_count",
    ]);
  });

  it("is silent on the handler's real body", async () => {
    respond({ unread_count: 4 });

    const { result } = renderHook(() => useNotificationCount());

    await waitFor(() => expect(result.current).toBe(4));
    await settle();
    expect(warn).not.toHaveBeenCalled();
  });

  it("does not check a failed response", async () => {
    respond({ error: "Unauthorized" }, false);

    const { result } = renderHook(() => useNotificationCount());

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    await settle();
    expect(result.current).toBe(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it("in production neither warns nor throws, and returns the data", async () => {
    await withNodeEnv("production", async () => {
      respond({ unread_count: "7" });

      const { result } = renderHook(() => useNotificationCount());

      await waitFor(() => expect(result.current).toBe("7"));
      await settle();
    });

    expect(warn).not.toHaveBeenCalled();
  });
});

// ─── Through useFeaturedEvents ───────────────────────────────────────────────

describe("useFeaturedEvents with the development check", () => {
  const row = {
    id: "f1",
    event_id: "e1",
    sponsor_name: null,
    priority: 1,
    starts_at: "2026-09-01T00:00:00Z",
    ends_at: "2026-10-01T00:00:00Z",
    created_by: "u1",
    created_at: "2026-09-01T00:00:00Z",
    event: { id: "e1", title: "Open house", status: "approved" },
  };

  it("warns on a drifted row in development and still returns it", async () => {
    const drifted = { ...row, event: { ...row.event, id: 42 } };
    respond({ featured: [drifted] });

    const { result } = renderHook(() => useFeaturedEvents());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.featured).toEqual([drifted]);
    await waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    expect(warn.mock.calls[0].slice(0, 3)).toEqual([
      "[contract]",
      "GET /api/events/featured",
      "featured.0.event.id",
    ]);
    expect(printed()).not.toContain("Open house");
  });

  it("is silent on the handler's real body", async () => {
    respond({ featured: [row] });

    const { result } = renderHook(() => useFeaturedEvents());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.featured).toEqual([row]);
    await settle();
    expect(warn).not.toHaveBeenCalled();
  });

  it("in production neither warns nor throws, and returns the data", async () => {
    const drifted = { ...row, event: null };

    await withNodeEnv("production", async () => {
      respond({ featured: [drifted] });

      const { result } = renderHook(() => useFeaturedEvents());

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.featured).toEqual([drifted]);
      await settle();
    });

    expect(warn).not.toHaveBeenCalled();
  });
});
