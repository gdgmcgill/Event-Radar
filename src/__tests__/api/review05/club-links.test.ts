/**
 * Club link fields on the elevated write paths (REVIEW-05 WR-09).
 *
 * `new URL(value)` accepts `javascript:alert(1)`, and the club page renders
 * these fields as `href`. `logo_url`/`banner_url` were not checked at all,
 * and non-string JSON values passed straight to a service-role write.
 *
 *   PATCH /api/clubs/[id]: every whitelisted value must be a string or null;
 *     every link field (website, discord, twitter, linkedin, logo, banner)
 *     must be an absolute http(s) URL (unparseable values were already
 *     refused and still are).
 *   POST /api/clubs: the optional fields must be strings when present, and a
 *     link that parses to a non-http(s) scheme is refused. A value that does
 *     not parse (for example "yourclub.com" typed into the free-text form) is
 *     still accepted, as before.
 */

import {
  CLUB_ID,
  STUDENT,
  callsTo,
  idParams,
  jsonRequest,
  makeFake,
  profileOf,
  writes,
  type Fake,
} from "./fake";
import { hasUnsafeUrlScheme, isHttpUrl } from "@/lib/sanitize";

let mockCookie: Fake;
let mockElevated: Fake;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockCookie.client),
}));
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => mockElevated.client,
  serviceRoleKey: () => "test-service-role-key",
}));

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const UNSAFE = [
  "javascript:alert(1)",
  "JavaScript:alert(document.cookie)",
  "java\tscript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "vbscript:msgbox(1)",
];

describe("isHttpUrl / hasUnsafeUrlScheme", () => {
  it.each(UNSAFE)("%p is not an http URL and is flagged unsafe", (value) => {
    expect(isHttpUrl(value)).toBe(false);
    expect(hasUnsafeUrlScheme(value)).toBe(true);
  });

  it.each(["https://club.example", "http://127.0.0.1:54321/storage/v1/x.png"])(
    "%p is an http URL and not flagged",
    (value) => {
      expect(isHttpUrl(value)).toBe(true);
      expect(hasUnsafeUrlScheme(value)).toBe(false);
    }
  );

  it("an unparseable value is not an http URL, and not flagged unsafe", () => {
    expect(isHttpUrl("yourclub.com")).toBe(false);
    expect(hasUnsafeUrlScheme("yourclub.com")).toBe(false);
  });
});

describe("PATCH /api/clubs/[id] as the owner", () => {
  function asOwner(): void {
    mockCookie = makeFake({
      user: STUDENT,
      profile: profileOf(STUDENT.id, ["user"]),
      answers: { "club_members.select": { data: { role: "owner" } } },
    });
    mockElevated = makeFake({
      answers: { "clubs.update": { data: { id: CLUB_ID } } },
    });
  }

  async function patch(body: Record<string, unknown>) {
    const { PATCH } = await import("@/app/api/clubs/[id]/route");
    return PATCH(jsonRequest(`clubs/${CLUB_ID}`, "PATCH", body), idParams(CLUB_ID));
  }

  const LINKS = [
    "website_url",
    "discord_url",
    "twitter_url",
    "linkedin_url",
    "logo_url",
    "banner_url",
  ];

  describe.each(LINKS)("%s", (field) => {
    it.each(UNSAFE)("refuses %p with 400 and writes nothing", async (value) => {
      asOwner();
      const res = await patch({ [field]: value });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: `Invalid URL for ${field}` });
      expect(writes(mockElevated)).toEqual([]);
    });

    it("accepts an https URL", async () => {
      asOwner();
      const res = await patch({ [field]: " https://club.example/x " });
      expect(res.status).toBe(200);
      const [update] = callsTo(mockElevated, "clubs", "update");
      expect(update.payload).toEqual({ [field]: "https://club.example/x" });
    });
  });

  it.each([[42], [true], [{ a: 1 }], [["x"]]])(
    "refuses a non-string value %p with 400 naming the field",
    async (value) => {
      asOwner();
      const res = await patch({ description: value });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "Invalid value for description",
        field: "description",
      });
      expect(writes(mockElevated)).toEqual([]);
    }
  );

  it("null and blank strings still clear a column", async () => {
    asOwner();
    const res = await patch({ discord_url: null, website_url: "  " });
    expect(res.status).toBe(200);
    const [update] = callsTo(mockElevated, "clubs", "update");
    expect(update.payload).toEqual({ discord_url: null, website_url: null });
  });
});

describe("POST /api/clubs", () => {
  function asStudent(): void {
    mockCookie = makeFake({
      user: STUDENT,
      profile: profileOf(STUDENT.id, ["user"]),
      answers: { "users.select": { data: { roles: ["user"] } } },
    });
    mockElevated = makeFake({
      answers: { "clubs.insert": { data: { id: CLUB_ID, name: "Club" } } },
    });
  }

  const BASE = {
    name: "Review Club",
    description: "A club",
    category: "Academic",
    contact_email: "club@mail.mcgill.ca",
  };

  async function post(extra: Record<string, unknown>) {
    const { POST } = await import("@/app/api/clubs/route");
    return POST(jsonRequest("clubs", "POST", { ...BASE, ...extra }));
  }

  it.each(UNSAFE)("refuses website_url %p with 400 and inserts nothing", async (value) => {
    asStudent();
    const res = await post({ website_url: value });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid URL for website_url" });
    expect(writes(mockElevated)).toEqual([]);
  });

  it("refuses a javascript: logo_url", async () => {
    asStudent();
    const res = await post({ logo_url: "javascript:alert(1)" });
    expect(res.status).toBe(400);
    expect(writes(mockElevated)).toEqual([]);
  });

  it.each([[42], [{ a: 1 }], [true]])(
    "refuses a non-string discord_url %p with 400 naming the field",
    async (value) => {
      asStudent();
      const res = await post({ discord_url: value });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "Invalid value for discord_url",
        field: "discord_url",
      });
      expect(writes(mockElevated)).toEqual([]);
    }
  );

  it("still accepts a scheme-less website typed into the form, and an https one", async () => {
    asStudent();
    const res = await post({
      website_url: "yourclub.com",
      linkedin_url: "https://linkedin.com/company/x",
    });
    expect(res.status).toBe(201);
    const [insert] = callsTo(mockElevated, "clubs", "insert");
    expect(insert.payload).toMatchObject({
      website_url: "yourclub.com",
      linkedin_url: "https://linkedin.com/company/x",
    });
  });
});
