import type { DiscoveryItem } from "@/contracts/discovery";

export const listingLabels = {
  event: "Events",
  hackathon: "Hackathons",
  job: "Jobs & internships",
  program: "Programs",
  networking: "Networking",
  grant: "Grants & competitions",
} as const;
export const listingHref = (item: Pick<DiscoveryItem, "kind" | "id">) =>
  item.kind === "event" ? `/events/${item.id}` : `/opportunities/${item.id}`;
export const listingKey = (item: Pick<DiscoveryItem, "kind" | "id">) =>
  `${item.kind}:${item.id}`;
export function actionDate(item: DiscoveryItem) {
  if (item.deadline_precision === "date" && item.deadline_date) {
    const date = new Date(`${item.deadline_date}T12:00:00Z`);
    return `Apply by ${date.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })} · ${item.source_timezone} (date only)`;
  }
  const date = item.deadline_at ?? item.starts_at;
  if (!date)
    return item.review_at
      ? "Ongoing · check organizer details"
      : "Dates to be confirmed";
  return `${item.deadline_at ? "Apply by " : ""}${new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: item.source_timezone, timeZoneName: "short" }).format(new Date(date))}${item.timezone_assumed ? " (timezone assumed)" : ""}`;
}

const PROVENANCE_LABELS: Record<DiscoveryItem["source_type"], string> = {
  manual: "Added by the Uni-Verse team",
  indexed: "Automatically indexed",
  partner: "Submitted by the organizer",
};

/** No provenance label ever says "Verified": these describe where a listing
 * came from, not that anyone confirmed its details. */
export function provenanceLabel(source_type: DiscoveryItem["source_type"]): string {
  return PROVENANCE_LABELS[source_type];
}

export async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof body?.error === "string"
        ? body.error
        : typeof body?.error?.message === "string"
          ? body.error.message
          : `Request failed (${response.status}). Please try again.`;
    throw new Error(message);
  }
  return body as T;
}
