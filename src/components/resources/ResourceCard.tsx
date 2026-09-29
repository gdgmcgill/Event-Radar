import Link from "next/link";
import { ArrowUpRight, Download, FileText, Link as LinkIcon } from "lucide-react";
import { RESOURCE_CATEGORY_LABELS, type PublicResource } from "@/contracts/resources";

const ICONS = { guide: FileText, external: LinkIcon, template: Download } as const;

/** Server-renderable; no client hooks. Used on `/resources` and can be
 * reused anywhere a resource needs a compact summary. */
export function ResourceCard({ resource }: { resource: PublicResource }) {
  const Icon = ICONS[resource.resource_type];
  const updated = resource.reviewed_at
    ? new Intl.DateTimeFormat("en-CA", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "America/Toronto",
      }).format(new Date(resource.reviewed_at))
    : null;
  return (
    <article className="group flex min-w-0 flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/30 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Icon size={14} aria-hidden="true" />
          {RESOURCE_CATEGORY_LABELS[resource.category]}
        </span>
      </div>
      <h2 className="text-xl font-semibold leading-snug tracking-tight">
        <Link className="hover:text-primary" href={`/resources/${resource.slug}`}>
          {resource.title}
        </Link>
      </h2>
      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
        {resource.summary}
      </p>
      <div className="mb-5 mt-5 space-y-1 text-xs leading-relaxed text-muted-foreground">
        <p>By {resource.author_name}</p>
        {updated && <p>Updated {updated}</p>}
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
        <Link
          href={`/resources/${resource.slug}`}
          className="inline-flex items-center gap-2 text-sm font-semibold"
        >
          View resource <ArrowUpRight size={16} />
        </Link>
      </div>
    </article>
  );
}
