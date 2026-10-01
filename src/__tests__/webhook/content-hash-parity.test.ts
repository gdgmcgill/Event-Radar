/**
 * Parity between the app's content hash and the edge function's copy
 * (plan 06-03 Task 3, DEC-64).
 *
 * supabase/functions/_shared/contentHash.ts is a byte-for-byte copy of
 * src/lib/contentHash.ts: the edge function cannot import from src/, and the
 * app should not import from supabase/functions/ for a function it already
 * owns. Both feed the same unique index, idx_events_content_hash, so a
 * webhook event and a manually created event with the same title, date and
 * organizer must hash identically. This suite fails the moment the two drift.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { computeEventContentHash as appHash } from "@/lib/contentHash";
import { computeEventContentHash as edgeHash } from "../../../supabase/functions/_shared/contentHash";

const ROWS: Array<[string, string, string, string]> = [
  ["plain", "Robotics Night", "2030-03-14T18:30:00.000Z", "McGill Robotics"],
  ["mixed case", "RoBoTiCs NiGhT", "2030-03-14T18:30:00.000Z", "mcgill ROBOTICS"],
  ["surrounding spaces", "  Robotics Night  ", "2030-03-14T18:30:00.000Z", "  McGill Robotics "],
  ["empty organizer", "Robotics Night", "2030-03-14T18:30:00.000Z", ""],
  ["date only", "Robotics Night", "2030-03-14", "McGill Robotics"],
  ["date with a time part", "Robotics Night", "2030-03-14T23:59:59.999Z", "McGill Robotics"],
  ["date with an offset", "Robotics Night", "2030-03-14T20:00:00-05:00", "McGill Robotics"],
  ["unicode", "Soirée à Montréal", "2030-03-14T18:30:00.000Z", "Club Français"],
];

describe("content hash parity: src/lib vs supabase/functions/_shared", () => {
  it.each(ROWS)("%s -> identical hashes", async (_label, title, date, organizer) => {
    const [a, b] = await Promise.all([
      appHash(title, date, organizer),
      edgeHash(title, date, organizer),
    ]);
    expect(b).toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("normalization is shared: case and surrounding space do not change the hash", async () => {
    const base = await edgeHash("Robotics Night", "2030-03-14T18:30:00.000Z", "McGill Robotics");
    const noisy = await edgeHash(" ROBOTICS night ", "2030-03-14T09:00:00.000Z", "mcgill robotics  ");
    expect(noisy).toBe(base);
  });

  it("an empty organizer hashes like a missing one (the `|| \"\"` fallback)", async () => {
    const empty = await edgeHash("T", "2030-03-14", "");
    const missing = await edgeHash("T", "2030-03-14", undefined as unknown as string);
    expect(missing).toBe(empty);
  });

  it("the two files are byte-identical", () => {
    const root = join(__dirname, "..", "..", "..");
    const app = readFileSync(join(root, "src/lib/contentHash.ts"), "utf8");
    const edge = readFileSync(join(root, "supabase/functions/_shared/contentHash.ts"), "utf8");
    expect(edge).toBe(app);
  });
});
