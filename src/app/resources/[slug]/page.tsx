import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResourceSlugParams, type PublicResource } from "@/contracts/resources";
import { ReportListingButton } from "@/components/intake/ReportListingButton";
import { SafeMarkdown } from "@/lib/markdown/SafeMarkdown";
import { getRequestContext, memoizePerRenderPass } from "@/server/context";
import { requireDiscoveryPage } from "@/server/discoveryAccess";
import { resourceBySlug } from "@/server/resources/service";

/** Memoized per render pass (React `cache`, see memoizePerRenderPass), so
 * generateMetadata and the page share one load. */
const load = memoizePerRenderPass(async (slug: string): Promise<PublicResource> => {
  await requireDiscoveryPage();
  const parsed = ResourceSlugParams.safeParse({ slug });
  if (!parsed.success) notFound();
  const item = await resourceBySlug(await getRequestContext(), parsed.data.slug);
  if (!item) notFound();
  return item;
});

function actionLabel(item: PublicResource): string {
  if (item.resource_type === "external") return "Open resource";
  if (item.resource_type === "template") {
    const kb = item.file_size ? Math.max(1, Math.round(item.file_size / 1024)) : null;
    const ext = item.file_name?.split(".").pop()?.toUpperCase() ?? "FILE";
    return kb ? `Download template (${ext}, ${kb} KB)` : `Download template (${ext})`;
  }
  return "Open resource";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const item = await load((await params).slug);
  return {
    title: item.title,
    description: item.summary,
    alternates: { canonical: `/resources/${item.slug}` },
    openGraph: {
      type: "article",
      title: item.title,
      description: item.summary,
      url: `/resources/${item.slug}`,
    },
  };
}

export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await load(slug);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
        Resource
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">{item.title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {item.summary}
      </p>
      {item.resource_type !== "guide" && (
        <a
          href={`/api/resources/${item.slug}/open`}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-3 text-sm font-semibold text-background"
        >
          {actionLabel(item)}
        </a>
      )}
      {item.resource_type === "guide" && item.body_markdown && (
        <div className="mt-8">
          <SafeMarkdown source={item.body_markdown} />
        </div>
      )}
      <div className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">
        <p>
          By{" "}
          {item.author_url ? (
            <a
              href={item.author_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="underline"
            >
              {item.author_name}
            </a>
          ) : (
            item.author_name
          )}
        </p>
        {item.source_note && <p className="mt-2">{item.source_note}</p>}
        <div className="mt-4">
          <ReportListingButton kind="resource" id={item.id} />
        </div>
      </div>
    </div>
  );
}
