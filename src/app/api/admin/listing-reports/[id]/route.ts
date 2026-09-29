import { NextResponse, type NextRequest } from "next/server";
import { DetailParams } from "@/contracts/discovery";
import { ListingReportResolveBody } from "@/contracts/intake";
import { parseBody, parseWith } from "@/server/body";
import { getElevatedClient } from "@/server/db/elevated";
import { adminContext, mutationError } from "@/server/opportunities/admin";
import { withRoute } from "@/server/route";

export const PATCH = withRoute({ cache: "private", action: "resolve listing report" }, async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await adminContext();
  if (!auth.ok) return auth.response;
  const id = parseWith(DetailParams, await params);
  if (!id.ok) return id.response;
  const parsed = await parseBody(request, ListingReportResolveBody);
  if (!parsed.ok) return parsed.response;
  const { data, error } = await getElevatedClient().rpc("resolve_listing_report", {
    p_actor: auth.user.id,
    p_id: id.data.id,
    p_action: parsed.data.action,
    p_note: parsed.data.note || null!,
  });
  if (error) return mutationError(error);
  return NextResponse.json({ item: data });
});
