import Link from "next/link";
import { RESOURCE_CATEGORY_LABELS, ResourceCategory } from "@/contracts/resources";
import { ResourceCard } from "@/components/resources/ResourceCard";
import { getRequestContext } from "@/server/context";
import { requireDiscoveryPage } from "@/server/discoveryAccess";
import { listResources } from "@/server/resources/service";

export const metadata = {
  title: "Resources",
  description: "Guides, templates and links curated for Uni-Verse students.",
};

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  await requireDiscoveryPage();
  const { category: rawCategory } = await searchParams;
  const parsedCategory = ResourceCategory.safeParse(rawCategory);
  const category = parsedCategory.success ? parsedCategory.data : undefined;
  const ctx = await getRequestContext();
  const items = await listResources(ctx, { category, limit: 24 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
          Resource library
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Guides, templates and links
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Written and curated for Uni-Verse students. Nothing here is
          fabricated: every entry names its author and, where relevant, its
          source.
        </p>
      </div>
      <nav aria-label="Resource categories" className="mb-8 flex flex-wrap gap-2">
        <Link
          href="/resources"
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${!category ? "border-foreground bg-foreground text-background" : "border-border"}`}
        >
          All
        </Link>
        {Object.entries(RESOURCE_CATEGORY_LABELS).map(([value, label]) => (
          <Link
            key={value}
            href={`/resources?category=${value}`}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${category === value ? "border-foreground bg-foreground text-background" : "border-border"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Guides and templates are on the way.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      )}
    </div>
  );
}
