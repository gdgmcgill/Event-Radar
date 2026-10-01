/**
 * DEFECT characterization — F-094 (DI-66, DEC-66): club links follow two
 * rules, so the settings form cannot save a link the create form accepted
 *
 * POST /api/clubs refused only a link that parses to a non-http(s) scheme and
 * stored a scheme-less value such as "yourclub.com" verbatim (a relative link
 * on the club page). PATCH /api/clubs/[id] refused every value that is not an
 * absolute http(s) URL, so "club.ca" answered 400 `Invalid URL for
 * website_url` (05-REVIEW-FIX.md IN-04, DI-66).
 *
 * Both pins below were moved out of PRESERVE by plan 06-09, in the commit
 * that gives club links one rule (ClubLinkFields in src/contracts/clubs.ts):
 *   - `club PATCH: URL relative` from src/__tests__/contracts/badRequestTable.ts
 *     (the 06-07 table, read by bad-request-characterization.test.ts);
 *   - "still accepts a scheme-less website typed into the form, and an https
 *     one" from src/__tests__/api/review05/club-links.test.ts.
 * Each has a defect-ledger row.
 *
 * MOVED (plan 06-09, F-094, DEC-66, INTENTIONAL BEHAVIOUR CHANGE). A
 * scheme-less host path is now stored with https:// prefixed on create and
 * accepted, prefixed the same way, on edit. An absolute http(s) URL is kept
 * byte for byte, and every other scheme (`javascript:` included) is still
 * refused with `Invalid URL for <field>` (club-links.test.ts, unchanged).
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

describe("PATCH /api/clubs/[id] as the owner (moved from the 06-07 table)", () => {
  it("a scheme-less website link (club.ca)", async () => {
    mockCookie = makeFake({
      user: STUDENT,
      profile: profileOf(STUDENT.id, ["user"]),
      answers: { "club_members.select": { data: { role: "owner" } } },
    });
    mockElevated = makeFake({
      answers: { "clubs.update": { data: { id: CLUB_ID } } },
    });
    const { PATCH } = await import("@/app/api/clubs/[id]/route");
    const res = await PATCH(
      jsonRequest(`clubs/${CLUB_ID}`, "PATCH", { website_url: "club.ca" }),
      idParams(CLUB_ID)
    );

    // Moved in 06-09 (F-094, DEC-66): was 400 `Invalid URL for website_url`
    // with nothing written; now saved with https:// prefixed.
    expect(res.status).toBe(200);
    expect(writes(mockElevated)).toEqual(["clubs.update"]);
    const [update] = callsTo(mockElevated, "clubs", "update");
    expect(update.payload).toEqual({ website_url: "https://club.ca" });
  });
});

describe("POST /api/clubs (moved from club-links.test.ts)", () => {
  it("a scheme-less website typed into the form, and an https one", async () => {
    mockCookie = makeFake({
      user: STUDENT,
      profile: profileOf(STUDENT.id, ["user"]),
      answers: { "users.select": { data: { roles: ["user"] } } },
    });
    mockElevated = makeFake({
      answers: { "clubs.insert": { data: { id: CLUB_ID, name: "Club" } } },
    });
    const { POST } = await import("@/app/api/clubs/route");
    const res = await POST(
      jsonRequest("clubs", "POST", {
        name: "Review Club",
        description: "A club",
        category: "Academic",
        contact_email: "club@mail.mcgill.ca",
        website_url: "yourclub.com",
        linkedin_url: "https://linkedin.com/company/x",
      })
    );

    // Moved in 06-09 (F-094, DEC-66): was stored verbatim ("yourclub.com",
    // a relative link on the club page); now stored with https:// prefixed.
    expect(res.status).toBe(201);
    const [insert] = callsTo(mockElevated, "clubs", "insert");
    expect(insert.payload).toMatchObject({
      website_url: "https://yourclub.com",
      linkedin_url: "https://linkedin.com/company/x",
    });
  });
});
