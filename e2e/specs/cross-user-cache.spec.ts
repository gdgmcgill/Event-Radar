/**
 * cross-user-cache.spec.ts — B never receives A's personalized body through a
 * shared cache that caches exactly what Vercel's CDN would.
 *
 * Phase 06-slices-6-7-async-edge-contracts-caching-observability · plan 06-15
 * (REFAC-19, F-025's header clause, research C7 and Pitfall 10)
 *
 * WHY A STAND-IN
 *   Against `next start` alone there is no shared cache, so "B never sees A's
 *   data" would pass whatever the headers said. Every request below goes
 *   through `startSharedCacheProxy` (e2e/helpers/sharedCacheProxy.ts), which
 *   stores a response under `METHOD URL`, never the cookie, whenever Vercel's
 *   documented rules allow it, and answers `x-sim-cache: HIT|MISS|BYPASS`.
 *
 * WHAT IS PROVEN
 *   - Positive control: an anonymous public read HITs on its second request,
 *     without reaching the origin. The stand-in does cache.
 *   - Negative control: an in-spec upstream that answers a per-cookie body
 *     marked `public, s-maxage=60` leaks A's body to B with a HIT. The
 *     stand-in would catch a personalized route marked shareable. The same
 *     upstream, varied one rule at a time, shows each rule the stand-in
 *     models keeps B on B's own body.
 *   - Every personalized GET, persona A (club_member: an organizer of the
 *     approved club with a "going" RSVP) then persona B (onboarded_student:
 *     no membership, no RSVP) then anonymous, at the same URL: none is HIT,
 *     each answer is `private, no-store`, and neither B nor anonymous
 *     receives A's user id or text only A's answer carries (a saved event, a
 *     club, an RSVP row, the organizer view). Each A-only marker is first
 *     shown to be in A's body, so the absence check is not vacuous.
 *   - C7: the admin's 200 on a pending event is not served to an anonymous
 *     visitor (who gets a 404, not HIT), and the anonymous 404 is not served
 *     to the admin.
 *
 * RECORDED, NOT CHANGED HERE
 *   - A HIT replays the `x-request-id` of the request that filled the cache
 *     (06-12 note). That is what a shared cache does; the positive control
 *     asserts it so the behaviour is written down.
 *   - A public-class 404 is shared (06-12 decision: Vercel caches 404s). The
 *     club-detail read answers 404 for an unknown id and the second request
 *     HITs. 06-13 flagged that the same route answers 404 when its database
 *     read fails, so a transient error can be shared for 60 s; that trigger
 *     needs a fault the local stack cannot inject, so it goes to the register.
 *
 * STATE
 *   The one write is A's save of `secondApprovedEvent`, made directly against
 *   the origin so the saved-events row has an A-only item; the describe's
 *   afterAll removes it and asserts it is gone. The stand-in listens on an ephemeral
 *   port on localhost (the persona cookies are host-only for localhost, which
 *   ignores the port) and is closed in afterAll with the negative control's
 *   upstream. No body is written to disk.
 */

import http from "node:http";
import type { AddressInfo } from "node:net";

import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";

import { BASE_URL } from "../../playwright.config";
import { IDS, storageStateFor } from "../fixtures";
import {
  startSharedCacheProxy,
  type SharedCacheProxy,
} from "../helpers/sharedCacheProxy";

const PRIVATE = "private, no-store";
const PUBLIC_60_300 = "public, s-maxage=60, stale-while-revalidate=300";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test.describe.configure({ mode: "serial" });

let proxy: SharedCacheProxy;
let personaA: APIRequestContext;
let personaB: APIRequestContext;
let anonymous: APIRequestContext;
let admin: APIRequestContext;
let originA: APIRequestContext;

test.beforeAll(async () => {
  proxy = await startSharedCacheProxy(BASE_URL);
  const through = (state?: string) =>
    playwrightRequest.newContext({ baseURL: proxy.url, storageState: state });
  personaA = await through(storageStateFor("club_member"));
  personaB = await through(storageStateFor("onboarded_student"));
  admin = await through(storageStateFor("admin"));
  anonymous = await through();
  originA = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    storageState: storageStateFor("club_member"),
  });
});

test.afterAll(async () => {
  for (const ctx of [personaA, personaB, admin, anonymous, originA]) {
    await ctx?.dispose();
  }
  await proxy?.close();
});

const sim = (res: APIResponse) => res.headers()["x-sim-cache"];
const cacheControl = (res: APIResponse) => res.headers()["cache-control"];

// ─── Controls ────────────────────────────────────────────────────────────────

test("positive control: an anonymous public read HITs on its second request", async () => {
  const path = "/api/events/popular";
  const first = await anonymous.get(path);
  expect(first.status()).toBe(200);
  expect(cacheControl(first)).toBe(PUBLIC_60_300);
  expect(sim(first)).toBe("MISS");
  const firstId = first.headers()["x-request-id"];
  expect(firstId).toMatch(UUID);

  const before = proxy.stats();
  const second = await anonymous.get(path);
  expect(second.status()).toBe(200);
  expect(sim(second)).toBe("HIT");
  expect(proxy.stats().upstream, "a HIT never reaches the origin").toBe(
    before.upstream
  );
  expect(await second.text()).toBe(await first.text());
  // Recorded (06-12 note): the cached answer replays the filler's request id.
  expect(second.headers()["x-request-id"]).toBe(firstId);

  // A signed-in reader of the same URL gets the same shared copy: the key
  // ignores the cookie, which is exactly why personalized routes must not
  // be shareable.
  const third = await personaB.get(path);
  expect(sim(third)).toBe("HIT");
});

test.describe("negative control: a per-cookie body the stand-in is told it may share", () => {
  let upstream: http.Server;
  let leaky: SharedCacheProxy;
  let viewerA: APIRequestContext;
  let viewerB: APIRequestContext;

  /** Answers `{"viewer":"<who cookie>"}`; the path picks the header variant. */
  function answer(req: http.IncomingMessage, res: http.ServerResponse): void {
    const who = /(?:^|;\s*)who=([^;]+)/.exec(req.headers.cookie ?? "")?.[1] ?? "anonymous";
    const url = new URL(req.url ?? "/", "http://upstream");
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "cache-control": "public, s-maxage=60",
    };
    let status = 200;
    switch (url.pathname) {
      case "/shareable":
        break;
      case "/private":
        headers["cache-control"] = "private, no-store";
        break;
      case "/no-store":
        headers["cache-control"] = "public, s-maxage=60, no-store";
        break;
      case "/set-cookie":
        headers["set-cookie"] = "sb-session=refreshed; Path=/";
        break;
      case "/vary-cookie":
        headers.vary = "Cookie";
        break;
      case "/browser-only":
        headers["cache-control"] = "public, max-age=60";
        break;
      case "/zero":
        headers["cache-control"] = "public, s-maxage=0";
        break;
      case "/error":
        status = 500;
        break;
      case "/authorization":
        break;
      default:
        status = 404;
    }
    res.writeHead(status, headers);
    res.end(JSON.stringify({ viewer: who }));
  }

  test.beforeAll(async () => {
    upstream = http.createServer(answer);
    await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
    const { port } = upstream.address() as AddressInfo;
    leaky = await startSharedCacheProxy(`http://127.0.0.1:${port}`);
    viewerA = await playwrightRequest.newContext({
      baseURL: leaky.url,
      extraHTTPHeaders: { cookie: "who=A" },
    });
    viewerB = await playwrightRequest.newContext({
      baseURL: leaky.url,
      extraHTTPHeaders: { cookie: "who=B" },
    });
  });

  test.afterAll(async () => {
    await viewerA?.dispose();
    await viewerB?.dispose();
    await leaky?.close();
    await new Promise<void>((resolve) => (upstream ? upstream.close(() => resolve()) : resolve()));
  });

  test("negative control: B receives A's body with a HIT when a personalized answer is marked public", async () => {
    const a = await viewerA.get("/shareable");
    expect(await a.json()).toEqual({ viewer: "A" });
    expect(sim(a)).toBe("MISS");

    const b = await viewerB.get("/shareable");
    expect(sim(b)).toBe("HIT");
    expect(await b.json(), "the stand-in leaks, as Vercel would").toEqual({
      viewer: "A",
    });
  });

  const REFUSALS: [string, string, Record<string, string>][] = [
    ["private, no-store", "/private", {}],
    ["no-store beside s-maxage", "/no-store", {}],
    ["a Set-Cookie on the answer", "/set-cookie", {}],
    ["Vary: Cookie", "/vary-cookie", {}],
    ["max-age without s-maxage", "/browser-only", {}],
    ["s-maxage=0", "/zero", {}],
    ["a 500", "/error", {}],
    ["an Authorization header on the request", "/authorization", { authorization: "Bearer x" }],
  ];

  for (const [rule, path, headers] of REFUSALS) {
    test(`the stand-in refuses to share: ${rule}`, async () => {
      const a = await viewerA.get(path, { headers });
      expect(sim(a)).toBe("BYPASS");
      const b = await viewerB.get(path, { headers });
      expect(sim(b)).toBe("BYPASS");
      expect(await b.json()).toEqual({ viewer: "B" });
    });
  }

  test("the stand-in refuses to share a POST", async () => {
    const a = await viewerA.post("/shareable");
    expect(sim(a)).toBe("BYPASS");
    const b = await viewerB.post("/shareable");
    expect(sim(b)).toBe("BYPASS");
    expect(await b.json()).toEqual({ viewer: "B" });
  });
});

// ─── Personalized routes: A, then B, then anonymous ─────────────────────────

/** Each personalized GET, with the text only persona A's answer carries. */
const PERSONALIZED: { path: string; aOnly: string[]; why: string }[] = [
  {
    path: "/api/users/saved-events",
    aOnly: [IDS.secondApprovedEvent],
    why: "A saves secondApprovedEvent for this test",
  },
  { path: "/api/notifications", aOnly: [], why: "no seeded notification" },
  { path: "/api/notifications/count", aOnly: [], why: "a count, no ids" },
  { path: "/api/recommendations", aOnly: [], why: "the feed carries no viewer id" },
  { path: "/api/users/me/friends", aOnly: [], why: "no seeded follow" },
  {
    path: "/api/my-clubs",
    aOnly: [IDS.approvedClub],
    why: "A is an organizer of the approved club",
  },
  {
    path: `/api/events/${IDS.approvedEvent}/rsvp`,
    aOnly: [IDS.rsvpGoing],
    why: "A's own going RSVP row",
  },
  {
    // A is an organizer, so the answer carries the organizer flag and the
    // per-event RSVP counts (DEC-69's member view). RLS still hides the
    // pending event from A, because only its creator (club_owner) may read
    // it ("Organizers can view own events"); measured on the first run.
    path: `/api/clubs/${IDS.approvedClub}/events`,
    aOnly: ['"isOrganizer":true', '"rsvp_counts"'],
    why: "A's organizer view: the flag and the RSVP counts",
  },
  { path: "/api/user/following", aOnly: [], why: "no seeded club follow" },
];

const SAVE = `/api/events/${IDS.secondApprovedEvent}/save`;

async function ensureUnsaved(): Promise<void> {
  const list = await originA.get("/api/users/saved-events");
  expect(list.status()).toBe(200);
  const { savedEventIds } = (await list.json()) as { savedEventIds: string[] };
  if (savedEventIds.includes(IDS.secondApprovedEvent)) {
    const res = await originA.delete(SAVE);
    expect(res.status()).toBe(200);
  }
}

test.describe("personalized GETs through the shared cache", () => {
  test.beforeAll(async () => {
    await ensureUnsaved();
    const res = await originA.post(SAVE);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ saved: true });
  });

  test.afterAll(async () => {
    await ensureUnsaved();
    const list = await originA.get("/api/users/saved-events");
    const { savedEventIds } = (await list.json()) as { savedEventIds: string[] };
    expect(savedEventIds, "the restore leaves no saved row").not.toContain(
      IDS.secondApprovedEvent
    );
  });

  for (const { path, aOnly, why } of PERSONALIZED) {
    test(`${path}: A then B then anonymous, never shared (${why})`, async () => {
      const a = await personaA.get(path);
      expect(a.status()).toBe(200);
      expect(cacheControl(a)).toBe(PRIVATE);
      expect(sim(a)).not.toBe("HIT");
      const bodyA = await a.text();
      for (const marker of aOnly) {
        expect(bodyA, `A's own answer carries ${marker}`).toContain(marker);
      }

      const b = await personaB.get(path);
      expect(b.status()).toBe(200);
      expect(cacheControl(b)).toBe(PRIVATE);
      expect(sim(b)).not.toBe("HIT");
      const bodyB = await b.text();
      expect(bodyB).not.toContain(IDS.club_member);
      for (const marker of aOnly) expect(bodyB).not.toContain(marker);

      const anon = await anonymous.get(path);
      expect(cacheControl(anon)).toBe(PRIVATE);
      expect(sim(anon)).not.toBe("HIT");
      const bodyAnon = await anon.text();
      expect(bodyAnon).not.toContain(IDS.club_member);
      for (const marker of aOnly) expect(bodyAnon).not.toContain(marker);
    });
  }
});

// ─── C7: the pending event ───────────────────────────────────────────────────

test("C7: the admin's 200 on a pending event is not served to an anonymous visitor", async () => {
  const path = `/api/events/${IDS.pendingEvent}`;
  const adminRes = await admin.get(path);
  expect(adminRes.status()).toBe(200);
  expect(cacheControl(adminRes)).toBe(PRIVATE);
  expect(sim(adminRes)).not.toBe("HIT");
  expect(await adminRes.text()).toContain(IDS.pendingEvent);

  const anon = await anonymous.get(path);
  expect(anon.status()).toBe(404);
  expect(cacheControl(anon)).toBe(PRIVATE);
  expect(sim(anon)).not.toBe("HIT");
  expect(await anon.text()).not.toContain(IDS.pendingEvent);
});

test("C7: an anonymous 404 on a pending event is not served to the admin", async () => {
  const path = `/api/events/${IDS.pendingEvent}`;
  const anon = await anonymous.get(path);
  expect(anon.status()).toBe(404);
  expect(sim(anon)).not.toBe("HIT");

  const adminRes = await admin.get(path);
  expect(adminRes.status()).toBe(200);
  expect(sim(adminRes)).not.toBe("HIT");
});

// ─── Recorded behaviour of the public classes ───────────────────────────────

test("recorded: a public-class 404 is shared (the club detail read, unknown id)", async () => {
  const path = "/api/clubs/5eed0000-0000-4000-8000-0000000000ff";
  const first = await anonymous.get(path);
  expect(first.status()).toBe(404);
  expect(cacheControl(first)).toBe(PUBLIC_60_300);
  expect(sim(first)).toBe("MISS");
  const second = await personaB.get(path);
  expect(second.status()).toBe(404);
  expect(sim(second)).toBe("HIT");
});
