import "server-only";
import { notFound } from "next/navigation";
import { getDiscoveryAccess, getFeatureFlags } from "@/lib/features";
import { getRequestContext } from "@/server/context";

export async function discoverySurface() {
  if (getFeatureFlags().discovery_ui) return { enabled: true, preview: false };
  if (process.env.FEATURE_DISCOVERY_ADMIN_PREVIEW !== "true")
    return { enabled: false, preview: false };
  return getDiscoveryAccess(await getRequestContext());
}

export async function requireDiscoveryPage() {
  const access = await discoverySurface();
  if (!access.enabled) notFound();
  return access;
}
