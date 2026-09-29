import { createHash } from "node:crypto";
import { z } from "zod";
import { Instant, ListingKind, UUID, type DiscoveryFilters, type DiscoveryItem, type SavedDiscoveryItem } from "@/contracts/discovery";
const Identity = { kind: ListingKind, id: UUID };
const Envelope = z.object({ version: z.literal(1), hash: z.string().length(64), as_of: Instant });
const FeedCursor = Envelope.extend({ after: z.object({ ...Identity, priority: z.number().int().min(0).max(100), actionable_at: Instant.nullable(), published_at: Instant }).strict() }).strict();
const SavedCursor = Envelope.extend({ after: z.object({ ...Identity, saved_at: Instant }).strict() }).strict();
export class InvalidCursor extends Error { constructor() { super("Invalid or expired cursor; restart this view"); } }
export function discoveryFilterHash(filters: DiscoveryFilters): string {
  return hash({ type: filters.type ?? null, university: filters.university ?? "10000000-0000-4000-8000-000000000001", field: filters.field ?? null, work_mode: filters.work_mode ?? null, q: filters.q, window: filters.window });
}
export function savedFilterHash(userId: string): string { return hash({ scope: "saved", userId }); }
function hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
export function decodeCursor(cursor: string | undefined, expectedHash: string, saved = false, now = Date.now()) {
  if (!cursor) return { as_of: new Date(now).toISOString(), after: undefined };
  try {
    if (!/^[a-zA-Z0-9_-]+$/.test(cursor) || cursor.length > 2048) throw new InvalidCursor();
    const parsed = (saved ? SavedCursor : FeedCursor).parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    const age = now - Date.parse(parsed.as_of);
    if (parsed.hash !== expectedHash || age < -60_000 || age > 86_400_000) throw new InvalidCursor();
    return { as_of: parsed.as_of, after: parsed.after };
  } catch { throw new InvalidCursor(); }
}
export function encodeCursor(item: DiscoveryItem | SavedDiscoveryItem, as_of: string, hash: string): string {
  const after = "saved_at" in item ? { kind: item.kind, id: item.id, saved_at: item.saved_at } : { kind: item.kind, id: item.id, priority: item.editorial_priority, actionable_at: item.actionable_at, published_at: item.published_at };
  return Buffer.from(JSON.stringify({ version: 1, as_of, hash, after })).toString("base64url");
}
