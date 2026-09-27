/** DEFECT F-088 / DI-74: hidden event identifiers are not an appeal oracle. */
import { NextRequest } from "next/server";
import { createFakeSupabase, type FakeSupabase } from "../helpers/fakeSupabase";
let mockCookie: FakeSupabase;
const mockElevated = jest.fn();
jest.mock("@/lib/supabase/server", () => ({ createClient: () => Promise.resolve(mockCookie.client) }));
jest.mock("@/server/db/elevated", () => ({ getElevatedClient: () => mockElevated() }));
const user = { id: "00000000-0000-4000-8000-000000000001" };
const id = "00000000-0000-4000-8000-000000000002";
beforeEach(() => { mockElevated.mockReset(); jest.spyOn(console,"error").mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());
it.each([
  { created_by: "another-user", deleted_at: null },
  { created_by: user.id, deleted_at: "2026-01-01T00:00:00Z" },
])("returns identical 404 and performs no writes for $created_by / $deleted_at", async (scope) => {
  mockCookie = createFakeSupabase({ user, tables: {
    users: [{id:user.id,roles:["user"],onboarding_completed:true}],
    events: [{id,status:"rejected",...scope}],
  } });
  const {POST} = await import("@/app/api/events/[id]/appeal/route");
  const response = await POST(new NextRequest(`https://example.test/api/events/${id}/appeal`,{
    method:"POST",body:JSON.stringify({message:"Please reconsider"}),
  }),{params:Promise.resolve({id})});
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({error:"Event not found"});
  expect(mockElevated).not.toHaveBeenCalled();
  expect(mockCookie.calls.some((call)=>call.operation!=="select")).toBe(false);
});
