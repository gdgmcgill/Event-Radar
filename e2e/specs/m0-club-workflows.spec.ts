/** M0 positive club workflows. Local-only ad070007 fixtures and existing
 * persona sessions; no new sign-ins, baseline memberships or global role edits.
 * Invitation decline is not implemented by this product (valid GET autoaccepts);
 * the expiry case below does not pretend to exercise a decline operation.
 */
import { expect, test, type APIRequestContext } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/supabase/types";
import type { ClubCreateBodyInput, ClubUpdateBodyInput, ClubInviteBodyInput, ClubMemberBodyInput, ClubTransferBodyInput } from "../../src/contracts/clubs";
import type { AdminClubDecisionBodyInput } from "../../src/contracts/admin";
import { assertSeedTargetAllowed, isLocalSeedTarget } from "../../scripts/seed/guard";
import { localStackEnv } from "../env";
import { IDS, PERSONA_CREDENTIALS, storageStateFor } from "../fixtures";

const id = (n: number) => `ad070007-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const CREATED_NAME = "ad070007 application club";
const EDITED_NAME = "ad070007 approved edited club";
let db: SupabaseClient<Database>;
const checked = (label: string, result: { error: unknown }) => expect(result.error, label).toBeNull();

async function cleanClubs(ids: string[]) {
  if (!ids.length) return;
  checked("remove owned club audit", await db.from("admin_audit_log").delete().eq("target_type", "club").in("target_id", ids));
  checked("remove owned moderation", await db.from("moderation_reviews").delete().eq("target_type", "club").in("target_id", ids));
  checked("remove owned club events", await db.from("events").delete().in("club_id", ids));
  checked("remove owned clubs and cascading joins", await db.from("clubs").delete().in("id", ids));
}

async function cleanCreatedClub() {
  const clubs = await db.from("clubs").select("id").eq("created_by", IDS.club_owner).in("name", [CREATED_NAME, EDITED_NAME]);
  checked("find exact API-created club fixtures", clubs);
  // Approval notification has no club foreign key; its exact message is scoped
  // by both the synthetic name and the expected recipient/type.
  checked("remove exact approval notification", await db.from("notifications").delete()
    .eq("user_id", IDS.club_owner).eq("type", "club_approved")
    .eq("message", `Your club "${CREATED_NAME}" has been approved. You are now the owner and can create events.`));
  await cleanClubs((clubs.data ?? []).map((club) => club.id));
}

async function fixtureClub(clubId: string, name: string) {
  await cleanClubs([clubId]);
  checked("create disposable club", await db.from("clubs").insert({
    id: clubId, name, description: `${name} description`, category: "academic",
    status: "approved", created_by: IDS.club_owner,
  }));
  checked("create disposable owner membership", await db.from("club_members").insert({ club_id: clubId, user_id: IDS.club_owner, role: "owner" }));
}

async function followerCount(context: APIRequestContext, clubId: string) {
  const result = await context.get(`/api/clubs/${clubId}`);
  expect(result.status()).toBe(200);
  return (await result.json()).followerCount;
}

test.use({ storageState: storageStateFor("club_owner") });
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  const stack = localStackEnv();
  if (!isLocalSeedTarget(stack.url)) throw new Error("M0 club workflows require local Supabase");
  assertSeedTargetAllowed(stack.url);
  db = createClient<Database>(stack.url, stack.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
});

test("club application becomes public only after admin approval; owner changes persist", async ({ page, playwright, baseURL }) => {
  const admin = await playwright.request.newContext({ baseURL, storageState: storageStateFor("admin") });
  const anonymous = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  try {
    await cleanCreatedClub();
    const profile = await db.from("users").select("roles").eq("id", IDS.club_owner).single();
    checked("read existing organizer role", profile);
    expect(profile.data?.roles).toContain("club_organizer");
    const response = await page.request.post("/api/clubs", { data: {
      name: CREATED_NAME, description: "New application description", category: "academic",
      contact_email: "ad070007-club@mail.mcgill.ca", website_url: "https://example.com/ad070007",
    } satisfies ClubCreateBodyInput });
    expect(response.status()).toBe(201);
    const club = await response.json();
    expect(club).toMatchObject({ name: CREATED_NAME, status: "pending", created_by: IDS.club_owner });
    const members = await db.from("club_members").select("user_id,role").eq("club_id", club.id);
    checked("read API-created owner", members);
    expect(members.data).toEqual([{ user_id: IDS.club_owner, role: "owner" }]);
    const before = await anonymous.get("/api/clubs");
    expect(before.status()).toBe(200);
    expect((await before.json()).clubs.map((row: { id: string }) => row.id)).not.toContain(club.id);

    const approved = await admin.patch(`/api/admin/clubs/${club.id}`, { data: { status: "approved" } satisfies AdminClubDecisionBodyInput });
    expect(approved.status()).toBe(200);
    expect((await db.from("clubs").select("status").eq("id", club.id).single()).data?.status).toBe("approved");
    const after = await anonymous.get("/api/clubs");
    expect(after.status()).toBe(200);
    expect((await after.json()).clubs.map((row: { id: string }) => row.id)).toContain(club.id);
    const audit = await db.from("admin_audit_log").select("admin_user_id,action").eq("target_type", "club").eq("target_id", club.id);
    checked("read approval audit", audit);
    expect(audit.data).toEqual([{ admin_user_id: IDS.admin, action: "approved" }]);
    const edited = await page.request.patch(`/api/clubs/${club.id}`, { data: {
      name: EDITED_NAME, description: "Changed owner description", website_url: "https://example.com/ad070007-edited",
    } satisfies ClubUpdateBodyInput });
    expect(edited.status()).toBe(200);
    expect((await edited.json()).club).toMatchObject({ name: EDITED_NAME, description: "Changed owner description", status: "approved", created_by: IDS.club_owner });
    await page.goto(`/clubs/${club.id}`);
    await expect(page.getByRole("heading", { name: EDITED_NAME, exact: true })).toBeVisible();
    await expect(page.getByText("Changed owner description", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: EDITED_NAME, exact: true })).toBeVisible();
  } finally {
    try { await cleanCreatedClub(); }
    finally { await Promise.all([admin.dispose(), anonymous.dispose()]); }
  }
});

test("follow is idempotent and unfollow removes the row and visible follower count", async ({ page, playwright, baseURL }) => {
  const clubId = id(2);
  const student = await playwright.request.newContext({ baseURL, storageState: storageStateFor("onboarded_student") });
  try {
    await fixtureClub(clubId, "ad070007 follow club");
    expect(await followerCount(page.request, clubId)).toBe(0);
    for (let i = 0; i < 2; i++) {
      const follow = await student.post(`/api/clubs/${clubId}/follow`);
      expect(follow.status()).toBe(201);
      expect(await follow.json()).toEqual({ following: true });
    }
    const rows = await db.from("club_followers").select("user_id").eq("club_id", clubId);
    checked("read persisted follow", rows);
    expect(rows.data).toEqual([{ user_id: IDS.onboarded_student }]);
    expect(await followerCount(page.request, clubId)).toBe(1);
    const state = await student.get(`/api/clubs/${clubId}/follow`);
    expect(state.status()).toBe(200); expect(await state.json()).toEqual({ following: true });
    await page.goto(`/clubs/${clubId}`);
    await expect(page.getByText("Followers", { exact: true }).locator("..").locator("div").first()).toHaveText("1");
    const unfollow = await student.delete(`/api/clubs/${clubId}/follow`);
    expect(unfollow.status()).toBe(200); expect(await unfollow.json()).toEqual({ following: false });
    const remaining = await db.from("club_followers").select("id").eq("club_id", clubId);
    checked("read removed follow", remaining); expect(remaining.data).toEqual([]);
    expect(await followerCount(page.request, clubId)).toBe(0);
    const unfollowedState = await student.get(`/api/clubs/${clubId}/follow`);
    expect(unfollowedState.status()).toBe(200); expect(await unfollowedState.json()).toEqual({ following: false });
    await page.reload();
    await expect(page.getByText("Followers", { exact: true }).locator("..").locator("div").first()).toHaveText("0");
  } finally {
    try { await cleanClubs([clubId]); } finally { await student.dispose(); }
  }
});

test("an expired real invitation renders its refusal without accepting or creating membership", async ({ page, browser, baseURL }) => {
  const clubId = id(3);
  const invitee = await browser.newContext({ baseURL, storageState: storageStateFor("onboarded_student") });
  try {
    await fixtureClub(clubId, "ad070007 expired invitation club");
    const sent = await page.request.post(`/api/clubs/${clubId}/invites`, { data: {
      email: PERSONA_CREDENTIALS.onboarded_student.email,
    } satisfies ClubInviteBodyInput });
    expect(sent.status()).toBe(201);
    const token = (await sent.json()).invite.token;
    checked("expire only this disposable token", await db.from("club_invitations").update({ expires_at: "2016-01-01T00:00:00Z" }).eq("club_id", clubId).eq("token", token));
    const invitePage = await invitee.newPage();
    await invitePage.goto(`/invites/${token}`);
    await expect(invitePage.getByRole("heading", { name: "Invitation Expired", exact: true })).toBeVisible();
    await invitePage.reload();
    await expect(invitePage.getByRole("heading", { name: "Invitation Expired", exact: true })).toBeVisible();
    const invitation = await db.from("club_invitations").select("status").eq("club_id", clubId).eq("token", token).single();
    checked("expired page does not accept invitation", invitation); expect(invitation.data?.status).toBe("pending");
    const members = await db.from("club_members").select("id").eq("club_id", clubId).eq("user_id", IDS.onboarded_student);
    checked("expired page creates no membership", members); expect(members.data).toEqual([]);
  } finally {
    try { await cleanClubs([clubId]); } finally { await invitee.close(); }
  }
});

test("owner removes an organizer then transfers ownership; authority moves with the membership", async ({ page, playwright, baseURL }) => {
  const clubId = id(4), removedId = id(40), successorId = id(41);
  const successor = await playwright.request.newContext({ baseURL, storageState: storageStateFor("club_member") });
  const removed = await playwright.request.newContext({ baseURL, storageState: storageStateFor("onboarded_student") });
  try {
    await fixtureClub(clubId, "ad070007 ownership club");
    checked("insert disposable organizers", await db.from("club_members").insert([
      { id: removedId, club_id: clubId, user_id: IDS.onboarded_student, role: "organizer" },
      { id: successorId, club_id: clubId, user_id: IDS.club_member, role: "organizer" },
    ]));
    expect((await removed.get(`/api/clubs/${clubId}/members`)).status()).toBe(200);
    const removal = await page.request.delete(`/api/clubs/${clubId}/members`, { data: { memberId: removedId } satisfies ClubMemberBodyInput });
    expect(removal.status()).toBe(200); expect(await removal.json()).toEqual({ success: true });
    expect((await db.from("club_members").select("id").eq("id", removedId)).data).toEqual([]);
    expect((await removed.get(`/api/clubs/${clubId}/members`)).status()).toBe(403);

    const transfer = await page.request.post(`/api/clubs/${clubId}/transfer`, { data: { newOwnerId: IDS.club_member } satisfies ClubTransferBodyInput });
    expect(transfer.status()).toBe(200); expect(await transfer.json()).toEqual({ success: true });
    const members = await db.from("club_members").select("user_id,role").eq("club_id", clubId).order("user_id");
    checked("read transferred membership roles", members);
    expect(members.data).toEqual([
      { user_id: IDS.club_member, role: "owner" }, { user_id: IDS.club_owner, role: "organizer" },
    ]);
    expect((await page.request.patch(`/api/clubs/${clubId}`, { data: { description: "old owner" } satisfies ClubUpdateBodyInput })).status()).toBe(403);
    const changed = await successor.patch(`/api/clubs/${clubId}`, { data: { description: "Successor owns editing" } satisfies ClubUpdateBodyInput });
    expect(changed.status()).toBe(200);
    expect((await changed.json()).club.description).toBe("Successor owns editing");
    const audit = await db.from("admin_audit_log").select("action,admin_user_id,metadata").eq("target_type", "club").eq("target_id", clubId);
    checked("read ownership-transfer audit", audit);
    expect(audit.data).toEqual([{ action: "club_ownership_transferred", admin_user_id: IDS.club_owner,
      metadata: { new_owner_id: IDS.club_member, previous_owner_id: IDS.club_owner } }]);
  } finally {
    try { await cleanClubs([clubId]); } finally { await Promise.all([successor.dispose(), removed.dispose()]); }
  }
});

test("owner opens two separate management surfaces from My Clubs without mixing their events", async ({ page }) => {
  const first = id(5), second = id(6);
  const names = ["ad070007 first managed club", "ad070007 second managed club"];
  const titles = ["ad070007 first club event", "ad070007 second club event"];
  try {
    await fixtureClub(first, names[0]); await fixtureClub(second, names[1]);
    checked("insert exact dashboard fixtures", await db.from("events").insert([first, second].map((clubId, i) => ({
      id: id(50 + i), club_id: clubId, created_by: IDS.club_owner, title: titles[i], description: "Management isolation fixture",
      location: "Synthetic room", start_date: "2036-08-01T16:00:00Z", end_date: "2036-08-01T18:00:00Z", status: "approved", tags: ["tech"],
    }))));
    for (const [index, clubId] of [first, second].entries()) {
      await page.goto("/clubs?tab=my-clubs");
      await page.getByRole("button", { name: new RegExp(names[index]) }).click();
      await expect(page).toHaveURL(new RegExp(`/my-clubs/${clubId}$`));
      await expect(page.getByRole("heading", { name: names[index], exact: true })).toBeVisible();
      await expect(page.getByText(titles[index], { exact: true }).first()).toBeVisible();
      await expect(page.getByText(titles[1 - index], { exact: true })).toHaveCount(0);
    }
  } finally { await cleanClubs([first, second]); }
});
