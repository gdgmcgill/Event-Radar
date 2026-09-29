import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { DiscoveryItem } from "@/contracts/discovery";
import type { PublicResource } from "@/contracts/resources";
import { getRequestContext } from "@/server/context";
import { homeSections } from "@/server/home/sections";
import { ListingCard } from "@/components/discovery/ListingCard";
import { ResourceCard } from "@/components/resources/ResourceCard";
import { listingLabels } from "@/components/discovery/presentation";

function SectionErrorNotice() {
  return (
    <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
      This section couldn&apos;t load.{" "}
      <Link href="/discover" className="font-medium underline">
        Browse all opportunities.
      </Link>
    </p>
  );
}

function SectionShell({
  title,
  viewAllHref,
  children,
}: {
  title: string;
  viewAllHref?: string;
  children: ReactNode;
}) {
  return (
    <section className="py-10 sm:py-14">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-1 text-sm font-semibold"
          >
            View all <ArrowUpRight size={16} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function ListingGrid({ items }: { items: DiscoveryItem[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <ListingCard key={`${item.kind}:${item.id}`} item={item} />
      ))}
    </div>
  );
}

function ResourceGrid({ items }: { items: PublicResource[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((resource) => (
        <ResourceCard key={resource.id} resource={resource} />
      ))}
    </div>
  );
}

/** The switch-on homepage (Task 5). Every section is fetched independently
 * via `homeSections()` — a thrown section never fakes a list and never
 * blocks the others. Nothing here is a sign-up prompt: the hero, unlike the
 * legacy homepage, sends every visitor straight to `/discover`. */
export async function EditorialHome() {
  const ctx = await getRequestContext();
  const { thisWeek, picks, resources } = await homeSections(ctx);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <section className="py-14 sm:py-20">
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Opportunities for Montréal students
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Events, hackathons, jobs and programs across campuses, checked
          before they&apos;re listed.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/discover"
            className="rounded-lg bg-foreground px-5 py-3 text-sm font-semibold text-background"
          >
            Browse opportunities
          </Link>
          <Link
            href="/discover?window=this_week"
            className="rounded-lg border border-border px-5 py-3 text-sm font-semibold"
          >
            This week
          </Link>
        </div>
      </section>

      <SectionShell title="This week" viewAllHref="/discover?window=this_week">
        {thisWeek.status === "error" ? (
          <SectionErrorNotice />
        ) : thisWeek.items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Nothing checked for this week yet.{" "}
            <Link href="/discover" className="font-medium underline">
              Browse all opportunities.
            </Link>
          </p>
        ) : (
          <ListingGrid items={thisWeek.items} />
        )}
      </SectionShell>

      {picks.status === "error" ? (
        <SectionShell title="Ady’s Picks">
          <SectionErrorNotice />
        </SectionShell>
      ) : (
        picks.items.length > 0 && (
          <SectionShell title="Ady’s Picks">
            <ListingGrid items={picks.items} />
          </SectionShell>
        )
      )}

      <SectionShell title="Browse by type">
        <div className="flex flex-wrap gap-3">
          {Object.entries(listingLabels).map(([type, label]) => (
            <Link
              key={type}
              href={`/discover?type=${type}`}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium"
            >
              {label}
            </Link>
          ))}
        </div>
      </SectionShell>

      {resources.status === "error" ? (
        <SectionShell title="Resources">
          <SectionErrorNotice />
        </SectionShell>
      ) : (
        resources.items.length > 0 && (
          <SectionShell title="Resources" viewAllHref="/resources">
            <ResourceGrid items={resources.items} />
          </SectionShell>
        )
      )}

      <section className="grid gap-5 py-14 sm:grid-cols-2">
        <Link
          href="/for-companies"
          className="group flex items-center justify-between gap-4 rounded-2xl border border-border p-8 transition-colors hover:border-foreground/30"
        >
          <h3 className="text-lg font-semibold">
            Hiring? Tell us about a role
          </h3>
          <ArrowRight
            size={20}
            className="shrink-0 transition-transform group-hover:translate-x-1"
          />
        </Link>
        <Link
          href="/submit"
          className="group flex items-center justify-between gap-4 rounded-2xl border border-border p-8 transition-colors hover:border-foreground/30"
        >
          <h3 className="text-lg font-semibold">
            Know an opportunity? Submit it
          </h3>
          <ArrowRight
            size={20}
            className="shrink-0 transition-transform group-hover:translate-x-1"
          />
        </Link>
      </section>
    </div>
  );
}
