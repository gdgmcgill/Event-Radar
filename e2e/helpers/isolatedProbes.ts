import { randomUUID } from "node:crypto";
import { expect, request, type APIRequestContext, type APIResponse } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { assertSeedTargetAllowed } from "../../scripts/seed/guard";
import { PERSONAS } from "../../scripts/seed/personas";
import { localStackEnv } from "../env";
import { IDS, type PersonaKey } from "../fixtures";

export type IsolatedProbe = "popularity" | "audit-delete" | "club-follow" | "batch" | "signout";
export function localService(): SupabaseClient {
  const stack = localStackEnv();
  const target = new URL(stack.url);
  if (!["127.0.0.1", "localhost", "host.docker.internal"].includes(target.hostname) || !/^54\d{3}$/.test(target.port)) {
    throw new Error("Certification fixture writes require the local Supabase stack");
  }
  assertSeedTargetAllowed(stack.url);
  return createClient(stack.url, stack.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
const checked = (label: string, result: { error: unknown }) => expect(result.error, label).toBeNull();

/** A per-test disposable experiment, kept draft so discovery never assigns it. */
export async function experimentFixture(): Promise<{ id: string; cleanup: () => Promise<void> }> {
  const service = localService();
  const id = randomUUID();
  const cleanup = async () => {
    checked("remove smoke experiment variants", await service.from("experiment_variants").delete().eq("experiment_id", id));
    checked("remove smoke experiment", await service.from("experiments").delete().eq("id", id));
  };
  try {
    checked("create smoke experiment", await service.from("experiments").insert({ id, name: "M0 smoke experiment", status: "draft" }));
    checked("create smoke variants", await service.from("experiment_variants").insert([
      { experiment_id: id, name: "control", config: {}, weight: 1 },
      { experiment_id: id, name: "alternative", config: {}, weight: 1 },
    ]));
    return { id, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

async function allScoreRows(service: SupabaseClient, table: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let start = 0; ; start += 1000) {
    const page = await service.from(table).select("*").order("user_id").order(table === "user_event_scores" ? "event_id" : "tag").range(start, start + 999);
    checked(`snapshot ${table}`, page);
    rows.push(...(page.data ?? []));
    if ((page.data ?? []).length < 1000) return rows;
  }
}

/** Restores both global score tables exactly; one Playwright worker is required.
 * The product's batch route has no single-user mode, so this is an explicitly
 * scoped local snapshot/restore, not a pretend isolated per-user recompute. */
async function batchProbe(context: APIRequestContext, service: SupabaseClient): Promise<APIResponse> {
  const tables = ["tag_interaction_counts", "user_event_scores"];
  const snapshots = await Promise.all(tables.map((table) => allScoreRows(service, table)));
  const profiles: { id: string; inferred_tags: string[] | null }[] = [];
  for (let start = 0; ; start += 1000) {
    const page = await service.from("users").select("id,inferred_tags").order("id").range(start, start + 999);
    checked("snapshot inferred tags", page);
    profiles.push(...(page.data ?? []));
    if ((page.data ?? []).length < 1000) break;
  }
  try {
    const response = await context.post("/api/recommendations/batch");
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, message: "Batch scoring completed" });
    return response;
  } finally {
    for (let i = 0; i < tables.length; i++) {
      checked(`clear recomputed ${tables[i]}`, await service.from(tables[i]).delete().not("user_id", "is", null));
      for (let start = 0; start < snapshots[i].length; start += 500) {
        checked(`restore ${tables[i]}`, await service.from(tables[i]).insert(snapshots[i].slice(start, start + 500)));
      }
      expect(await allScoreRows(service, tables[i]), `restored ${tables[i]}`).toEqual(snapshots[i]);
    }
    // The batch also infers interests. Restore only changed profiles; the
    // ordinary UPDATE trigger may advance updated_at for those profiles.
    for (let start = 0; start < profiles.length; start += 500) {
      const before = profiles.slice(start, start + 500);
      const after = await service.from("users").select("id,inferred_tags").in("id", before.map((row) => row.id));
      checked("read inferred-tag changes", after);
      for (const row of after.data ?? []) {
        const original = before.find((item) => item.id === row.id)!;
        if (JSON.stringify(original.inferred_tags) !== JSON.stringify(row.inferred_tags)) {
          checked("restore inferred tags", await service.from("users").update({ inferred_tags: original.inferred_tags }).eq("id", row.id));
        }
      }
    }
  }
}

/** A different auth user, not merely another session for a shared persona.
 * signOut's global scope can therefore never revoke the seed's refresh tokens. */
async function signoutProbe(who: PersonaKey, baseURL: string, service: SupabaseClient): Promise<APIResponse> {
  const source = PERSONAS.find((persona) => persona.key === who)!;
  const email = `m0-signout-${randomUUID()}@mail.mcgill.ca`;
  const password = randomUUID();
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  checked("create disposable sign-out user", created);
  const id = created.data.user!.id;
  let context: APIRequestContext | undefined;
  try {
    checked("create disposable profile", await service.from("users").insert({
      id, email, name: `M0 signout ${who}`, roles: source.roles,
      onboarding_completed: source.onboarding_completed,
      banned_at: source.banned_at, ban_expires_at: source.ban_expires_at, visibility: "public",
    }));
    const stack = localStackEnv();
    const emitted: { name: string; value: string; options: CookieOptions }[] = [];
    const client = createServerClient(stack.url, stack.anonKey, { cookies: { getAll: () => [], setAll: (cookies) => { emitted.push(...cookies); } } });
    const signedIn = await client.auth.signInWithPassword({ email, password });
    checked("sign in disposable user", signedIn);
    expect(signedIn.data.user?.id).toBe(id);
    context = await request.newContext({ baseURL, storageState: { cookies: emitted.map((cookie) => ({
      name: cookie.name, value: cookie.value, domain: new URL(baseURL).hostname, path: "/",
      expires: -1, httpOnly: false, secure: false, sameSite: "Lax" as const,
    })), origins: [] } });
    const before = await context.get("/api/notifications/count");
    expect(before.status()).toBe(["banned_permanent", "suspended_active"].includes(who) ? 403 : 200);
    const response = await context.post("/auth/signout", { maxRedirects: 0, headers: { origin: baseURL } });
    expect(response.status()).toBe(302);
    expect(new URL(response.headers().location).pathname).toBe("/");
    const after = await context.get("/api/notifications/count");
    expect(after.status()).toBe(401);
    // Use a fresh client: the SSR client still carries the pre-signout access
    // token, which can remain cryptographically valid until expiry.
    const verifier = createClient(stack.url, stack.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const refreshed = await verifier.auth.refreshSession({ refresh_token: signedIn.data.session!.refresh_token });
    expect(refreshed.error, "disposable refresh token revoked").not.toBeNull();
    expect(refreshed.data.session).toBeNull();
    return response;
  } finally {
    await context?.dispose();
    checked("remove disposable profile", await service.from("users").delete().eq("id", id));
    checked("remove disposable auth user", await service.auth.admin.deleteUser(id));
  }
}

export async function isolatedMutationProbe(kind: IsolatedProbe, route: string, context: APIRequestContext, who: PersonaKey, baseURL: string): Promise<APIResponse> {
  const service = localService();
  if (kind === "signout") return signoutProbe(who, baseURL, service);
  if (kind === "batch") return batchProbe(context, service);
  const id = randomUUID();
  if (kind === "audit-delete") {
    try {
      const response = await context.delete(route.replace("[id]", id));
      const audit = await service.from("admin_audit_log").select("id").eq("target_id", id);
      checked("read isolated deletion audit", audit);
      expect(audit.data).toHaveLength(1);
      return response;
    } finally {
      checked("remove isolated deletion audit", await service.from("admin_audit_log").delete().eq("target_id", id));
    }
  }
  if (kind === "club-follow") {
    try {
      checked("create follow fixture", await service.from("clubs").insert({ id, name: `M0 follow ${id}`, description: "Disposable authorization fixture", category: "Academic", status: "approved", created_by: IDS.club_owner }));
      const response = await context.post(`/api/clubs/${id}/follow`);
      expect(response.status()).toBe(201);
      const row = await service.from("club_followers").select("user_id").eq("club_id", id);
      checked("read created club follow", row);
      expect(row.data).toEqual([{ user_id: IDS[who] }]);
      return response;
    } finally {
      checked("remove follow fixture rows", await service.from("club_followers").delete().eq("club_id", id));
      checked("remove follow fixture club", await service.from("clubs").delete().eq("id", id));
    }
  }
  try {
    checked("create popularity fixture", await service.from("events").insert({ id, title: "M0 isolated popularity", description: "Disposable authorization fixture", location: "Campus", start_date: "2035-01-01T12:00:00Z", end_date: "2035-01-01T13:00:00Z", status: "approved", created_by: IDS.club_owner, tags: [] }));
    const response = await context.post(`/api/admin/calculate-popularity?event_id=${id}`);
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ results: { total: 1, success: 1, failed: 0 } });
    const score = await service.from("event_popularity_scores").select("event_id").eq("event_id", id);
    checked("read isolated popularity score", score);
    expect(score.data).toEqual([{ event_id: id }]);
    return response;
  } finally {
    checked("remove popularity fixture score", await service.from("event_popularity_scores").delete().eq("event_id", id));
    checked("remove popularity fixture event", await service.from("events").delete().eq("id", id));
  }
}
