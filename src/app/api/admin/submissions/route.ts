import { NextResponse, type NextRequest } from "next/server";
import { SubmissionAdminQuery } from "@/contracts/intake";
import { parseQuery } from "@/server/body";
import { listSubmissions } from "@/server/intake/admin";
import { adminContext } from "@/server/opportunities/admin";
import { withRoute } from "@/server/route";

export const GET = withRoute({ cache: "private", action: "load submissions" }, async (request: NextRequest) => {
  const auth = await adminContext();
  if (!auth.ok) return auth.response;
  const parsed = parseQuery(request.nextUrl.searchParams, SubmissionAdminQuery);
  if (!parsed.ok) return parsed.response;
  return NextResponse.json({ items: await listSubmissions(parsed.data) });
});
