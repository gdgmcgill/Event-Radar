import { createHash } from "node:crypto";
import { generateFunctionalCertificationData, functionalManifest, FUNCTIONAL_NAMESPACE, FUNCTIONAL_TABLES, FUNCTIONAL_PNG, functionalId, type FunctionalTable } from "../../../scripts/seed/certificationFunctionalData";
import { loadFunctionalCertification, type FunctionalStore } from "../../../scripts/seed/certificationFunctionalLoad";
import { PERSONAS } from "../../../scripts/seed/personas";
type Row = Record<string, unknown>;
const creds = { url: "http://127.0.0.1:54321", anonKey: "test-anon", serviceRoleKey: "test-service" };
function fake() {
  const rows = Object.fromEntries(FUNCTIONAL_TABLES.map((table) => [table, []])) as unknown as Record<FunctionalTable, Row[]>;
  const auth: Array<{ id: string; email: string; app_metadata: Record<string, string> }> = [];
  const writes: string[] = [];
  let storageHash = "";
  const store: FunctionalStore = {
    async accounts() { return auth; },
    async createAccount(user) { writes.push("auth"); auth.push({ id: user.id, email: user.email, app_metadata: { certification_namespace: FUNCTIONAL_NAMESPACE } }); },
    async clear(table) { writes.push(`clear:${table}`); rows[table] = []; },
    async insert(table, incoming) {
      writes.push(`insert:${table}`);
      rows[table].push(...structuredClone(incoming));
      if (table === "users") rows.users.forEach((user) => { user.saved_events_count = 0; });
      if (table === "saved_events") for (const save of incoming) {
        const user = rows.users.find((user) => user.id === save.user_id)!;
        user.saved_events_count = Number(user.saved_events_count) + 1;
      }
    },
    async read(table) { return rows[table]; },
    async uploadOwnedStorage(data) { writes.push("storage"); storageHash = data.storage.sha256; },
    async verifyStorage(data) { if (storageHash !== data.storage.sha256) throw new Error("storage mismatch"); return storageHash; },
  };
  return { store, rows, auth, writes };
}
describe("CERT-01 opt-in functional superset", () => {
  const data = generateFunctionalCertificationData();
  it("inherits every existing persona state in an isolated namespace", () => {
    for (let i = 0; i < PERSONAS.length; i++) {
      expect(data.tables.users[i]).toMatchObject({ roles: PERSONAS[i].roles, onboarding_completed: PERSONAS[i].onboarding_completed, banned_at: PERSONAS[i].banned_at, ban_expires_at: PERSONAS[i].ban_expires_at });
      expect(data.tables.users[i].id).not.toBe(PERSONAS[i].id);
      expect(data.tables.users[i].id.startsWith(FUNCTIONAL_NAMESPACE)).toBe(true);
    }
  });
  it("covers statuses, deleted/scraped events, every notification type and score/fallback paths", () => {
    expect(new Set(data.tables.clubs.map((row) => row.status))).toEqual(new Set(["approved", "pending", "rejected", "deleted", "suspended"]));
    expect(new Set(data.tables.events.map((row) => row.status))).toEqual(new Set(["approved", "pending", "rejected", "suspended"]));
    expect(new Set(data.tables.rsvps.map((row) => row.status))).toEqual(new Set(["going", "interested", "cancelled"]));
    expect(data.tables.events.some((row) => row.deleted_at && row.status === "approved")).toBe(true);
    expect(data.tables.events.some((row) => row.source === "instagram")).toBe(true);
    expect(data.tables.notifications.length).toBe(23);
    expect(data.tables.experiments.some((row) => row.status === "running")).toBe(true);
    expect(data.tables.user_event_scores).toHaveLength(1);
    expect(data.tables.user_event_scores.some((row) => row.user_id === functionalId(1, 2))).toBe(false);
  });
  it("is reproducible and has a stable owned PNG payload", () => {
    expect(functionalManifest()).toEqual(functionalManifest(generateFunctionalCertificationData()));
    expect(createHash("sha256").update(Buffer.from(FUNCTIONAL_PNG, "base64")).digest("hex")).toBe(data.storage.sha256);
    expect(data.storage.path.startsWith(`${data.storage.owner}/`)).toBe(true);
    expect(data.tables.club_members.some((row) => row.role === "organizer")).toBe(true);
  });
  it("refuses unallowlisted target before constructing a client", async () => {
    const factory = jest.fn();
    await expect(loadFunctionalCertification({ ...creds, url: "https://attacker.invalid" }, { storeFactory: factory })).rejects.toThrow("REFUSED");
    expect(factory).not.toHaveBeenCalled();
  });
  it("refuses unrelated auth ownership before the first write", async () => {
    const f = fake();
    f.auth.push({ id: data.tables.users[0].id, email: data.tables.users[0].email, app_metadata: {} });
    await expect(loadFunctionalCertification(creds, { storeFactory: () => f.store })).rejects.toThrow("ownership collision");
    expect(f.writes).toEqual([]);
  });
  it("loads twice with the same persisted hash and checks storage without recreating accounts", async () => {
    const f = fake();
    const options = { storeFactory: () => f.store };
    const first = await loadFunctionalCertification(creds, options);
    const second = await loadFunctionalCertification(creds, options);
    expect(second).toEqual(first);
    expect(f.auth).toHaveLength(12);
    const before = f.writes.length;
    expect(await loadFunctionalCertification(creds, { ...options, verifyOnly: true })).toEqual(first);
    expect(f.writes).toHaveLength(before);
  });
  it("fails readback when a stored moderation record differs", async () => {
    const f = fake();
    await loadFunctionalCertification(creds, { storeFactory: () => f.store });
    f.rows.moderation_reviews[0].message = "wrong data";
    await expect(loadFunctionalCertification(creds, { storeFactory: () => f.store, verifyOnly: true })).rejects.toThrow("moderation_reviews content mismatch");
  });
});
