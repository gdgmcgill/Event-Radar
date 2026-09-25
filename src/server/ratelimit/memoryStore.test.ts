/**
 * The in-memory rate-limit store (plan 05-17, DEC-50, REFAC-18).
 *
 * The window is fixed and starts at the first hit: `limit` requests are
 * allowed, the next one is denied with `resetAtMs` equal to the first hit plus
 * the window, and a request at or after `resetAtMs` opens a new window. Time
 * is injected (`nowMs` for `consumeSync`, a clock function for
 * `MemoryRateLimitStore`), so nothing here waits or mocks timers.
 *
 * Every test uses its own key: the bucket map lives on `globalThis` for the
 * whole file, exactly as it does for the synchronous wrapper.
 */

import { MemoryRateLimitStore, consumeSync } from "./memoryStore";

const WINDOW = 60_000;
const T0 = 5_000_000;

describe("consumeSync", () => {
  it("allows `limit` hits in one window and denies the next with resetAtMs = first hit + window", () => {
    const key = "POST:/api/a:10.0.0.1";
    for (let i = 0; i < 3; i++) {
      expect(consumeSync(key, 3, WINDOW, T0 + i * 10)).toEqual({
        allowed: true,
        limit: 3,
        resetAtMs: T0 + WINDOW,
      });
    }
    expect(consumeSync(key, 3, WINDOW, T0 + 500)).toEqual({
      allowed: false,
      limit: 3,
      resetAtMs: T0 + WINDOW,
    });
    // A denied hit does not extend the window.
    expect(consumeSync(key, 3, WINDOW, T0 + WINDOW - 1)).toEqual({
      allowed: false,
      limit: 3,
      resetAtMs: T0 + WINDOW,
    });
  });

  it("opens a new window at resetAtMs, anchored on that hit", () => {
    const key = "POST:/api/b:10.0.0.2";
    consumeSync(key, 1, WINDOW, T0);
    expect(consumeSync(key, 1, WINDOW, T0 + 1).allowed).toBe(false);

    const reopened = consumeSync(key, 1, WINDOW, T0 + WINDOW);
    expect(reopened).toEqual({
      allowed: true,
      limit: 1,
      resetAtMs: T0 + WINDOW + WINDOW,
    });
    expect(consumeSync(key, 1, WINDOW, T0 + WINDOW + 1).allowed).toBe(false);
  });

  it("keeps keys independent", () => {
    consumeSync("GET:/api/c:10.0.0.3", 1, WINDOW, T0);
    expect(consumeSync("GET:/api/c:10.0.0.3", 1, WINDOW, T0).allowed).toBe(false);
    expect(consumeSync("GET:/api/c:10.0.0.4", 1, WINDOW, T0).allowed).toBe(true);
    expect(consumeSync("POST:/api/c:10.0.0.3", 1, WINDOW, T0).allowed).toBe(true);
  });

  it("shares its bucket map with the synchronous wrapper through globalThis", () => {
    const map = (globalThis as Record<string, unknown>)[
      "__uni_verse_mw_rate_limit__"
    ];
    expect(map).toBeInstanceOf(Map);
    consumeSync("GET:/api/d:10.0.0.5", 5, WINDOW, T0);
    expect((map as Map<string, unknown>).has("GET:/api/d:10.0.0.5")).toBe(true);
  });
});

describe("MemoryRateLimitStore", () => {
  it("resolves the same decisions as consumeSync, on its injected clock", async () => {
    let now = T0 + 1_000_000;
    const store = new MemoryRateLimitStore(() => now);
    const key = "POST:/api/e:10.0.0.6";

    await expect(store.consume(key, 2, WINDOW)).resolves.toEqual({
      allowed: true,
      limit: 2,
      resetAtMs: now + WINDOW,
    });
    const first = now;
    now += 100;
    await expect(store.consume(key, 2, WINDOW)).resolves.toMatchObject({ allowed: true });
    now += 100;
    await expect(store.consume(key, 2, WINDOW)).resolves.toEqual({
      allowed: false,
      limit: 2,
      resetAtMs: first + WINDOW,
    });
    now = first + WINDOW;
    await expect(store.consume(key, 2, WINDOW)).resolves.toMatchObject({
      allowed: true,
      resetAtMs: first + WINDOW + WINDOW,
    });
  });

  it("defaults its clock to Date.now", async () => {
    const before = Date.now();
    const decision = await new MemoryRateLimitStore().consume(
      "GET:/api/f:10.0.0.7",
      1,
      WINDOW
    );
    expect(decision.allowed).toBe(true);
    expect(decision.resetAtMs).toBeGreaterThanOrEqual(before + WINDOW);
    expect(decision.resetAtMs).toBeLessThanOrEqual(Date.now() + WINDOW);
  });
});
