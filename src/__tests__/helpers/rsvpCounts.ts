import { createFakeSupabase, type FakeRpcResult, type FakeSupabaseInit } from "./fakeSupabase";

/** Fixture adapter for the aggregate RPC. SQL semantics are verified separately
 * with real roles in 085-rsvp-attendance-privacy.test.sql. */
export function createRsvpFake(init: FakeSupabaseInit) {
  const aggregate: FakeRpcResult = { data: [], error: init.errors?.rsvps ?? null };
  const fake = createFakeSupabase({
    ...init,
    rpc: { ...init.rpc, get_public_event_rsvp_counts: aggregate },
  });
  const rpc = fake.client.rpc;
  fake.client.rpc = (name, args) => {
    if (name === "get_public_event_rsvp_counts") {
      const eventId = (args as { target_event_id: string }).target_event_id;
      const rows = (fake.tables.rsvps ?? []).filter((row) => row.event_id === eventId);
      aggregate.data = [{
        going: rows.filter((row) => row.status === "going").length,
        interested: rows.filter((row) => row.status === "interested").length,
      }];
    }
    return rpc(name, args);
  };
  return fake;
}
