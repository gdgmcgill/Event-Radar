import { NextResponse, type NextRequest } from "next/server";
import { DetailParams } from "@/contracts/discovery";
import { EventMetadataBody, EventEditorialMetadata, EventMergeBody } from "@/contracts/opportunities";
import { parseBody, parseWith } from "@/server/body";
import { getElevatedClient } from "@/server/db/elevated";
import { adminContext, mutationError } from "@/server/opportunities/admin";
import { notFound } from "@/server/errors";
import { withRoute } from "@/server/route";
type RouteContext = { params: Promise<{ id: string }> };
export const GET = withRoute({ cache: "private", action: "load event discovery metadata" }, async (_request: NextRequest, { params }: RouteContext) => {
 const auth = await adminContext(); if (!auth.ok) return auth.response;
 const id = parseWith(DetailParams, await params); if (!id.ok) return id.response;
 const db = getElevatedClient();
 const { data: event, error: eventError } = await db.from("events").select("id,title").eq("id", id.data.id).is("deleted_at", null).maybeSingle(); if (eventError) throw eventError;
 if (!event) return notFound("Event not found");
 const { data: metadata, error } = await db.from("event_discovery_metadata").select("*").eq("event_id", id.data.id).maybeSingle(); if (error) throw error;
 const { data: schools, error: schoolError } = await db.from("event_discovery_universities").select("university_id").eq("event_id", id.data.id); if (schoolError) throw schoolError;
 const { data: duplicates, error: duplicateError } = await db.rpc("discovery_duplicate_candidates", { p_kind: "event", p_id: id.data.id }); if (duplicateError) throw duplicateError;
 const data = metadata ? { ...metadata, university_ids: (schools ?? []).map((row) => row.university_id) } : EventEditorialMetadata.parse({ relevance_scope: "specific", university_ids: ["10000000-0000-4000-8000-000000000001"] });
 return NextResponse.json({ event, data, updated_at: metadata?.updated_at ?? null, can_assign_pick: auth.canPick, duplicates });
});
export const PUT = withRoute({ cache: "private", action: "edit event discovery metadata" }, async (request: NextRequest, { params }: RouteContext) => {
 const auth = await adminContext(); if (!auth.ok) return auth.response;
 const id = parseWith(DetailParams, await params); if (!id.ok) return id.response;
 const parsed = await parseBody(request, EventMetadataBody); if (!parsed.ok) return parsed.response;
 const { data, error } = await getElevatedClient().rpc("curate_event_discovery", { p_actor: auth.user.id, p_id: id.data.id, p_data: parsed.data.data, p_expected: parsed.data.expected_updated_at ?? undefined, p_can_pick: auth.canPick });
 if (error) return mutationError(error);
 return NextResponse.json({ data });
});
export const PATCH = withRoute({ cache: "private", action: "merge duplicate event" }, async (request: NextRequest, { params }: RouteContext) => {
 const auth = await adminContext(); if (!auth.ok) return auth.response;
 const id = parseWith(DetailParams, await params); if (!id.ok) return id.response;
 const parsed = await parseBody(request, EventMergeBody); if (!parsed.ok) return parsed.response;
 const body = parsed.data;
 const { error } = await getElevatedClient().rpc("merge_event_discovery", { p_actor: auth.user.id, p_id: id.data.id, p_canonical_kind: body.canonical.kind, p_canonical_id: body.canonical.id, p_reason: body.reason, p_expected: body.expected_updated_at ?? undefined });
 if (error) return mutationError(error);
 return NextResponse.json({ canonical: body.canonical });
});
