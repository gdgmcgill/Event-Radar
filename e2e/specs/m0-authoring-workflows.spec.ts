/** M0 CERT-05/08 positive workflows, against the guarded local stack only.
 * Reuses existing sessions: no sign-in, global scoring or shared event writes.
 * ad070003 owns the club/onboarding fixture. Events created through the real
 * API have server-generated IDs; exact club/creator/title filters own cleanup.
 * The temporary onboarding profile is restored in finally. Its normal UPDATE
 * trigger advances updated_at; no trigger is suppressed to hide that fact.
 */
import { expect, test, type APIRequestContext } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/supabase/types";
import type { CreateEventBodyInput, EventUpdateBodyInput } from "../../src/contracts/events";
import type { UserUpdateBodyInput } from "../../src/contracts/users";
import { assertSeedTargetAllowed, isLocalSeedTarget } from "../../scripts/seed/guard";
import { localStackEnv } from "../env";
import { IDS, storageStateFor } from "../fixtures";

const CLUB = "ad070003-0000-4000-8000-000000000001";
const PERSONAL_TITLE = "ad070003 onboarding authoring workflow";
const personalTitles = [PERSONAL_TITLE, `${PERSONAL_TITLE} edited`];
const START = "2036-07-03T16:00:00Z";
const END = "2036-07-03T18:00:00Z";
let db: SupabaseClient<Database>;

function eventBody(title: string, clubId?: string): CreateEventBodyInput {
  return {
    title, description: "Isolated M0 authoring workflow", location: "Synthetic campus room",
    start_date: START, end_date: END, tags: ["tech"], is_free: true,
    ...(clubId ? { club_id: clubId } : {}),
  };
}

async function cleanEvents() {
  if (!db) return;
  const clubRows = await db.from("events").delete().eq("club_id", CLUB);
  expect(clubRows.error, "remove only ad070003 club events").toBeNull();
  const personalRows = await db.from("events").delete()
    .eq("created_by", IDS.mid_onboarding_student).in("title", personalTitles);
  expect(personalRows.error, "remove only exact onboarding fixture events").toBeNull();
}

async function readEvent(id: string) {
  const result = await db.from("events")
    .select("id,title,location,club_id,created_by,status,pending_edits,deleted_at")
    .eq("id", id).single();
  expect(result.error, "read persisted workflow event").toBeNull();
  expect(result.data).not.toBeNull();
  return result.data!;
}

test.describe.configure({ mode: "serial" });
test.beforeAll(async ({}, info) => {
  expect(info.config.workers, "profile snapshot/restore requires the harness single worker").toBe(1);
  const stack = localStackEnv();
  if (!isLocalSeedTarget(stack.url)) throw new Error("M0 authoring fixtures require local Supabase");
  assertSeedTargetAllowed(stack.url);
  db = createClient<Database>(stack.url, stack.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await cleanEvents();
  expect((await db.from("clubs").delete().eq("id", CLUB)).error).toBeNull();
  expect((await db.from("clubs").insert({
    id: CLUB, name: "ad070003 authoring club", description: "Disposable authoring club",
    category: "academic", status: "approved", created_by: IDS.club_owner,
  })).error).toBeNull();
  expect((await db.from("club_members").insert([
    { club_id: CLUB, user_id: IDS.club_owner, role: "owner" },
    // The schema has owner/organizer only; the existing club_member persona
    // represents an organizer, not an impossible third 'member' role.
    { club_id: CLUB, user_id: IDS.club_member, role: "organizer" },
  ])).error).toBeNull();
});
test.afterAll(async () => {
  await cleanEvents();
  if (db) expect((await db.from("clubs").delete().eq("id", CLUB)).error).toBeNull();
});

test.describe("actual onboarding transition", () => {
  test.use({ storageState: storageStateFor("mid_onboarding_student") });

  test("interests persist and completion unlocks a personal event submission, edit and delete", async ({ page, playwright, baseURL }) => {
    const snapshot = await db.from("users")
      .select("name,pronouns,year,faculty,interest_tags,onboarding_completed")
      .eq("id", IDS.mid_onboarding_student).single();
    expect(snapshot.error).toBeNull();
    expect(snapshot.data?.onboarding_completed).toBe(false);
    const original = snapshot.data!;
    const anonymous = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    try {
      const denied = await page.request.post("/api/events/create", { data: eventBody(PERSONAL_TITLE) });
      expect(denied.status()).toBe(403);
      expect(await denied.json()).toEqual({ error: "Onboarding required" });
      expect((await db.from("events").select("id").eq("created_by", IDS.mid_onboarding_student).in("title", personalTitles)).data).toEqual([]);

      // These are the wizard's actual two requests. The first owns persistent
      // completion; the second clears its advisory cookie only.
      const profile = {
        name: "M0 Completed Student", pronouns: "they/them", year: "U2", faculty: "Engineering",
        interest_tags: ["tech", "academic"], onboarding_completed: true,
      } satisfies UserUpdateBodyInput;
      const updated = await page.request.patch(`/api/users/${IDS.mid_onboarding_student}`, { data: profile });
      expect(updated.status()).toBe(200);
      expect(updated.headers()["cache-control"]).toBe("private, no-store");
      expect((await updated.json()).data).toMatchObject(profile);
      const persisted = await db.from("users").select("name,interest_tags,onboarding_completed")
        .eq("id", IDS.mid_onboarding_student).single();
      expect(persisted.error).toBeNull();
      expect(persisted.data).toEqual({ name: profile.name, interest_tags: profile.interest_tags, onboarding_completed: true });
      const complete = await page.request.post("/api/onboarding/complete");
      expect(complete.status()).toBe(200);
      expect(await complete.json()).toEqual({ success: true });

      const created = await page.request.post("/api/events/create", { data: eventBody(PERSONAL_TITLE) });
      expect(created.status(), "the same guarded write succeeds after persisted onboarding").toBe(201);
      const event = (await created.json()).event;
      expect(event).toMatchObject({ title: PERSONAL_TITLE, created_by: IDS.mid_onboarding_student, club_id: null, status: "pending" });
      expect(await readEvent(event.id)).toMatchObject({ status: "pending", deleted_at: null });
      expect((await anonymous.get(`/api/events/${event.id}`)).status(), "pending personal submission is not public").toBe(404);

      await page.goto("/my-events");
      await expect(page).toHaveURL(/\/my-events$/);
      await expect(page.getByText(PERSONAL_TITLE, { exact: true }).first()).toBeVisible();
      const title = personalTitles[1];
      const edited = await page.request.patch(`/api/events/${event.id}`, {
        data: { title, location: "Edited personal room" } satisfies EventUpdateBodyInput,
      });
      expect(edited.status()).toBe(200);
      expect(await readEvent(event.id)).toMatchObject({ title, location: "Edited personal room", status: "pending", pending_edits: null });
      await page.reload();
      await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
      const deleted = await page.request.delete(`/api/events/${event.id}`);
      expect(deleted.status()).toBe(200);
      expect(await deleted.json()).toEqual({ success: true });
      expect((await readEvent(event.id)).deleted_at).not.toBeNull();
      expect((await page.request.get(`/api/events/${event.id}`)).status()).toBe(404);
    } finally {
      try {
        await cleanEvents();
      } finally {
        try {
          expect((await db.from("users").update(original).eq("id", IDS.mid_onboarding_student)).error).toBeNull();
          const restored = await db.from("users")
            .select("name,pronouns,year,faculty,interest_tags,onboarding_completed")
            .eq("id", IDS.mid_onboarding_student).single();
          expect(restored.error).toBeNull();
          expect(restored.data, "restore every profile field changed by the wizard").toEqual(original);
        } finally { await anonymous.dispose(); }
      }
    }
  });
});

for (const persona of ["club_owner", "club_member"] as const) {
  test.describe(`${persona} own-club event lifecycle`, () => {
    test.use({ storageState: storageStateFor(persona) });
    test("creates an auto-approved event, edits it publicly, denies a foreign actor and soft-deletes it", async ({ page, playwright, baseURL }) => {
      let anonymous: APIRequestContext | undefined;
      let attacker: APIRequestContext | undefined;
      const title = `ad070003 ${persona} event`;
      try {
        anonymous = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
        attacker = await playwright.request.newContext({ baseURL, storageState: storageStateFor("cross_club_attacker") });
        const created = await page.request.post("/api/events/create", { data: eventBody(title, CLUB) });
        expect(created.status()).toBe(201);
        expect(created.headers()["cache-control"]).toBe("private, no-store");
        const body = await created.json();
        expect(body.message).toBe("Event created and approved");
        const event = body.event;
        expect(event).toMatchObject({ title, club_id: CLUB, created_by: IDS[persona], status: "approved" });
        expect(await readEvent(event.id)).toMatchObject({ status: "approved", pending_edits: null, deleted_at: null });
        expect((await anonymous.get(`/api/events/${event.id}`)).status()).toBe(200);

        const editedTitle = `${title} edited`;
        const edited = await page.request.patch(`/api/events/${event.id}`, {
          data: { title: editedTitle, location: "Edited club room" } satisfies EventUpdateBodyInput,
        });
        expect(edited.status()).toBe(200);
        expect((await edited.json()).pending_fields).toEqual([]);
        const beforeAttack = await readEvent(event.id);
        expect(beforeAttack).toMatchObject({ title: editedTitle, location: "Edited club room", status: "approved", pending_edits: null });
        const publicRead = await anonymous.get(`/api/events/${event.id}`);
        expect(publicRead.status()).toBe(200);
        expect((await publicRead.json()).event).toMatchObject({ id: event.id, title: editedTitle });
        await page.goto(`/events/${event.id}`);
        await expect(page.getByRole("heading", { name: editedTitle, exact: true })).toBeVisible();
        await page.reload();
        await expect(page.getByRole("heading", { name: editedTitle, exact: true })).toBeVisible();

        expect((await attacker.patch(`/api/events/${event.id}`, {
          data: { title: "Foreign overwrite" } satisfies EventUpdateBodyInput,
        })).status()).toBe(403);
        expect((await attacker.delete(`/api/events/${event.id}`)).status()).toBe(403);
        expect(await readEvent(event.id), "foreign update/delete leave the event intact").toEqual(beforeAttack);

        const deleted = await page.request.delete(`/api/events/${event.id}`);
        expect(deleted.status()).toBe(200);
        expect(await deleted.json()).toEqual({ success: true });
        expect((await readEvent(event.id)).deleted_at).not.toBeNull();
        expect((await anonymous.get(`/api/events/${event.id}`)).status()).toBe(404);
        expect((await page.request.get(`/api/events/${event.id}`)).status()).toBe(404);
      } finally {
        try { await cleanEvents(); }
        finally { await Promise.all([anonymous?.dispose(), attacker?.dispose()]); }
      }
    });
  });
}
