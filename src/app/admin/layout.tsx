import { requireAdminPage } from "@/server/authz/requireAdminPage";

/**
 * The admin pages are for active admins only. Anonymous, non-admin and
 * banned callers are redirected to "/" (the target this layout always had;
 * the ban check is DI-55, DEC-79).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPage("/");

  return <>{children}</>;
}
