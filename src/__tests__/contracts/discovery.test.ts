import { DiscoveryQuery, SavedStatusQuery } from "@/contracts/discovery";
import { OpportunityCreateBody, OpportunityMutationBody } from "@/contracts/opportunities";
const base = { slug: "test-listing", listing_type: "job", title: "Internship", description: "Details", organization: "UNI-VERSE" };
describe("M2 discovery boundaries", () => {
 test("bounded filters and status identities", () => {
  expect(DiscoveryQuery.parse({}).limit).toBe(20);
  for (const input of [{ limit: 0 }, { limit: 51 }, { q: "x".repeat(121) }, { university: "not-a-uuid" }, { work_mode: "anything" }]) expect(DiscoveryQuery.safeParse(input).success).toBe(false);
  expect(SavedStatusQuery.parse({ identities: "event:10000000-0000-4000-8000-000000000001,opportunity:10000000-0000-4000-8000-000000000002" }).identities).toHaveLength(2);
  expect(SavedStatusQuery.parse({ identities: Array(50).fill("opportunity:10000000-0000-4000-8000-000000000001").join(",") }).identities).toHaveLength(50);
  expect(SavedStatusQuery.safeParse({ identities: Array(51).fill("event:10000000-0000-4000-8000-000000000001").join(",") }).success).toBe(false);
 });
 test("draft defaults explicitly retain unknown eligibility and assumed timezone", () => {
  const data = OpportunityCreateBody.parse(base);
  expect(data).toMatchObject({ relevance_scope: "unknown", eligibility_text: null, source_timezone: "America/Toronto", timezone_assumed: true, application_mode: "external", deadline_precision: "none" });
 });
 test("deadline precision and timezone cannot silently change", () => {
  expect(OpportunityCreateBody.safeParse({ ...base, deadline_precision: "date", deadline_date: "2027-03-14", source_timezone: "America/Toronto" }).success).toBe(true);
  for (const input of [{ deadline_precision: "date" }, { deadline_at: "2027-03-14T12:00:00Z" }, { deadline_precision: "datetime", deadline_at: "2027-03-14T12:00:00" }, { source_timezone: "Made/Up" }, { deadline_precision: "date", deadline_date: "2027-02-30" }]) expect(OpportunityCreateBody.safeParse({ ...base, ...input }).success).toBe(false);
 });
 test("native applications and dangerous URLs are unavailable", () => {
  for (const input of [{ application_mode: "universe" }, { action_url: "javascript:alert(1)" }, { source_url: "data:text/html,a" }, { is_pick: true }, { relevance_scope: "specific" }, { starts_at: "2027-01-02T00:00:00Z", ends_at: "2027-01-01T00:00:00Z" }]) expect(OpportunityCreateBody.safeParse({ ...base, ...input }).success).toBe(false);
  expect(OpportunityCreateBody.safeParse({ ...base, application_mode: "none", action_note: "Contact organizer" }).success).toBe(true);
 });
 test("authoring decisions bind the reviewed version and reject role/state injection", () => {
  expect(OpportunityMutationBody.safeParse({ action: "publish" }).success).toBe(false);
  expect(OpportunityMutationBody.safeParse({ action: "publish", expected_updated_at: "2027-01-01T00:00:00Z", can_pick: true }).success).toBe(false);
  expect(OpportunityCreateBody.safeParse({ ...base, status: "published", created_by: "fake" }).success).toBe(false);
 });
});
