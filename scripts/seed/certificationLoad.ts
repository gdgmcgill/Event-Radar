/**
 * CERT-02/03/04: explicitly invoked certification loader; never runs on import.
 * Purges ONLY the selected c0700001/c0700002 UUID namespace, children first.
 * Functional personas are untouched. Auth accounts are reused after checking
 * both fixed email and immutable app_metadata ownership. Partial loads can be
 * retried. Runtime-owned timestamps are not claimed to be byte deterministic.
 */
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assertSeedTargetAllowed, type SeedGuardOptions } from "./guard";
import { datasetManifest, generateCertificationData, namespaceBounds, TABLES, type CertificationData, type DatasetName, type FixtureTable } from "./certificationData";

type Row = Record<string, unknown> & { id: string };
interface AuthAccount { id: string; email?: string; app_metadata?: Record<string, unknown> }
export interface CertificationStore {
  listAuth(): Promise<AuthAccount[]>;
  createAuth(user: Row, namespace: string): Promise<void>;
  clear(table: FixtureTable, bounds: [string, string]): Promise<void>;
  insert(table: FixtureTable, rows: Row[]): Promise<void>;
  read(table: FixtureTable, bounds: [string, string]): Promise<Row[]>;
}
export interface CertificationCredentials { url: string; serviceRoleKey: string }
const BATCH_SIZE = 250;
function batches<T>(rows: T[], size = BATCH_SIZE): T[][] {
  return Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size));
}
function checked(context: string, error: { code?: string } | null): void {
  if (error) throw new Error(`${context} failed (${/^[A-Z0-9]{5}$/.test(error.code ?? "") ? error.code : "upstream error"})`);
}

function supabaseStore(credentials: CertificationCredentials): CertificationStore {
  // The caller has already passed the target guard. No .env file is loaded.
  const admin = createClient(credentials.url, credentials.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return {
    async listAuth() {
      const all: AuthAccount[] = [];
      for (let page = 1; ; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        checked("list auth users", error);
        all.push(...data.users);
        if (data.users.length < 1000) return all;
      }
    },
    async createAuth(user, namespace) {
      const { error } = await admin.auth.admin.createUser({
        id: user.id, email: String(user.email), email_confirm: true,
        password: "Certification-local-only-2026!",
        app_metadata: { certification_namespace: namespace },
        user_metadata: { name: user.name },
      });
      checked("create certification auth user", error);
    },
    async clear(table, [lower, upper]) {
      checked(`clear ${table}`, (await admin.from(table).delete().gte("id", lower).lt("id", upper)).error);
    },
    async insert(table, rows) {
      checked(`insert ${table}`, (await admin.from(table).insert(rows)).error);
    },
    async read(table, [lower, upper]) {
      const rows: Row[] = [];
      for (let offset = 0; ; offset += 1000) {
        const result = await admin.from(table).select("*").gte("id", lower).lt("id", upper).order("id").range(offset, offset + 999);
        checked(`read ${table}`, result.error);
        const page = result.data as Row[];
        rows.push(...page);
        if (page.length < 1000) return rows;
      }
    },
  };
}

/**
 * Canonical persisted projection: all supplied columns except updated_at,
 * which existing row triggers overwrite with now(). Normalize timestamptz wire
 * spelling only, never values; separately verify saved_events_count below.
 */
function projection(actual: Row[], expected: Row[]): Row[] {
  const byId = new Map(actual.map((row) => [row.id, row]));
  if (actual.length !== expected.length) throw new Error("Certification row count mismatch");
  return expected.map((row) => {
    const stored = byId.get(row.id);
    if (!stored) throw new Error("Missing certification row");
    return Object.fromEntries(Object.keys(row).filter((key) => key !== "updated_at").sort().map((key) => {
      let value = stored[key];
      if (typeof value === "string" && /(_at|_date)$/.test(key) && !Number.isNaN(Date.parse(value))) value = new Date(value).toISOString();
      return [key, value];
    })) as Row;
  });
}

export async function verifyCertificationStore(data: CertificationData, store: CertificationStore) {
  const hash = createHash("sha256");
  const bounds = namespaceBounds(data.name);
  const saves = new Map<string, number>();
  for (const row of data.tables.saved_events) saves.set(row.user_id!, (saves.get(row.user_id!) ?? 0) + 1);
  for (const table of TABLES) {
    const expected = data.tables[table] as Row[];
    const actual = await store.read(table, bounds);
    const canonical = projection(actual, expected);
    if (JSON.stringify(canonical) !== JSON.stringify(projection(expected, expected))) throw new Error(`Certification ${table} values differ from generated fixture`);
    if (table === "users") {
      for (const user of actual) if (user.saved_events_count !== (saves.get(user.id) ?? 0)) throw new Error("Certification saved_events_count differs from saves");
    }
    hash.update(table).update(JSON.stringify(canonical));
  }
  return { ...datasetManifest(data), persistedSha256: hash.digest("hex"), excludedRuntimeColumns: ["updated_at", "auth timestamps", "derived popularity calculated_at/scores"] };
}

export async function loadCertificationDataset(
  name: DatasetName,
  credentials: CertificationCredentials,
  options: { guard?: SeedGuardOptions; storeFactory?: (credentials: CertificationCredentials) => CertificationStore; verifyOnly?: boolean } = {}
) {
  // CERT-04: refuse before constructing a client or doing any read/write.
  assertSeedTargetAllowed(credentials.url, options.guard);
  if (!credentials.serviceRoleKey) throw new Error("Missing service-role key");
  const data = generateCertificationData(name);
  const store = (options.storeFactory ?? supabaseStore)(credentials);
  if (options.verifyOnly) return verifyCertificationStore(data, store);
  const accounts = await store.listAuth();
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const byEmail = new Map(accounts.map((account) => [account.email?.toLowerCase(), account]));
  const missing: Row[] = [];
  // Validate every ownership collision before the first write.
  for (const user of data.tables.users) {
    const found = byId.get(user.id);
    if (found && (found.email !== user.email || found.app_metadata?.certification_namespace !== data.namespace)) throw new Error("Refused: certification auth ID belongs to an unrelated account");
    if (!found && byEmail.has(user.email.toLowerCase())) throw new Error("Refused: certification email belongs to another account ID");
    if (!found) missing.push(user);
  }
  // Bounded concurrency keeps GoTrue connection pressure predictable.
  for (const batch of batches(missing, 8)) await Promise.all(batch.map((user) => store.createAuth(user, data.namespace)));
  const bounds = namespaceBounds(name);
  for (const table of [...TABLES].reverse()) await store.clear(table, bounds);
  for (const table of TABLES) {
    for (const batch of batches(data.tables[table] as Row[])) await store.insert(table, batch);
  }
  return verifyCertificationStore(data, store);
}
