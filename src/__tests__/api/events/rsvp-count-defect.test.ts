/**
 * DEFECT characterization — F-079 + F-011: aggregate totals remain exact without exposing attendance rows.
 * SQL COUNT and authorization are exercised by the pgTAP privacy suite.
 */

import { createRsvpFake } from "../../helpers/rsvpCounts";
import { NextRequest } from "next/server";
import {
  type FakeCall,
  type FakeSupabase,
  type FakeUser,
} from "../../helpers/fakeSupabase";
import { GET } from "@/app/api/events/[id]/rsvp/route";

let mockFake: FakeSupabase;

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockFake.client),
}));

// ─── Fixtures ───────────────────────────────────────────────────────────────

const CALLER = { id: "5eed0000-0000-4000-8000-00000000c001", email: "caller@mail.mcgill.ca" };
const EVENT_ID = "5eed0000-0000-4000-8000-00000000e001";

function setup(user: FakeUser | null): FakeSupabase {
  mockFake = createRsvpFake({
    user,
    tables: {
      users: [{ id: CALLER.id, roles: ["user"], onboarding_completed: true, banned_at: null, ban_expires_at: null }],
      events: [{ id: EVENT_ID, status: "approved", deleted_at: null }],
      rsvps: [
        { id: "r1", user_id: "5eed0000-0000-4000-8000-000000009001", event_id: EVENT_ID, status: "going" },
        { id: "r2", user_id: "5eed0000-0000-4000-8000-000000009002", event_id: EVENT_ID, status: "interested" },
        { id: "r3", user_id: "5eed0000-0000-4000-8000-000000009003", event_id: EVENT_ID, status: "cancelled" },
        { id: "r4", user_id: CALLER.id, event_id: EVENT_ID, status: "going" },
      ],
    },
  });
  return mockFake;
}

async function callGet(user: FakeUser | null): Promise<FakeCall[]> {
  const fake = setup(user);
  const res = await GET(
    new NextRequest(`http://localhost:3000/api/events/${EVENT_ID}/rsvp`),
    { params: Promise.resolve({ id: EVENT_ID }) }
  );
  expect(res.status).toBe(200);
  return fake.calls.filter((c) => c.table === "rsvps");
}

describe("F-079/F-011 — public RSVP totals use the aggregate boundary", () => {
  it("anonymous GET never reads RSVP rows", async () => {
    const calls = await callGet(null);
    expect(calls).toHaveLength(0);
    expect(mockFake.calls.filter((call) => call.operation === "rpc")).toHaveLength(1);
    expect(mockFake.calls.find((call) => call.operation === "rpc")).toMatchObject({
      table: "get_public_event_rsvp_counts",
      payload: { target_event_id: EVENT_ID },
    });
  });

  it("authenticated GET only reads the caller's own RSVP row", async () => {
    const calls = await callGet(CALLER);
    expect(calls).toHaveLength(1);
    expect(calls[0].filters).toContainEqual({ op: "eq", column: "user_id", value: CALLER.id });
    expect(calls[0].filters).toContainEqual({ op: "eq", column: "event_id", value: EVENT_ID });
    expect(mockFake.calls.filter((call) => call.operation === "rpc")).toHaveLength(1);
  });
});
