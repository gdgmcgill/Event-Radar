import { redirect } from "next/navigation";
import { getFeatureFlags } from "@/lib/features";
import { LandingClient } from "@/components/landing/LandingClient";

/** `/landing` redirects to `/` only when the public switch is exactly
 * `true` — never for an admin preview, which must still be able to reach
 * the legacy landing page. */
export default function LandingPage() {
  if (getFeatureFlags().discovery_ui) redirect("/");
  return <LandingClient />;
}
