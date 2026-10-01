/** CERT-02/03: pure, versioned fixtures. No environment, clock, network or writes. */
import { createHash } from "node:crypto";
import type { Database } from "../../src/lib/supabase/types";
import { SEED_STAMP } from "./personas";
import { prng, SEED } from "./prng";

export type DatasetName = "adversarial" | "scale";
export const TABLES = ["users", "clubs", "club_members", "events", "rsvps", "saved_events", "user_interactions", "notifications", "club_invitations"] as const;
export type FixtureTable = typeof TABLES[number];
export type FixtureRows = { [K in FixtureTable]: Array<Database["public"]["Tables"][K]["Insert"] & { id: string }> };
export interface Probe { id: string; area: string; input: unknown; expected: string }
export interface CertificationData {
  version: 1; name: DatasetName; seed: number; namespace: string;
  tables: FixtureRows; probes: Probe[];
}
export const SIZES = {
  adversarial: { users: 12, clubs: 4, events: 24, joinsPerUser: 4 },
  scale: { users: 2000, clubs: 200, events: 4000, joinsPerUser: 10 },
} as const;
export function namespace(name: DatasetName): string { return name === "scale" ? "c0700001" : "c0700002"; }
export function fixtureId(name: DatasetName, kind: number, index: number): string {
  return `${namespace(name)}-${kind.toString(16).padStart(4, "0")}-4000-8000-${(index + 1).toString(16).padStart(12, "0")}`;
}
export function namespaceBounds(name: DatasetName): [string, string] {
  return [`${namespace(name)}-0000-0000-0000-000000000000`, `${(parseInt(namespace(name), 16) + 1).toString(16)}-0000-0000-0000-000000000000`];
}

function probes(name: DatasetName): Probe[] {
  if (name !== "adversarial") return [];
  const id = (kind: number, index: number) => fixtureId(name, kind, index);
  return [
    { id: "null-body", area: "malformed", input: null, expected: "400 before writes" },
    { id: "null-event", area: "malformed", input: { event_count: 1, events: [null] }, expected: "webhook 400 before writes" },
    { id: "numeric-tags", area: "malformed", input: { tags: [1] }, expected: "webhook 400 before writes" },
    ...["' OR 1=1--", "%,title.ilike.*", "<script>alert(1)</script>", "<img src=x onerror=alert(1)>", "Robert'); DROP TABLE events;--"].map((input, i) => ({ id: `injection-${i}`, area: "injection", input, expected: "literal search or sanitized text; no code execution or broadened scope" })),
    ...["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "//attacker.invalid/path"].map((input, i) => ({ id: `unsafe-link-${i}`, area: "unsafe-links", input, expected: "reject unsafe URL or render without an active unsafe href" })),
    { id: "duplicate-content", area: "duplicates", input: { event_id: id(4, 0) }, expected: "same title/date/organizer content hash refused" },
    { id: "duplicate-rsvp", area: "duplicates", input: { user_id: id(1, 0), event_id: id(4, 0) }, expected: "one RSVP per user and event" },
    { id: "duplicate-save", area: "duplicates", input: { user_id: id(1, 0), event_id: id(4, 0) }, expected: "one save per user and event" },
    { id: "duplicate-invitation", area: "duplicates", input: { invitation_id: id(9, 0), token: id(10, 0) }, expected: "accept once; reused token cannot create another membership" },
    { id: "spring-gap", area: "timezone", input: { zone: "America/Toronto", before: "2026-03-08T06:59:59Z", after: "2026-03-08T07:00:00Z" }, expected: "01:59:59 EST advances to 03:00 EDT" },
    { id: "fall-repeat", area: "timezone", input: { zone: "America/Toronto", first: "2026-11-01T05:30:00Z", second: "2026-11-01T06:30:00Z" }, expected: "two distinct UTC instants both display 01:30; order by instant" },
    { id: "expired-event", area: "expired", input: { event_id: id(4, 0) }, expected: "past event absent from upcoming discovery" },
    { id: "expired-invite", area: "expired", input: { invitation_id: id(9, 1), token: id(10, 1) }, expected: "expired invitation cannot be accepted" },
    { id: "cross-club-write", area: "cross-tenant", input: { actor_id: id(1, 0), club_id: id(2, 1), event_id: id(4, 1) }, expected: "non-member cannot edit, transfer or moderate other club" },
    { id: "cross-user-notification", area: "cross-tenant", input: { actor_id: id(1, 0), notification_id: id(8, 4) }, expected: "other user's private notification inaccessible" },
    { id: "non-mcgill-oauth", area: "auth", input: { email: "attacker@example.com", provider: "google" }, expected: "OAuth completion rejected under existing McGill boundary" },
    { id: "forged-cookie", area: "auth", input: { cookie: "needs_onboarding=false; is_admin=true; sb-access-token=forged" }, expected: "no authenticated or admin access" },
    { id: "metadata-role", area: "auth", input: { user_metadata: { roles: ["admin"] } }, expected: "editable metadata never grants admin" },
    { id: "svg-script", area: "upload", input: { type: "image/svg+xml", body: "<svg onload=alert(1)></svg>" }, expected: "unsupported active image format rejected" },
    { id: "mime-mismatch", area: "upload", input: { type: "image/png", bytesHex: "4d5a9000" }, expected: "declared MIME cannot bypass content validation" },
    { id: "oversize-upload", area: "upload", input: { sizeBytes: 104857600, type: "image/jpeg" }, expected: "oversized file refused before storage" },
    { id: "rate-burst", area: "volume", input: { requests: 1000, actor_id: id(1, 0) }, expected: "configured budget enforced with 429 and Retry-After" },
    { id: "unbounded-limit", area: "volume", input: { limit: "1000000" }, expected: "recommendation limit rejected or bounded" },
  ];
}

export function generateCertificationData(name: DatasetName): CertificationData {
  if (name !== "scale" && name !== "adversarial") throw new Error("Unknown certification dataset");
  const size = SIZES[name];
  const next = prng(SEED);
  const id = (kind: number, index: number) => fixtureId(name, kind, index);
  const tables: FixtureRows = { users: [], clubs: [], club_members: [], events: [], rsvps: [], saved_events: [], user_interactions: [], notifications: [], club_invitations: [] };
  for (let i = 0; i < size.users; i++) {
    tables.users.push({
      id: id(1, i), email: `cert.${name}.${i}@mail.mcgill.ca`, name: `Certification ${name} user ${i}`,
      roles: i < size.clubs ? ["user", "club_organizer"] : ["user"],
      onboarding_completed: i % 20 !== 19, interest_tags: [i % 2 ? "tech" : "career"], inferred_tags: [],
      visibility: i % 5 === 0 ? "private" : "public", year: "U2", faculty: "Science",
      banned_at: i % 100 === 97 || (name === "adversarial" && i === 9) ? SEED_STAMP : null,
      ban_expires_at: null, ban_reason: null, created_at: SEED_STAMP, updated_at: SEED_STAMP,
    });
  }
  for (let i = 0; i < size.clubs; i++) {
    tables.clubs.push({ id: id(2, i), name: `Certification ${name} club ${i}`, description: "Synthetic certification club", status: i % 10 === 8 ? "pending" : i % 10 === 9 ? "rejected" : "approved", created_by: id(1, i), category: "academic", created_at: SEED_STAMP, updated_at: SEED_STAMP });
    tables.club_members.push({ id: id(3, i), user_id: id(1, i), club_id: id(2, i), role: "owner", created_at: SEED_STAMP });
  }
  for (let i = 0; i < size.events; i++) {
    const status = i % 20 < 15 ? "approved" : i % 20 < 18 ? "pending" : i % 20 === 18 ? "rejected" : "suspended";
    const start = new Date(Date.UTC(i % 10 === 0 ? 2016 : 2036, 5, 1 + (i % 180), 16 + (i % 4))).toISOString();
    const title = name === "adversarial" && i === 2 ? '<script>alert("fixture")</script> Literal title' : `Certification ${name} event ${i}`;
    const organizer = `Certification ${name} club ${i % size.clubs}`;
    tables.events.push({
      id: id(4, i), title, organizer, description: name === "adversarial" && i === 3 ? "' OR 1=1--" : "Synthetic certification event",
      status, club_id: id(2, i % size.clubs), created_by: id(1, i % size.clubs),
      start_date: start, end_date: new Date(Date.parse(start) + 7200000).toISOString(),
      tags: [i % 2 ? "tech" : "career"], location: "Synthetic campus", is_free: i % 4 !== 0,
      source: "manual", content_hash: createHash("sha256").update(`${title.toLowerCase().trim()}|${start.slice(0, 10)}|${organizer.toLowerCase()}`).digest("hex"),
      rsvp_count: 0, created_at: SEED_STAMP, updated_at: SEED_STAMP,
    });
  }
  // 75% of choices draw from the first 10% of events: a fixed, hot-head
  // popularity distribution, with unique (user,event) pairs in each join table.
  for (let user = 0; user < size.users; user++) {
    const selected = new Set<number>();
    for (let j = 0; j < size.joinsPerUser; j++) {
      const n = user * size.joinsPerUser + j;
      let event = user === 0 && j === 0 ? 0 : Math.floor(next() * (next() < 0.75 ? Math.max(1, Math.floor(size.events / 10)) : size.events));
      while (selected.has(event)) event = (event + 1) % size.events;
      selected.add(event);
      const pair = { user_id: id(1, user), event_id: id(4, event), created_at: SEED_STAMP };
      const status = j % 5 === 4 ? "interested" : "going";
      tables.rsvps.push({ id: id(5, n), ...pair, status, updated_at: SEED_STAMP });
      if (status === "going") tables.events[event].rsvp_count!++;
      tables.saved_events.push({ id: id(6, n), ...pair });
      tables.user_interactions.push({ id: id(7, n), ...pair, interaction_type: j % 2 ? "click" : "view", source: "home", metadata: { certification: name } });
      tables.notifications.push({ id: id(8, n), ...pair, type: "event_reminder", title: "Synthetic reminder", message: "Certification fixture", read: j % 2 === 0 });
    }
  }
  if (name === "adversarial") {
    for (let i = 0; i < 2; i++) tables.club_invitations.push({ id: id(9, i), club_id: id(2, i), inviter_id: id(1, i), invitee_email: tables.users[10 + i].email, token: id(10, i), status: "pending", expires_at: i ? "2016-06-01T16:00:00.000Z" : "2036-06-01T16:00:00.000Z", created_at: SEED_STAMP });
  }
  return { version: 1, name, seed: SEED, namespace: namespace(name), tables, probes: probes(name) };
}

export function datasetManifest(data: CertificationData) {
  return {
    version: data.version, name: data.name, seed: data.seed, namespace: data.namespace,
    counts: Object.fromEntries(TABLES.map((table) => [table, data.tables[table].length])),
    probes: data.probes.length,
    sha256: createHash("sha256").update(JSON.stringify(data)).digest("hex"),
  };
}
