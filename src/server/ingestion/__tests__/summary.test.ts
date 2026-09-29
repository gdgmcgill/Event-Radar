/**
 * M3 final review, finding 1a/1b: the stale queue's `is_past` is judged on
 * the server with the DEC-80 wall-clock rule, and the query filters with it.
 */
const calls: Array<{ method: string; args: unknown[] }> = [];
let rows: Record<string, unknown>[] = [];
function chain(): Record<string, unknown> {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "or", "order", "limit", "in", "maybeSingle"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown) => resolve({ data: rows, error: null });
  return builder;
}
jest.mock("@/server/db/elevated", () => ({ getElevatedClient: () => ({ from: () => chain() }) }));

import { stalePendingEvents } from "../summary";

const NOW = new Date("2026-09-29T16:00:00Z"); // noon in Toronto

beforeEach(() => {
  calls.length = 0;
});

it("marks only wall-clock-past events as past and filters with the wall-clock now", async () => {
  rows = [
    { id: "a", title: "Later today", created_at: "2026-09-20T00:00:00Z", start_date: "2026-09-29T15:00:00+00:00", source: "instagram", source_url: null },
    { id: "b", title: "Earlier today", created_at: "2026-09-28T00:00:00Z", start_date: "2026-09-29T09:00:00+00:00", source: "instagram", source_url: null },
  ];
  const stale = await stalePendingEvents(50, NOW);
  expect(stale.map((row) => [row.id, row.is_past])).toEqual([
    ["a", false],
    ["b", true],
  ]);
  const filter = calls.find((call) => call.method === "or")?.args[0];
  expect(filter).toContain("start_date.lt.2026-09-29T12:00:00.000Z");
});
