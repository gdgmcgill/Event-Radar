/**
 * DEFECT characterization — F-005: the public profile page shows a private profile to an anonymous reader, and reads email
 *
 * Status: OPEN — the private-profile rows move in 05-15 (DEC-48).
 *
 * Subject: `src/app/users/[id]/page.tsx`, both exports, written against the
 * unmodified page at plan 05-12's base commit (4e368b6).
 *
 *   `generateMetadata()` reads the target's `name` on the service-role client
 *   and never reads the session, so any caller, signed in or not, gets the
 *   target's name in the document title whatever the profile's visibility.
 *
 *   The page reads the session (cookie client) only to redirect the owner to
 *   `/profile` and to read follow state. The target row comes from the
 *   service-role client with a select that includes `email`, and the only
 *   gate is `notFound()` when that read fails. A `visibility: "private"`
 *   target viewed anonymously therefore renders: `isPublic` is false, but the
 *   page still returns markup (name, avatar, the "private" notice) instead of
 *   a 404.
 *
 * Pinned today (measured; `evidence/slice-5-characterization.txt` § 2.2):
 *   P1  `generateMetadata` for a private target, anonymous: the title is
 *       `"<name> | UNI-VERSE"` and no session read happens.
 *   P2  the page for a private target, anonymous: `notFound()` is NOT called
 *       and the page returns an element whose markup carries the name.
 *   P3  the page's `users` select column string contains `email`.
 * Fixed (05-15, DEC-48): P1 `notFound()` (or a not-found title) for an
 * anonymous viewer of a private profile; P2 `notFound()`; P3 the select is
 * narrowed to `id, name, avatar_url, banner_url, pronouns, year, faculty,
 * visibility, interest_tags, created_at` with no `email`.
 *
 * Does NOT move: a PUBLIC target viewed anonymously renders (no `notFound()`),
 * and its metadata title carries the name.
 *
 * Mocks: `@/lib/supabase/service` returns a recording fake that answers every
 * table from fixtures and logs each select string; `@/lib/supabase/server`
 * returns an anonymous session (getUser yields no user); `next/navigation`'s
 * `notFound` and `redirect` throw sentinel errors, as the real ones throw.
 * This suite runs in the jsdom project (`*.test.tsx`).
 */

import { render } from "@testing-library/react";
import type { ReactElement } from "react";

// ─── Recording service fake ────────────────────────────────────────────────

interface ServiceCall {
  table: string;
  select: string | null;
}

let serviceCalls: ServiceCall[] = [];
let targetRow: Record<string, unknown> | null = null;
let sessionReads = 0;

function tableResult(table: string): { data: unknown; error: unknown; count: number | null } {
  if (table === "users") {
    return targetRow
      ? { data: targetRow, error: null, count: null }
      : { data: null, error: { code: "PGRST116", message: "no rows" }, count: null };
  }
  if (table === "saved_events" || table === "events") {
    return { data: null, error: null, count: 0 };
  }
  return { data: [], error: null, count: null };
}

function builder(table: string) {
  const call: ServiceCall = { table, select: null };
  serviceCalls.push(call);
  const result = () => tableResult(table);
  const chain: Record<string, unknown> = {
    select: (columns: string) => {
      call.select = columns;
      return chain;
    },
    single: () => Promise.resolve(result()),
    maybeSingle: () => Promise.resolve(result()),
    then: (
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(result()).then(onFulfilled, onRejected),
  };
  for (const method of ["eq", "neq", "lt", "lte", "gt", "gte", "is", "in", "order", "limit"]) {
    chain[method] = () => chain;
  }
  return chain;
}

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => builder(table),
    rpc: (name: string) => {
      serviceCalls.push({ table: `rpc:${name}`, select: null });
      const settled = { data: [], error: null };
      const rpcChain: Record<string, unknown> = {
        limit: () => rpcChain,
        then: (onFulfilled: (value: unknown) => unknown) =>
          Promise.resolve(settled).then(onFulfilled),
      };
      return rpcChain;
    },
  }),
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      auth: {
        getUser: async () => {
          sessionReads += 1;
          return { data: { user: null }, error: null };
        },
      },
      from: () => {
        throw new Error("the anonymous page read a table on the cookie client");
      },
    }),
}));

const NOT_FOUND = "NEXT_NOT_FOUND_SENTINEL";
const REDIRECT = "NEXT_REDIRECT_SENTINEL";

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND_SENTINEL");
  }),
  redirect: jest.fn(() => {
    throw new Error("NEXT_REDIRECT_SENTINEL");
  }),
}));

// ─── Fixture ───────────────────────────────────────────────────────────────

const TARGET_ID = "5eed0000-0000-4000-8000-0a5200000001";

function target(visibility: "public" | "private"): Record<string, unknown> {
  return {
    id: TARGET_ID,
    name: "Private Person",
    avatar_url: null,
    banner_url: null,
    email: "private.person@mail.mcgill.ca",
    pronouns: null,
    year: "2027",
    faculty: "Science",
    visibility,
    interest_tags: ["academic"],
    created_at: "2026-01-15T00:00:00+00:00",
  };
}

const params = () => ({ params: Promise.resolve({ id: TARGET_ID }) });

type PageModule = typeof import("@/app/users/[id]/page");

async function load(): Promise<PageModule> {
  return import("@/app/users/[id]/page");
}

async function renderPage(
  mod: PageModule
): Promise<{ element: ReactElement | null; thrown: string | null }> {
  try {
    const element = (await mod.default(params())) as ReactElement;
    return { element, thrown: null };
  } catch (error) {
    return {
      element: null,
      thrown: error instanceof Error ? error.message : String(error),
    };
  }
}

/** The rendered text of the page's element (jsdom render; react-dom/server needs TextEncoder). */
function textOf(element: ReactElement | null): string {
  if (!element) return "";
  const { container, unmount } = render(element);
  const text = container.textContent ?? "";
  unmount();
  return text;
}

beforeEach(() => {
  serviceCalls = [];
  sessionReads = 0;
  targetRow = null;
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Moves in 05-15 ────────────────────────────────────────────────────────

describe("F-005 today: a private profile, viewed anonymously", () => {
  it("P1: generateMetadata puts the private target's name in the title without reading the session", async () => {
    targetRow = target("private");
    const mod = await load();
    const metadata = await mod.generateMetadata(params());

    expect(metadata.title).toBe("Private Person | UNI-VERSE");
    expect(sessionReads).toBe(0);
    expect(serviceCalls.map((c) => [c.table, c.select])).toEqual([["users", "name"]]);
  });

  it("P2: the page renders instead of calling notFound()", async () => {
    targetRow = target("private");
    const mod = await load();
    const { notFound } = jest.requireMock<{ notFound: jest.Mock }>("next/navigation");
    const { element, thrown } = await renderPage(mod);

    expect(thrown).toBeNull();
    expect(thrown).not.toBe(NOT_FOUND);
    expect(notFound).not.toHaveBeenCalled();
    expect(element).not.toBeNull();
    expect(textOf(element)).toContain("Private Person");
  });

  it("P3: the page's users select reads email", async () => {
    targetRow = target("private");
    const mod = await load();
    await renderPage(mod);

    const usersSelects = serviceCalls
      .filter((c) => c.table === "users")
      .map((c) => c.select ?? "");
    expect(usersSelects).toHaveLength(1);
    expect(usersSelects[0]).toContain("email");
    expect(usersSelects[0]).toBe(
      "id, name, avatar_url, banner_url, email, pronouns, year, faculty, visibility, interest_tags, created_at"
    );
  });
});

// ─── Does not move ─────────────────────────────────────────────────────────

describe("F-005 rows that do not move: a public profile, viewed anonymously", () => {
  it("renders, and notFound() is not called", async () => {
    targetRow = target("public");
    const mod = await load();
    const { notFound, redirect } = jest.requireMock<{
      notFound: jest.Mock;
      redirect: jest.Mock;
    }>("next/navigation");
    const { element, thrown } = await renderPage(mod);

    expect(thrown).toBeNull();
    expect(thrown).not.toBe(REDIRECT);
    expect(notFound).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(textOf(element)).toContain("Private Person");
  });

  it("its metadata title carries the name", async () => {
    targetRow = target("public");
    const mod = await load();
    const metadata = await mod.generateMetadata(params());

    expect(metadata.title).toBe("Private Person | UNI-VERSE");
  });

  it("a missing target calls notFound()", async () => {
    targetRow = null;
    const mod = await load();
    const { thrown } = await renderPage(mod);

    expect(thrown).toBe(NOT_FOUND);
  });
});
