import { discoverySurface } from "@/server/discoveryAccess";
import { LegacyHome } from "@/components/home/LegacyHome";
import { EditorialHome } from "@/components/home/EditorialHome";

export default async function HomePage() {
  const surface = await discoverySurface();
  return surface.enabled ? <EditorialHome /> : <LegacyHome />;
}
