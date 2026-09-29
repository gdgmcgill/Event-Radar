import { NextResponse, type NextRequest } from "next/server";
import { PersistImagesBody } from "@/contracts/ingestion";
import { parseBody } from "@/server/body";
import { persistEventImages } from "@/server/ingestion/persistImages";
import { adminContext } from "@/server/opportunities/admin";
import { withRoute } from "@/server/route";

/** Each image fetch (DNS included) is bounded by its own 10 s timeout; this
 * caps the whole call on platforms that honour the route segment config. */
export const maxDuration = 60;

/** M3 P1-07: copy up to `limit` still-remote ingested images into event-images/ingest/*. */
export const POST = withRoute({ cache: "private", action: "persist ingested images" }, async (request: NextRequest) => {
  const auth = await adminContext();
  if (!auth.ok) return auth.response;
  const parsed = await parseBody(request, PersistImagesBody);
  if (!parsed.ok) return parsed.response;
  return NextResponse.json(await persistEventImages(parsed.data.limit));
});
