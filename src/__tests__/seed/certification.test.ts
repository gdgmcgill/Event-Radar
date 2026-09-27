import { datasetManifest, fixtureId, generateCertificationData, namespaceBounds, SIZES, TABLES, type FixtureTable } from "../../../scripts/seed/certificationData";
import { loadCertificationDataset, type CertificationStore } from "../../../scripts/seed/certificationLoad";
import { IDS } from "../../../scripts/seed/personas";
import { computeEventContentHash } from "@/lib/contentHash";

const local = { url: "http://127.0.0.1:54321", serviceRoleKey: "local-test-key" };
type Row = Record<string, unknown> & { id: string };
function memoryStore() {
  const rows = Object.fromEntries(TABLES.map((table) => [table, new Map<string, Row>()])) as Record<FixtureTable, Map<string, Row>>;
  const accounts: Array<{ id: string; email: string; app_metadata: Record<string, unknown> }> = [];
  const writes: string[] = [];
  const store: CertificationStore = {
    async listAuth() { return accounts; },
    async createAuth(user, namespace) {
      writes.push("auth");
      accounts.push({ id: user.id, email: String(user.email), app_metadata: { certification_namespace: namespace } });
    },
    async clear(table, [lower, upper]) {
      writes.push(`clear:${table}`);
      for (const [id] of rows[table]) if (id >= lower && id < upper) rows[table].delete(id);
    },
    async insert(table, incoming) {
      writes.push(`insert:${table}`);
      expect(incoming.length).toBeLessThanOrEqual(250);
      for (const row of incoming) {
        if (rows[table].has(row.id)) throw new Error("duplicate primary key");
        rows[table].set(row.id, { ...structuredClone(row), ...(table === "users" ? { saved_events_count: 0 } : {}) });
        if (table === "saved_events") {
          const user = rows.users.get(String(row.user_id))!;
          user.saved_events_count = Number(user.saved_events_count) + 1;
        }
      }
    },
    async read(table, [lower, upper]) { return [...rows[table].values()].filter((row) => row.id >= lower && row.id < upper); },
  };
  return { store, rows, accounts, writes };
}

describe("CERT-03 deterministic scale fixture", () => {
  const data = generateCertificationData("scale");
  it("pins its complete generated manifest and regenerates exactly", () => {
    expect(datasetManifest(data).sha256).toBe("47033e32b468f938a41e3d711d3f09fcaed06f29460b88b9fb0a6a52841e6a10");
    expect(datasetManifest(generateCertificationData("scale"))).toEqual(datasetManifest(data));
    expect(datasetManifest(data).counts).toMatchObject({ users: 2000, clubs: 200, events: 4000, rsvps: 20000, saved_events: 20000, user_interactions: 20000, notifications: 20000 });
  });
  it("has valid unique IDs/FKs and no overlap with functional or adversarial personas", () => {
    const all = TABLES.flatMap((table) => data.tables[table].map((row) => row.id));
    expect(new Set(all).size).toBe(all.length);
    const excluded = new Set([...Object.values(IDS), ...generateCertificationData("adversarial").tables.users.map((row) => row.id)]);
    expect(all.some((id) => excluded.has(id))).toBe(false);
    const users = new Set(data.tables.users.map((row) => row.id));
    const events = new Set(data.tables.events.map((row) => row.id));
    const clubs = new Set(data.tables.clubs.map((row) => row.id));
    for (const table of ["rsvps", "saved_events", "user_interactions", "notifications"] as const) {
      expect(data.tables[table].every((row) => users.has(row.user_id!) && events.has(row.event_id!))).toBe(true);
    }
    expect(data.tables.events.every((row) => clubs.has(row.club_id!) && users.has(row.created_by!))).toBe(true);
    for (const table of ["rsvps", "saved_events", "notifications"] as const) {
      const pairs = data.tables[table].map((row) => `${row.user_id}:${row.event_id}`);
      expect(new Set(pairs).size).toBe(pairs.length);
    }
  });
  it("includes realistic statuses, expired events and a quantitatively skewed popularity distribution", () => {
    expect(data.tables.events.filter((event) => event.status === "approved")).toHaveLength(3000);
    expect(new Set(data.tables.events.map((event) => event.status))).toEqual(new Set(["approved", "pending", "rejected", "suspended"]));
    expect(data.tables.events.filter((event) => event.start_date.startsWith("2016"))).toHaveLength(400);
    const hot = new Set(data.tables.events.slice(0, SIZES.scale.events / 10).map((row) => row.id));
    const hotSaves = data.tables.saved_events.filter((row) => hot.has(row.event_id!)).length;
    expect(hotSaves / data.tables.saved_events.length).toBeGreaterThan(0.7);
    expect(hotSaves / data.tables.saved_events.length).toBeLessThan(0.85);
  });
  it("uses the application's content-hash formula", async () => {
    for (const row of data.tables.events.slice(0, 4)) expect(row.content_hash).toBe(await computeEventContentHash(row.title, row.start_date, row.organizer!));
  });
});

describe("CERT-02 adversarial data catalogue", () => {
  const data = generateCertificationData("adversarial");
  it("covers every requested attack area without pretending probes have run", () => {
    expect(datasetManifest(data).sha256).toBe("37b0bd4014752e2e4ec14e65fcc93ba81eb7a8fe361937784e81006d9eda8de5");
    expect(new Set(data.probes.map((probe) => probe.area))).toEqual(new Set(["malformed", "injection", "unsafe-links", "duplicates", "timezone", "expired", "cross-tenant", "auth", "upload", "volume"]));
    expect(new Set(data.probes.map((probe) => probe.id)).size).toBe(data.probes.length);
  });
  it("has real duplicate targets and a cross-club actor with no membership", () => {
    expect(data.tables.saved_events[0]).toMatchObject({ user_id: fixtureId("adversarial", 1, 0), event_id: fixtureId("adversarial", 4, 0) });
    expect(data.tables.club_members.some((row) => row.user_id === fixtureId("adversarial", 1, 0) && row.club_id === fixtureId("adversarial", 2, 1))).toBe(false);
    expect(Date.parse(data.tables.club_invitations[1].expires_at!)).toBeLessThan(Date.parse("2026-01-01"));
  });
  it("pins distinct Toronto fall-back instants and spring-forward gap", () => {
    const toronto = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    expect(toronto.format(new Date("2026-11-01T05:30:00Z"))).toBe("01:30");
    expect(toronto.format(new Date("2026-11-01T06:30:00Z"))).toBe("01:30");
    expect(toronto.format(new Date("2026-03-08T06:59:59Z"))).toBe("01:59");
    expect(toronto.format(new Date("2026-03-08T07:00:00Z"))).toBe("03:00");
  });
});

describe("CERT-04 guarded, scoped and repeatable loader", () => {
  it.each(["https://unknown.supabase.co", "https://attacker.invalid", "http://localhost:3000"])("refuses %s before client construction", async (url) => {
    const factory = jest.fn();
    await expect(loadCertificationDataset("adversarial", { ...local, url }, { storeFactory: factory, guard: { envFilePath: "/nonexistent/certification-deny-key", env: {} } })).rejects.toThrow("REFUSED");
    expect(factory).not.toHaveBeenCalled();
  });
  it("loads twice with identical persisted projections and preserves unrelated records", async () => {
    const memory = memoryStore();
    const outsider = { id: "eeeeeeee-0000-4000-8000-000000000001", title: "unrelated" };
    memory.rows.events.set(outsider.id, outsider);
    const options = { storeFactory: () => memory.store };
    const first = await loadCertificationDataset("adversarial", local, options);
    const second = await loadCertificationDataset("adversarial", local, options);
    expect(second).toEqual(first);
    expect(memory.accounts).toHaveLength(SIZES.adversarial.users);
    expect(memory.rows.events.get(outsider.id)).toEqual(outsider);
    expect(first.persistedSha256).toMatch(/^[a-f0-9]{64}$/);
    const clearOrder = [...TABLES].reverse().map((table) => `clear:${table}`);
    expect(memory.writes.filter((write) => write.startsWith("clear:"))).toEqual([...clearOrder, ...clearOrder]);
  });
  it("rejects account ownership collisions before any write", async () => {
    const memory = memoryStore();
    memory.accounts.push({ id: fixtureId("adversarial", 1, 0), email: "unrelated@mail.mcgill.ca", app_metadata: {} });
    await expect(loadCertificationDataset("adversarial", local, { storeFactory: () => memory.store })).rejects.toThrow("unrelated account");
    expect(memory.writes).toEqual([]);
  });
  it("verifies data and trigger counters rather than trusting completed writes", async () => {
    const memory = memoryStore();
    const options = { storeFactory: () => memory.store };
    await loadCertificationDataset("adversarial", local, options);
    const id = fixtureId("adversarial", 1, 0);
    memory.rows.users.get(id)!.saved_events_count = 99;
    await expect(loadCertificationDataset("adversarial", local, { ...options, verifyOnly: true })).rejects.toThrow("saved_events_count");
    expect(namespaceBounds("adversarial")[0] < id && id < namespaceBounds("adversarial")[1]).toBe(true);
  });
});
