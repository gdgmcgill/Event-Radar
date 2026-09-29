import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { UUID } from "@/contracts/discovery";
import { requireDiscoveryPage } from "@/server/discoveryAccess";
import { OpportunityDetail } from "@/components/discovery/OpportunityDetail";
import { getRequestContext } from "@/server/context";
import { publicDetail } from "@/server/discovery/service";

async function load(id: string) {
  await requireDiscoveryPage();
  if (!UUID.safeParse(id).success) notFound();
  const item = await publicDetail(await getRequestContext(), "opportunity", id);
  if (!item) notFound();
  return item;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const item = await load((await params).id);
  return {
    title: item.title,
    description: item.description.slice(0, 160),
    alternates: { canonical: `/opportunities/${item.id}` },
  };
}
export default async function OpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await load(id);
  if (item.canonical_kind && item.canonical_id)
    permanentRedirect(
      `/${item.canonical_kind === "event" ? "events" : "opportunities"}/${item.canonical_id}`
    );
  return <OpportunityDetail key={id} item={item} />;
}
