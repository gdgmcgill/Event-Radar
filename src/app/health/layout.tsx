import { requireAdminPage } from "@/server/authz/requireAdminPage";

/**
 * The health dashboard is for active admins only (DEC-79). Anonymous,
 * non-admin and banned callers are redirected to "/". `/api/health` itself
 * stays public and answers liveness to anyone (docs/health.md); this gate is
 * on the page that renders the full report.
 */
export default async function HealthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPage("/");

  return <>{children}</>;
}
