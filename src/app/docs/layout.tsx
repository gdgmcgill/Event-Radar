import { requireAdminPage } from "@/server/authz/requireAdminPage";

/**
 * The API description is for active admins only (F-054, DEC-79). Anonymous,
 * non-admin and banned callers are redirected to "/". Reading the session
 * makes the route dynamic, so the page is never served from a static
 * prerender (Pitfall 11).
 */
export default async function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPage("/");

  return <>{children}</>;
}
