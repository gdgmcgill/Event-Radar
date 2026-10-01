import type { DiscoveryItem } from "@/contracts/discovery";
import { provenanceLabel } from "./presentation";

const LAST_CHECKED_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "America/Toronto",
});

const WHEN_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Toronto",
  timeZoneName: "short",
});

/** "When" is the occurrence (`starts_at`/`ends_at`), never the deadline —
 * `actionDate()` (used by cards) prefers the deadline when one exists, which
 * would make a listing with both repeat the same "Apply by …" text under
 * both "When" and "Deadline". Omitted entirely when there is no `starts_at`
 * (e.g. a rolling-deadline opportunity with no fixed occurrence). */
function whenFact(item: DiscoveryItem): string | null {
  if (!item.starts_at) return null;
  const start = WHEN_FORMATTER.format(new Date(item.starts_at));
  if (!item.ends_at) return start;
  return `${start} – ${WHEN_FORMATTER.format(new Date(item.ends_at))}`;
}

/** The Deadline fact is distinct from "When": it exists only for listings
 * that carry an application/registration deadline separate from the
 * occurrence itself, and it always spells out the assumptions a date-only or
 * timezone-assumed value carries — never a bare, ambiguous date. */
function deadlineFact(item: DiscoveryItem): string | null {
  if (item.deadline_precision === "date" && item.deadline_date) {
    const formatted = new Date(`${item.deadline_date}T12:00:00Z`).toLocaleDateString(
      "en-CA",
      { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }
    );
    const base = `${formatted} (end of day, ${item.source_timezone})`;
    return item.timezone_assumed
      ? `${base}. Time zone assumed: America/Toronto`
      : base;
  }
  if (item.deadline_at) {
    const formatted = new Intl.DateTimeFormat("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: item.source_timezone,
      timeZoneName: "short",
    }).format(new Date(item.deadline_at));
    return item.timezone_assumed
      ? `${formatted}. Time zone assumed: America/Toronto`
      : formatted;
  }
  return null;
}

function relevanceFact(item: DiscoveryItem): string {
  if (item.relevance_scope === "cross_campus") return "Cross-campus";
  if (item.relevance_scope === "specific") {
    // DiscoveryItem carries university IDs, not names; naming them without a
    // lookup would be a fabrication risk, so this stays a safe, honest label.
    return "Specific to select university communities";
  }
  return "Not specified";
}

function locationFact(item: DiscoveryItem): string {
  const base =
    item.work_mode === "remote"
      ? "Remote"
      : item.location || "Location to be confirmed";
  return item.work_mode === "hybrid" ? `${base} · Hybrid` : base;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

/** The public listing facts shared by the opportunity and event detail
 * pages. No fact here ever says "Verified" — provenance says where a
 * listing came from, never that anyone confirmed every detail. */
export function ListingFacts({ item }: { item: DiscoveryItem }) {
  const when = whenFact(item);
  const deadline = deadlineFact(item);
  return (
    <dl className="grid gap-5 text-sm sm:grid-cols-2">
      {when && <Fact label="When">{when}</Fact>}
      {deadline && <Fact label="Deadline">{deadline}</Fact>}
      <Fact label="Eligibility">
        {item.eligibility_text ?? "Check eligibility with organizer"}
      </Fact>
      <Fact label="Relevance">{relevanceFact(item)}</Fact>
      <Fact label="Location & work mode">{locationFact(item)}</Fact>
      <Fact label="Source">
        {provenanceLabel(item.source_type)}
        {item.source_url && (
          <>
            {" · "}
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View original source
            </a>
          </>
        )}
      </Fact>
      <Fact label="Last checked">
        {item.checked_at
          ? LAST_CHECKED_FORMATTER.format(new Date(item.checked_at))
          : "Not yet checked"}
      </Fact>
      {item.is_pick && item.pick_reason && (
        <div className="sm:col-span-2">
          <dt className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pick reason
          </dt>
          <dd>{item.pick_reason}</dd>
        </div>
      )}
    </dl>
  );
}
