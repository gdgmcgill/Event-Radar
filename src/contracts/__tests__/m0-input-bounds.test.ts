import { AuditLogQuery } from "../admin";
import { InteractionBody } from "../interactions";

it.each(["0", "-1", "abc", "NaN", "Infinity", "999999999999999999999999"])("audit page %s falls back to one", (page) => {
  expect(AuditLogQuery.parse({ page }).page).toBe(1);
});
it("keeps valid audit pagination", () => {
  expect(AuditLogQuery.parse({ page: "3" }).page).toBe(3);
});

const interaction = { event_id: "event-1", interaction_type: "view" };
it.each([
  { session_id: {} }, { session_id: "x".repeat(65) },
  { metadata: { nested: { payload: "x" } } }, { metadata: [] },
  { metadata: { value: "x".repeat(257) } },
  { metadata: { ["x".repeat(65)]: true } },
  { metadata: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`key${i}`, true])) },
])("rejects malformed or unbounded interaction extras %#", (extras) => {
  expect(InteractionBody.safeParse({ ...interaction, ...extras }).success).toBe(false);
});
it("accepts bounded flat interaction metadata and session ids", () => {
  const extras = { session_id: "x".repeat(64), metadata: { rank: 2, surface: "feed", returned: true } };
  expect(InteractionBody.parse({ ...interaction, ...extras })).toMatchObject(extras);
});
