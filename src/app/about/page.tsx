import { discoverySurface } from "@/server/discoveryAccess";
import { EditorialAbout } from "@/components/about/EditorialAbout";
import { LegacyAbout } from "@/components/about/LegacyAbout";

export default async function AboutPage() {
  const surface = await discoverySurface();
  return surface.enabled ? <EditorialAbout /> : <LegacyAbout />;
}
