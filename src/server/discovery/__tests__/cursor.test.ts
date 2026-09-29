import { DiscoveryQuery, type DiscoveryItem, type SavedDiscoveryItem } from "@/contracts/discovery";
import { decodeCursor, discoveryFilterHash, encodeCursor, InvalidCursor, savedFilterHash } from "../cursor";
const asOf = "2027-03-14T12:00:00.000Z";
const item = { kind: "opportunity", id: "10000000-0000-4000-8000-000000000001", editorial_priority: 4, actionable_at: null, published_at: "2027-03-01T00:00:00.000Z" } as DiscoveryItem;
test("cursor binds as_of, every active filter, and complete ordering tie breaker", () => {
 const filters = DiscoveryQuery.parse({ type: "job", field: "Engineering" });
 const hash = discoveryFilterHash(filters); const cursor = encodeCursor(item, asOf, hash);
 expect(decodeCursor(cursor, hash, false, Date.parse(asOf))).toEqual({ as_of: asOf, after: { kind: item.kind, id: item.id, priority: 4, actionable_at: null, published_at: item.published_at } });
 for (const changed of [{ type: "grant" }, { university: "10000000-0000-4000-8000-000000000002" }, { window: "this_week" }, { field: "Art" }, { work_mode: "remote" }, { q: "foo" }]) expect(() => decodeCursor(cursor, discoveryFilterHash(DiscoveryQuery.parse({ ...filters, ...changed })), false, Date.parse(asOf))).toThrow(InvalidCursor);
 expect(discoveryFilterHash({ ...filters, limit: 40 })).toBe(hash);
});
test("malformed, old, future, wrong-version and cross-persona saved cursors fail closed", () => {
 const hash = savedFilterHash("user-a"); const cursor = encodeCursor({ ...item, saved_at: asOf } as SavedDiscoveryItem, asOf, hash);
 expect(decodeCursor(cursor, hash, true, Date.parse(asOf)).after).toMatchObject({ saved_at: asOf });
 expect(() => decodeCursor(cursor, savedFilterHash("user-b"), true, Date.parse(asOf))).toThrow(InvalidCursor);
 for (const invalid of ["garbage", "!!", Buffer.from(JSON.stringify({ version: 2 })).toString("base64url")]) expect(() => decodeCursor(invalid, hash, true)).toThrow(InvalidCursor);
 expect(() => decodeCursor(cursor, hash, true, Date.parse(asOf) + 86_400_001)).toThrow(InvalidCursor);
 expect(() => decodeCursor(cursor, hash, true, Date.parse(asOf) - 60_001)).toThrow(InvalidCursor);
});
