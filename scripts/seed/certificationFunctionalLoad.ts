/** Opt-in CERT-01 loader. No imports execute IO; no default seed is changed. */
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assertSeedTargetAllowed, type SeedGuardOptions } from "./guard";
import { FUNCTIONAL_BOUNDS, FUNCTIONAL_NAMESPACE, FUNCTIONAL_PASSWORD, FUNCTIONAL_PNG, FUNCTIONAL_TABLES, functionalManifest, generateFunctionalCertificationData, type FunctionalTable } from "./certificationFunctionalData";

type Row = Record<string, unknown>;
type Data = ReturnType<typeof generateFunctionalCertificationData>;
type Account = { id: string; email?: string; app_metadata?: Record<string, unknown> };
export interface FunctionalCredentials { url: string; serviceRoleKey: string; anonKey: string }
export interface FunctionalStore {
  accounts(): Promise<Account[]>;
  createAccount(row: Data["tables"]["users"][number]): Promise<void>;
  clear(table: FunctionalTable): Promise<void>;
  insert(table: FunctionalTable, rows: Row[]): Promise<void>;
  read(table: FunctionalTable): Promise<Row[]>;
  uploadOwnedStorage(data: Data): Promise<void>;
  verifyStorage(data: Data): Promise<string>;
}
const key = (row: Row) => String(row.id ?? `${row.user_id}:${row.event_id}`);
function check(action: string, error: unknown) { if (error) throw new Error(`Functional certification: ${action} failed`); }
function realStore(credentials: FunctionalCredentials): FunctionalStore {
  const settings = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(credentials.url, credentials.serviceRoleKey, settings);
  const signIn = async (data: Data, index: number) => {
    const client = createClient(credentials.url, credentials.anonKey, settings);
    const result = await client.auth.signInWithPassword({ email: data.tables.users[index].email, password: FUNCTIONAL_PASSWORD });
    check("fixture sign-in", result.error);
    if (result.data.user?.id !== data.tables.users[index].id) throw new Error("Functional certification: fixture identity mismatch");
    return client;
  };
  return {
    async accounts() {
      const accounts: Account[] = [];
      for (let page = 1; ; page++) {
        const result = await admin.auth.admin.listUsers({ page, perPage: 1000 }); check("list auth", result.error);
        accounts.push(...result.data.users);
        if (result.data.users.length < 1000) return accounts;
      }
    },
    async createAccount(row) {
      check("create auth", (await admin.auth.admin.createUser({ id: row.id, email: row.email, email_confirm: true, password: FUNCTIONAL_PASSWORD, app_metadata: { certification_namespace: FUNCTIONAL_NAMESPACE }, user_metadata: { name: row.name } })).error);
    },
    async clear(table) {
      const column = table === "user_event_scores" ? "user_id" : "id";
      check(`clear ${table}`, (await admin.from(table).delete().gte(column, FUNCTIONAL_BOUNDS[0]).lt(column, FUNCTIONAL_BOUNDS[1])).error);
    },
    async insert(table, rows) { check(`insert ${table}`, (await admin.from(table).insert(rows)).error); },
    async read(table) {
      const column = table === "user_event_scores" ? "user_id" : "id";
      const result = await admin.from(table).select("*").gte(column, FUNCTIONAL_BOUNDS[0]).lt(column, FUNCTIONAL_BOUNDS[1]).order(column);
      check(`read ${table}`, result.error); return result.data!;
    },
    async uploadOwnedStorage(data) {
      const buckets = await admin.storage.listBuckets(); check("list buckets", buckets.error);
      for (const bucketName of [data.storage.bucket, data.storage.clubBranding.bucket]) {
        const bucket = buckets.data!.find((bucket) => bucket.id === bucketName);
        if (!bucket) {
          check("create fixture bucket", (await admin.storage.createBucket(bucketName, { public: true, allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"], fileSizeLimit: 5242880 })).error);
        } else if (!bucket.public || (bucket.allowed_mime_types && !bucket.allowed_mime_types.includes("image/png")) || (bucket.file_size_limit !== null && bucket.file_size_limit !== undefined && bucket.file_size_limit < Buffer.from(FUNCTIONAL_PNG, "base64").length)) {
          throw new Error("Functional certification: existing bucket configuration does not support the fixture; left unchanged");
        }
      }
      const owner = await signIn(data, 0);
      const stranger = await signIn(data, 11);
      const clubOwner = await signIn(data, 3);
      try {
        const bytes = Buffer.from(FUNCTIONAL_PNG, "base64");
        const own = owner.storage.from(data.storage.bucket);
        check("owner upload", (await own.upload(data.storage.path, bytes, { contentType: "image/png", upsert: true })).error);
        const attack = await stranger.storage.from(data.storage.bucket).update(data.storage.path, Buffer.from("cross-user overwrite probe"), { contentType: "image/png" });
        if (!attack.error) {
          // Restore ONLY this fixture if a policy regresses, then fail loudly.
          check("restore fixture object", (await own.update(data.storage.path, bytes, { contentType: "image/png" })).error);
          throw new Error("Functional certification: cross-user storage overwrite was allowed");
        }
        if (Number(attack.error.statusCode) !== 403) throw new Error("Functional certification: expected403 for cross-user storage overwrite");
        const branding = data.storage.clubBranding;
        check("club owner branding upload", (await clubOwner.storage.from(branding.bucket).upload(branding.path, bytes, { contentType: "image/png", upsert: true })).error);
        const crossClub = await clubOwner.storage.from(branding.bucket).upload(branding.deniedPath, bytes, { contentType: "image/png", upsert: true });
        if (!crossClub.error) {
          check("remove unexpected cross-club fixture", (await admin.storage.from(branding.bucket).remove([branding.deniedPath])).error);
          throw new Error("Functional certification: cross-club branding upload was allowed");
        }
        if (Number(crossClub.error.statusCode) !== 403) throw new Error("Functional certification: expected403 for cross-club branding upload");
      } finally {
        await Promise.all([owner.auth.signOut(), stranger.auth.signOut(), clubOwner.auth.signOut()]);
      }
    },
    async verifyStorage(data) {
      for (const object of [data.storage, data.storage.clubBranding]) {
        const result = await admin.storage.from(object.bucket).download(object.path); check("read owned object", result.error);
        const hash = createHash("sha256").update(Buffer.from(await result.data!.arrayBuffer())).digest("hex");
        if (hash !== data.storage.sha256) throw new Error("Functional certification: owned object hash mismatch");
      }
      return data.storage.sha256;
    },
  };
}

function project(rows: Row[], expected: Row[]) {
  if (rows.length !== expected.length) throw new Error("Functional certification: row count mismatch");
  const actual = new Map(rows.map((row) => [key(row), row]));
  return expected.map((row) => {
    const stored = actual.get(key(row));
    if (!stored) throw new Error("Functional certification: missing row");
    return Object.fromEntries(Object.keys(row).filter((field) => field !== "updated_at").sort().map((field) => {
      const value = stored[field];
      return [field, typeof value === "string" && /(_at|_date)$/.test(field) && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : value];
    }));
  });
}
export async function loadFunctionalCertification(credentials: FunctionalCredentials, options: { guard?: SeedGuardOptions; storeFactory?: (credentials: FunctionalCredentials) => FunctionalStore; verifyOnly?: boolean } = {}) {
  assertSeedTargetAllowed(credentials.url, options.guard);
  if (!credentials.anonKey || !credentials.serviceRoleKey) throw new Error("Functional certification: both local keys required");
  const data = generateFunctionalCertificationData();
  const store = (options.storeFactory ?? realStore)(credentials);
  if (!options.verifyOnly) {
    const accounts = await store.accounts();
    const missing: Data["tables"]["users"] = [];
    for (const user of data.tables.users) {
      const found = accounts.find((account) => account.id === user.id || account.email?.toLowerCase() === user.email.toLowerCase());
      if (found && (found.id !== user.id || found.email !== user.email || found.app_metadata?.certification_namespace !== FUNCTIONAL_NAMESPACE)) throw new Error("Functional certification: unrelated auth ownership collision");
      if (!found) missing.push(user);
    }
    for (const user of missing) await store.createAccount(user);
    for (const table of [...FUNCTIONAL_TABLES].reverse()) await store.clear(table);
    for (const table of FUNCTIONAL_TABLES) {
      const rows = data.tables[table] as Row[];
      for (let offset = 0; offset < rows.length; offset += 250) await store.insert(table, rows.slice(offset, offset + 250));
    }
    await store.uploadOwnedStorage(data);
  }
  const hash = createHash("sha256");
  for (const table of FUNCTIONAL_TABLES) {
    const rows = await store.read(table);
    const expected = data.tables[table] as Row[];
    const actual = project(rows, expected);
    if (JSON.stringify(actual) !== JSON.stringify(project(expected, expected))) throw new Error(`Functional certification: ${table} content mismatch`);
    if (table === "users") for (const row of rows) {
      if (row.saved_events_count !== data.tables.saved_events.filter((save) => save.user_id === row.id).length) throw new Error("Functional certification: saved count mismatch");
    }
    hash.update(table).update(JSON.stringify(actual));
  }
  const storageSha256 = await store.verifyStorage(data);
  return { ...functionalManifest(data), persistedSha256: hash.update(storageSha256).digest("hex"), storageSha256, excludedRuntimeColumns: ["updated_at", "auth and storage timestamps", "derived popularity calculated_at/scores"] };
}
