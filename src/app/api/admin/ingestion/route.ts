import { NextResponse } from "next/server";
import { recentDeliveries, ingestionSummary, stalePendingEvents } from "@/server/ingestion/summary";
import { adminContext } from "@/server/opportunities/admin";
import { withRoute } from "@/server/route";

/** M3 P1-07: ingestion freshness, recent deliveries and the stale pending queue. */
export const GET = withRoute({ cache: "private", action: "load ingestion status" }, async () => {
  const auth = await adminContext();
  if (!auth.ok) return auth.response;
  const [summary, deliveries, stale] = await Promise.all([
    ingestionSummary(),
    recentDeliveries(),
    stalePendingEvents(),
  ]);
  return NextResponse.json({ summary, deliveries, stale });
});
