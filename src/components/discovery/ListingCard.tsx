"use client";
import Link from "next/link";
import { ArrowUpRight, Bookmark, Check } from "lucide-react";
import type { DiscoveryItem } from "@/contracts/discovery";
import { actionDate, listingHref, listingLabels } from "./presentation";

export function ListingCard({
  item,
  saved,
  busy,
  onSave,
}: {
  item: DiscoveryItem;
  saved?: boolean;
  busy?: boolean;
  onSave?: () => void;
}) {
  return (
    <article className="group flex min-w-0 flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/30 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider">
        <span className="text-muted-foreground">
          {listingLabels[item.listing_type]}
        </span>
        {item.is_pick && (
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">
            Ady’s Pick
          </span>
        )}
      </div>
      <p className="mb-2 text-xs text-muted-foreground">{item.organization}</p>
      <h2 className="text-xl font-semibold leading-snug tracking-tight">
        <Link className="hover:text-primary" href={listingHref(item)}>
          {item.title}
        </Link>
      </h2>
      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
        {item.curator_note ?? item.description}
      </p>
      {item.is_pick && item.pick_reason && (
        <p className="mt-3 border-l-2 border-primary pl-3 text-sm">
          {item.pick_reason}
        </p>
      )}
      <div className="mb-5 mt-5 space-y-2 text-xs leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">
          {item.closed ? "Closed" : actionDate(item)}
        </p>
        <p>
          {item.work_mode === "remote"
            ? "Remote"
            : item.location || "Location to be confirmed"}
          {item.work_mode === "hybrid" ? " · Hybrid" : ""}
        </p>
        <p>{item.eligibility_text ?? "Check eligibility with organizer"}</p>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
        <Link
          href={listingHref(item)}
          className="inline-flex items-center gap-2 text-sm font-semibold"
        >
          View details <ArrowUpRight size={16} />
        </Link>
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            aria-label={`${saved ? "Unsave" : "Save"} ${item.title}`}
            aria-pressed={!!saved}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            {saved ? <Check size={16} /> : <Bookmark size={16} />}
            {busy ? "Saving…" : saved ? "Saved" : "Save"}
          </button>
        )}
      </div>
    </article>
  );
}
