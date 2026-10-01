/** M0 intentional behavior changes DI-89/90/97: malformed writes stop at400. */
import { EventUpdateBody } from "@/contracts/events";
import { UserUpdateBody } from "@/contracts/users";
import { AdminEventCreateBody } from "@/contracts/admin";

describe("DI-89: event PATCH registration and price", () => {
  it.each(["javascript:alert(1)", "data:text/html,x", "ftp://example.com", "//example.com", 123, {}, "https://example.com/" + "x".repeat(500)])("refuses unsafe or wrongly typed registration link %j", (rsvp_link) => {
    expect(EventUpdateBody.safeParse({ rsvp_link }).success).toBe(false);
  });
  it.each(["https://example.com/tickets", "http://localhost/tickets", "", null])("allows valid links and clearing %j", (rsvp_link) => {
    expect(EventUpdateBody.safeParse({ rsvp_link }).success).toBe(true);
  });
  it.each(["x".repeat(21), 5, {}])("refuses invalid price %j", (price) => {
    expect(EventUpdateBody.safeParse({ price }).success).toBe(false);
  });
  it.each(["$10", "x".repeat(20), "", null])("allows bounded price or clearing %j", (price) => {
    expect(EventUpdateBody.safeParse({ price }).success).toBe(true);
  });
});
describe("DI-90: profile image URLs", () => {
  it.each(["avatar_url", "banner_url"])("%s refuses all non-http schemes", (field) => {
    for (const value of ["javascript:x", "data:image/png;base64,abc", "file:///tmp/x", "ftp://example.com/x"]) expect(UserUpdateBody.safeParse({ [field]: value }).success).toBe(false);
    for (const value of ["https://example.com/x.png", "http://localhost:54321/x.png", "", null]) expect(UserUpdateBody.safeParse({ [field]: value }).success).toBe(true);
  });
});
describe("DI-97: admin event dates", () => {
  const valid = { title: "Event", start_date: "2036-01-01T10:00:00Z", end_date: "2036-01-01T12:00:00Z" };
  it.each([7, {}, [], "not a date", "2036-02-30", "2036-01-01T25:00:00Z"])("refuses malformed dates %j", (value) => {
    expect(AdminEventCreateBody.safeParse({ ...valid, start_date: value }).success).toBe(false);
    expect(AdminEventCreateBody.safeParse({ ...valid, end_date: value }).success).toBe(false);
  });
  it("rejects equal/reversed intervals while preserving valid past admin imports and offsets", () => {
    expect(AdminEventCreateBody.safeParse({ ...valid, end_date: valid.start_date }).success).toBe(false);
    expect(AdminEventCreateBody.safeParse({ ...valid, end_date: "2035-01-01" }).success).toBe(false);
    expect(AdminEventCreateBody.safeParse({ ...valid, start_date: "2016-01-01", end_date: "2016-01-02" }).success).toBe(true);
    expect(AdminEventCreateBody.safeParse({ ...valid, start_date: "2036-11-02T01:30:00-04:00", end_date: "2036-11-02T01:30:00-05:00" }).success).toBe(true);
  });
});
