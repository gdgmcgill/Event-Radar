import { Suspense } from "react";
import { requireDiscoveryPage } from "@/server/discoveryAccess";
import { DiscoveryClient } from "@/components/discovery/DiscoveryClient";
export const metadata = { title: "Discover opportunities" };
export default async function DiscoverPage() {
  await requireDiscoveryPage();
  return (
    <Suspense fallback={<p className="p-8">Loading opportunities…</p>}>
      <DiscoveryClient />
    </Suspense>
  );
}
