import type { ListingReportAdminRecord, SubmissionAdminRecord } from "@/contracts/intake";
import { getElevatedClient } from "@/server/db/elevated";

/** Admin-only reads of the intake queue. Callers run only after
 * `adminContext()` verified an active admin. The submission projection
 * includes the private contact fields (the reviewer may need to ask a
 * question) but never the client hash or submitter id. */
const SUBMISSION_ADMIN_COLUMNS =
  "id,kind,title,organization,source_url,details,contact_name,contact_email,status,review_reason,reviewed_at,target_opportunity_id,target_resource_id,created_at,updated_at";

export async function listSubmissions(q: { status: SubmissionAdminRecord["status"]; limit: number }): Promise<SubmissionAdminRecord[]> {
  const { data, error } = await getElevatedClient()
    .from("submissions")
    .select(SUBMISSION_ADMIN_COLUMNS)
    .eq("status", q.status)
    .order("created_at", { ascending: false })
    .order("id")
    .limit(q.limit);
  if (error) throw error;
  return (data ?? []) as unknown as SubmissionAdminRecord[];
}

export async function getSubmission(id: string): Promise<SubmissionAdminRecord | null> {
  const { data, error } = await getElevatedClient()
    .from("submissions")
    .select(SUBMISSION_ADMIN_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as SubmissionAdminRecord | null) ?? null;
}

type ReportRow = {
  id: string;
  event_id: string | null;
  opportunity_id: string | null;
  resource_id: string | null;
  reason: ListingReportAdminRecord["reason"];
  details: string | null;
  status: ListingReportAdminRecord["status"];
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  events: { title: string } | null;
  opportunities: { title: string } | null;
  resources: { title: string } | null;
};

/** Reports with the target's display title. Reporter identity and the
 * client hash are not selected. */
export async function listListingReports(q: { status: ListingReportAdminRecord["status"]; limit: number }): Promise<ListingReportAdminRecord[]> {
  const { data, error } = await getElevatedClient()
    .from("listing_reports")
    .select("id,event_id,opportunity_id,resource_id,reason,details,status,resolution_note,resolved_at,created_at,events(title),opportunities(title),resources(title)")
    .eq("status", q.status)
    .order("created_at", { ascending: false })
    .order("id")
    .limit(q.limit);
  if (error) throw error;
  return ((data ?? []) as unknown as ReportRow[]).map((row) => {
    const kind: ListingReportAdminRecord["kind"] = row.event_id ? "event" : row.opportunity_id ? "opportunity" : "resource";
    return {
      id: row.id,
      kind,
      target_id: (row.event_id ?? row.opportunity_id ?? row.resource_id) as string,
      target_title: (kind === "event" ? row.events : kind === "opportunity" ? row.opportunities : row.resources)?.title ?? null,
      reason: row.reason,
      details: row.details,
      status: row.status,
      resolution_note: row.resolution_note,
      resolved_at: row.resolved_at,
      created_at: row.created_at,
    };
  });
}
