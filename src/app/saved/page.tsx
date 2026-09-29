import { Suspense } from "react";
import { requireDiscoveryPage } from "@/server/discoveryAccess";
import { DiscoveryClient } from "@/components/discovery/DiscoveryClient";
export const metadata = {
  title: "Saved opportunities",
  robots: { index: false, follow: false },
};
export default async function SavedPage() {
  await requireDiscoveryPage();
  return (
    <Suspense fallback={<p className="p-8">Loading saved opportunities…</p>}>
      <DiscoveryClient savedOnly />
    </Suspense>
  );
}
